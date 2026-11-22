import { test, expect, type Page } from '@playwright/test';
import { wateringInterval } from '../src/lib/schedule';
import { todayLocal } from '../src/lib/dates';
import type { Plant } from '../src/lib/types';

async function addPlant(page: Page, name: string, waterEvery: string) {
  await page.goto('./#/nouvelle-plante');
  await page.getByLabel('Nom *').fill(name);
  await page.getByLabel("Quantité d'eau habituelle (mL)").fill('250');
  await page.locator('details summary').click();
  await page.getByLabel(/Arrosage — tous les/).fill(waterEvery);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

test('Aujourd’hui : accomplir, reporter, action de diagnostic', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  await expect(page.getByText('Bienvenue !')).toBeVisible();

  await addPlant(page, 'Calathea', '7');
  await addPlant(page, 'Ficus', '7');

  await page.goto('./');
  await expect(page.getByText('2 tâches à faire')).toBeVisible();
  await expect(page.locator('.pill').first()).toHaveText('2');
  const calathea = page.locator('.task', { hasText: 'Calathea' });
  await expect(calathea.getByText('Arroser')).toBeVisible();
  await expect(calathea.getByText('250 mL')).toBeVisible();

  // Accomplir
  await calathea.getByRole('button', { name: /Fait : Arroser \(Calathea\)/ }).click();
  await expect(page.locator('.task', { hasText: 'Calathea' })).toHaveCount(0);
  await expect(page.getByText('1 tâche à faire')).toBeVisible();

  // Prévision affichée dans la liste
  const interval = wateringInterval({ careFrequencyDays: { arrosage: 7 }, speciesSheet: null } as unknown as Plant, [], todayLocal());
  await page.goto('./#/plantes');
  await expect(page.locator('.card', { hasText: 'Calathea' }).getByText(`💧 dans ${interval} j`)).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Ficus' }).getByText('💧 à arroser')).toBeVisible();
  await page.locator('.card', { hasText: 'Calathea' }).click();
  await expect(page.locator('.tl p.what', { hasText: '💧 Arrosage · 250 mL' })).toBeVisible();

  // Reporter
  await page.goto('./');
  await page.locator('.task', { hasText: 'Ficus' }).getByRole('button', { name: 'Reporter' }).click();
  await page.getByRole('button', { name: 'Demain' }).click();
  await expect(page.getByText('Rien à faire aujourd’hui', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Prochains jours/ }).click();
  await expect(page.locator('.task', { hasText: 'Ficus' }).getByText('demain')).toBeVisible();
});

test('Aujourd’hui : action recommandée par un diagnostic', async ({ page }) => {
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }) });
    }
    const isProbe = JSON.stringify(route.request().postDataJSON()).includes('{\\"ok\\": true}');
    const obj = isProbe
      ? { ok: true }
      : {
          state: 'surveiller', summary: 'Manque de lumière.', confidence: 0.9, trend: 'inconnue', problems: [],
          actions: [{ action: 'Rapprocher de la fenêtre', careType: null, priority: 'haute', delayDays: 0 }], questions: [],
        };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
  });
  await page.goto('./#/reglages');
  await page.getByLabel('Clé API Gemini').fill('K');
  await page.getByRole('button', { name: 'Tester et choisir le modèle' }).first().click();
  await expect(page.getByText(/✓ Clé valide/)).toBeVisible();

  await page.goto('./#/nouvelle-plante');
  await page.getByLabel('Nom *').fill('Pothos');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('link', { name: '🔬 Diagnostiquer' }).click();
  const img = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    c.getContext('2d')!.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg').split(',')[1];
  });
  await page.getByTestId('slot-ensemble').setInputFiles({ name: 'e.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(img, 'base64') });
  await page.getByRole('button', { name: '🔬 Analyser' }).click();
  await expect(page.locator('.hero').getByText('À surveiller')).toBeVisible();
  const diagUrl = page.url();

  await page.goto('./');
  const task = page.locator('.task', { hasText: 'Rapprocher de la fenêtre' });
  await expect(task).toBeVisible();
  await expect(task.getByText(/Diagnostic du/)).toBeVisible();
  await task.getByRole('button', { name: /Fait :/ }).click();
  await expect(page.locator('.task', { hasText: 'Rapprocher de la fenêtre' })).toHaveCount(0);

  await page.goto(diagUrl);
  await expect(page.locator('.action', { hasText: 'Rapprocher de la fenêtre' })).toHaveClass(/done/);
});
