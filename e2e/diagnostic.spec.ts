import { test, expect, type Page, type Route } from '@playwright/test';

async function photo(page: Page, color: string): Promise<Buffer> {
  const b64 = await page.evaluate((c) => {
    const cv = document.createElement('canvas');
    cv.width = 800;
    cv.height = 600;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#2c8';
    ctx.beginPath();
    ctx.ellipse(400, 300, 180, 240, 0.4, 0, Math.PI * 2);
    ctx.fill();
    return cv.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, color);
  return Buffer.from(b64, 'base64');
}

const isProbe = (route: Route) => route.request().method() === 'POST' && JSON.stringify(route.request().postDataJSON()).includes('{\\"ok\\": true}');

const reply = (obj: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
});

const UNSURE = { state: 'surveiller', summary: 'Je ne suis pas sûr.', confidence: 0.4, questions: ['La terre est-elle humide ?'] };
const SICK = {
  state: 'malade', summary: 'Excès d’arrosage : racines asphyxiées.', confidence: 0.86, trend: 'inconnue',
  problems: [{ name: 'Pourriture des racines', cause: 'Terre trop humide', severity: 'forte' }],
  actions: [
    { action: 'Arroser très légèrement', careType: 'arrosage', priority: 'haute', delayDays: 0 },
    { action: 'Rapprocher de la fenêtre', careType: null, priority: 'basse', delayDays: 2 },
  ],
  questions: [],
};
const SHEET = {
  species: 'Monstera deliciosa', light: 'Lumière vive indirecte', water: 'Quand 3 cm de terre sont secs', humidity: '60 %',
  temperature: '18–27 °C', toxicity: 'Toxique pour chats et chiens', tips: ['Tuteurer'], frequencies: { arrosage: 7 },
};

async function setup(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('./#/reglages');
  await page.getByLabel('Clé API Gemini').fill('TEST-KEY-123');
  await page.getByRole('button', { name: 'Tester et choisir le modèle' }).first().click();
  await expect(page.getByText('✓ Clé valide — modèle gratuit : gemini-2.5-flash')).toBeVisible();
  await page.goto('./#/nouvelle-plante');
  await page.getByLabel('Nom *').fill('Monstera');
  await page.getByLabel("Quantité d'eau habituelle (mL)").fill('200');
  await page.getByTestId('photo-input').setInputFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: await photo(page, '#111') });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Monstera', level: 1 })).toBeVisible();
}

test('diagnostic complet avec questions, action faite et fiche d’espèce', async ({ page }, info) => {
  const prompts: string[] = [];
  let n = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    expect(req.headers()['x-goog-api-key']).toBe('TEST-KEY-123');
    if (isProbe(route)) return route.fulfill(reply({ ok: true }));
    const body = req.postDataJSON();
    prompts.push(body.contents[0].parts[0].text);
    n++;
    return route.fulfill(reply(n === 1 ? UNSURE : n === 2 ? SICK : SHEET));
  });

  await setup(page);
  await page.getByRole('link', { name: '🔬 Diagnostiquer' }).click();
  await expect(page.getByRole('button', { name: '🔬 Analyser' })).toBeDisabled();
  await page.getByTestId('slot-ensemble').setInputFiles({ name: 'e.jpg', mimeType: 'image/jpeg', buffer: await photo(page, '#333') });
  await page.getByTestId('slot-dessous').setInputFiles({ name: 'd.jpg', mimeType: 'image/jpeg', buffer: await photo(page, '#553') });
  await page.getByRole('button', { name: '🔬 Analyser' }).click();

  await expect(page.getByText('La terre est-elle humide ?')).toBeVisible();
  await page.getByRole('button', { name: 'Oui', exact: true }).click();
  await page.getByRole('button', { name: 'Affiner le diagnostic' }).click();

  await expect(page.locator('.hero').getByText('Malade')).toBeVisible();
  await expect(page.getByText('Pourriture des racines')).toBeVisible();
  expect(prompts[1]).toContain('La terre est-elle humide ? → Oui');
  await page.screenshot({ path: info.outputPath('resultat.png'), fullPage: true });

  await page.locator('.action', { hasText: 'Arroser très légèrement' }).getByRole('button', { name: '✓ Fait' }).click();
  await expect(page.getByText('Fait — ajouté à l’historique')).toBeVisible();

  await page.getByRole('link', { name: 'Retour' }).click();
  await expect(page.locator('.tl p.what', { hasText: '💧 Arrosage · 200 mL' })).toBeVisible();
  await expect(page.locator('.tl').getByText('🔬 Diagnostic · Gemini')).toBeVisible();
  await expect(page.locator('.title').getByText('Malade')).toBeVisible();

  await page.getByRole('button', { name: '✨ Générer la fiche d’espèce' }).click();
  await expect(page.getByText('Toxique pour chats et chiens')).toBeVisible();
  await expect(page.locator('.title').getByText('Monstera deliciosa')).toBeVisible();

  await page.goto('./#/reglages');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exporter mes données/ }).click()]);
  const text = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(text).not.toContain('TEST-KEY-123');
  expect(JSON.parse(text).diagnoses).toHaveLength(1);
});

test('quota atteint puis réessai', async ({ page }) => {
  let fail = true;
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    if (isProbe(route)) return route.fulfill(reply({ ok: true }));
    if (fail) return route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"message":"quota"}}' });
    return route.fulfill(reply(SICK));
  });
  await setup(page);
  await page.getByRole('link', { name: '🔬 Diagnostiquer' }).click();
  await page.getByTestId('slot-ensemble').setInputFiles({ name: 'e.jpg', mimeType: 'image/jpeg', buffer: await photo(page, '#333') });
  await page.getByRole('button', { name: '🔬 Analyser' }).click();
  await expect(page.getByRole('alert')).toContainText('Quota gratuit atteint');
  fail = false;
  await page.getByRole('button', { name: '↻ Réessayer' }).click();
  await expect(page.locator('.hero').getByText('Malade')).toBeVisible();
});

test('analyse interrompue (application fermée) → relançable', async ({ page }) => {
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    if (isProbe(route)) return route.fulfill(reply({ ok: true }));
    return route.fulfill(reply(SICK));
  });
  await setup(page);
  const plantId = page.url().split('/plante/')[1];
  await page.evaluate(async (pid) => {
    const req = indexedDB.open('health-plant');
    const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const photoId: string = await new Promise((r) => {
      const q = db.transaction('photos').objectStore('photos').getAll();
      q.onsuccess = () => r(q.result[0].id);
    });
    await new Promise((r) => {
      const tx = db.transaction('diagnoses', 'readwrite');
      tx.objectStore('diagnoses').put({
        id: 'stuck', plantId: pid, createdAt: new Date().toISOString(), date: '2026-11-22', provider: 'gemini', model: '',
        photoIds: [photoId], photoKinds: ['ensemble'], answers: [], status: 'en-cours', error: null, result: null,
      });
      tx.oncomplete = r;
    });
  }, plantId);
  await page.goto(`./#/plante/${plantId}/diagnostic/stuck`);
  await page.reload();
  await expect(page.getByText('Analyse interrompue')).toBeVisible();
  await page.getByRole('button', { name: '↻ Réessayer' }).click();
  await expect(page.locator('.hero').getByText('Malade')).toBeVisible();
});

test('Tester choisit automatiquement un modèle gratuit', async ({ page }) => {
  const tried: string[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ models: ['gemini-3-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest'].map((m) => ({ name: `models/${m}`, supportedGenerationMethods: ['generateContent'] })) }),
      });
    }
    const model = /models\/([^:]+):/.exec(url)![1];
    tried.push(model);
    if (model !== 'gemini-flash-lite-latest') {
      return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: `Quota exceeded for metric: x, limit: 0, model: ${model}` } }) });
    }
    return route.fulfill(reply({ ok: true }));
  });
  await page.goto('./#/reglages');
  await page.getByLabel('Clé API Gemini').fill('TEST-KEY-123');
  await page.getByRole('button', { name: 'Tester et choisir le modèle' }).first().click();
  await expect(page.getByText('✓ Clé valide — modèle gratuit : gemini-flash-lite-latest')).toBeVisible();
  await expect(page.getByLabel('Modèle Gemini')).toHaveValue('gemini-flash-lite-latest');
  expect(tried).toEqual(['gemini-3-flash', 'gemini-2.5-flash', 'gemini-flash-lite-latest']);
});
