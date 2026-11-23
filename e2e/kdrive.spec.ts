import { test, expect, type Page, type Route } from '@playwright/test';

const AUTH = 'Basic ' + Buffer.from('moi@exemple.fr:app-pass').toString('base64');

/** Mini serveur WebDAV en mémoire derrière un faux relais. */
function fakeKDrive(page: Page, opts: { status?: number } = {}) {
  const files = new Map<string, string>();
  const dirs = new Set<string>(['/']);
  const handler = async (route: Route) => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*' };
    const m = /\/kdrive\/(\d+)(\/.*)$/.exec(new URL(req.url()).pathname);
    if (!m) return route.fulfill({ status: 404, headers: cors });
    if (opts.status) return route.fulfill({ status: opts.status, headers: cors });
    if (req.headers()['authorization'] !== AUTH) return route.fulfill({ status: 401, headers: cors });
    const path = decodeURIComponent(m[2]);
    switch (req.method()) {
      case 'PROPFIND': {
        if (!dirs.has(path)) return route.fulfill({ status: 404, headers: cors });
        const children = [...files.keys()].filter((f) => f.startsWith(path) && !f.slice(path.length).includes('/'));
        const body = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>${encodeURI(path)}</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>${children
          .map((c) => `<d:response><d:href>${encodeURI(c)}</d:href><d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat></d:response>`)
          .join('')}</d:multistatus>`;
        return route.fulfill({ status: 207, headers: { ...cors, 'Content-Type': 'application/xml' }, body });
      }
      case 'MKCOL':
        if (dirs.has(path)) return route.fulfill({ status: 405, headers: cors });
        dirs.add(path);
        return route.fulfill({ status: 201, headers: cors });
      case 'PUT':
        files.set(path, req.postData() ?? '');
        return route.fulfill({ status: 201, headers: cors });
      case 'GET':
        if (!files.has(path)) return route.fulfill({ status: 404, headers: cors });
        return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: files.get(path)! });
      case 'DELETE':
        files.delete(path);
        return route.fulfill({ status: 204, headers: cors });
    }
    return route.fulfill({ status: 405, headers: cors });
  };
  return { files, handle: handler, install: () => page.route('https://relais.example/**', handler) };
}

async function configure(page: Page) {
  await page.goto('./#/reglages');
  await page.getByLabel('Identifiant kDrive').fill('123456');
  await page.getByLabel('E-mail Infomaniak').fill('moi@exemple.fr');
  await page.getByLabel('Mot de passe d’application kDrive').fill('app-pass');
  await page.getByLabel('Relais Cloudflare', { exact: true }).fill('https://relais.example');
  await page.getByLabel('Relais Cloudflare', { exact: true }).blur();
}

test('kDrive : test, sauvegarde manuelle et automatique, restauration', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => ((window as unknown as { __HP_BACKUP_DELAY__: number }).__HP_BACKUP_DELAY__ = 200));
  const kd = fakeKDrive(page);
  await kd.install();

  await page.goto('./#/reglages');
  await page.getByLabel('Clé API Gemini').fill('CLE-IA-SECRETE');
  await page.getByLabel('Clé API Gemini').blur();

  await page.goto('./#/nouvelle-plante');
  await page.getByLabel('Nom *').fill('Monstera');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Monstera', level: 1 })).toBeVisible();

  await configure(page);
  await page.getByRole('button', { name: 'Tester la connexion' }).click();
  await expect(page.getByText('✓ Connexion à kDrive réussie')).toBeVisible();

  await page.getByRole('switch', { name: 'Activer la sauvegarde kDrive' }).click();
  await page.getByRole('button', { name: '☁️ Sauvegarder maintenant' }).click();
  await expect(page.getByText('Sauvegarde envoyée sur kDrive')).toBeVisible();
  await expect(page.getByText(/✓ Dernière sauvegarde/)).toBeVisible();

  const saved = kd.files.get('/Health Plant/sauvegarde.json')!;
  expect(saved).toContain('Monstera');
  expect(saved).not.toContain('app-pass');
  expect(saved).not.toContain('CLE-IA-SECRETE');
  expect([...kd.files.keys()].some((k) => /historique\/health-plant-\d{4}-\d{2}-\d{2}\.json$/.test(k))).toBe(true);

  // Sauvegarde automatique après une modification
  kd.files.delete('/Health Plant/sauvegarde.json');
  await page.goto('./#/plantes');
  await page.locator('.card', { hasText: 'Monstera' }).click();
  await page.getByRole('button', { name: 'Arrosé' }).click();
  await expect.poll(() => kd.files.get('/Health Plant/sauvegarde.json') ?? '', { timeout: 5000 }).toContain('"arrosage"');

  // Nouveau téléphone : stockage vierge, configuration, restauration
  const fresh = await page.context().browser()!.newContext({ viewport: page.viewportSize()!, serviceWorkers: 'block', baseURL: 'http://localhost:4173/health-plant/' });
  const phone2 = await fresh.newPage();
  phone2.on('dialog', (d) => d.accept());
  await phone2.route('https://relais.example/**', kd.handle);
  await configure(phone2);
  await phone2.getByRole('button', { name: '⤓ Restaurer depuis kDrive' }).click();
  await expect(phone2.getByRole('group', { name: 'Choisir la sauvegarde à restaurer' })).toBeVisible();
  await phone2.getByRole('button', { name: 'La plus récente' }).click();
  await expect(phone2.getByText('Données restaurées depuis kDrive')).toBeVisible();
  await phone2.goto('./#/plantes');
  await expect(phone2.locator('.card', { hasText: 'Monstera' })).toBeVisible();
  await fresh.close();
});

test('kDrive : identifiants refusés', async ({ page }) => {
  const kd = fakeKDrive(page, { status: 401 });
  await kd.install();
  await configure(page);
  await page.getByRole('button', { name: 'Tester la connexion' }).click();
  await expect(page.getByText('Identifiants kDrive refusés (e-mail ou mot de passe d’application).')).toBeVisible();
});
