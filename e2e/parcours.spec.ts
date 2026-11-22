import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/** Grande photo JPEG 6000×4000 générée dans le navigateur. */
async function bigPhoto(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 6000;
    c.height = 4000;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 6000, 4000);
    g.addColorStop(0, '#2a7'); g.addColorStop(1, '#063');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 6000, 4000);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  });
  return Buffer.from(b64, 'base64');
}

test('parcours complet de l’étape 1', async ({ page }, info) => {
  page.on('dialog', (d) => d.accept());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByText('Aucune plante pour l\'instant')).toBeVisible();

  // Pièce + plante avec grande photo
  await page.getByRole('link', { name: '＋ Ajouter une plante' }).click();
  await page.getByLabel('Nom *').fill('Monstera');
  await page.getByLabel('Pièce').selectOption('__new');
  await page.getByLabel('Nom de la nouvelle pièce').fill('Salon');
  await page.getByRole('button', { name: /Lumière vive indirecte/ }).click();
  await page.getByLabel("Quantité d'eau habituelle (mL)").fill('300');
  await page.getByTestId('photo-input').setInputFiles({ name: 'grande.jpg', mimeType: 'image/jpeg', buffer: await bigPhoto(page) });
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('heading', { name: 'Monstera', level: 1 })).toBeVisible();
  const dims = await page.evaluate(async () => {
    const req = indexedDB.open('health-plant');
    const db: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const photos: { blob: Blob; thumb: Blob }[] = await new Promise((r) => {
      const q = db.transaction('photos').objectStore('photos').getAll();
      q.onsuccess = () => r(q.result);
    });
    const a = await createImageBitmap(photos[0].blob);
    const t = await createImageBitmap(photos[0].thumb);
    return { w: a.width, h: a.height, tw: t.width };
  });
  expect(dims).toEqual({ w: 1280, h: 853, tw: 320 });

  // Arrosage en un geste
  await page.getByRole('button', { name: 'Arrosé' }).click();
  await expect(page.getByText('Arrosage enregistré')).toBeVisible();
  await expect(page.locator('.tl').getByText('Arrosage')).toBeVisible();
  await expect(page.locator('.tl').getByText('300 mL')).toBeVisible();

  // Mise en page
  if (info.project.name === 'fold-deplie') {
    await expect(page.locator('.pane-list').getByText('Monstera')).toBeVisible();
    await expect(page.locator('.pane-detail').getByRole('heading', { name: 'Monstera' })).toBeVisible();
    await expect(page.locator('.pane-list .chip', { hasText: "💧 aujourd'hui" })).toBeVisible();
  } else {
    await page.getByRole('link', { name: /Plantes/ }).click();
    await expect(page.getByText("💧 aujourd'hui")).toBeVisible();
    await expect(page.getByText('Salon')).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('liste.png') });

  // Export
  await page.goto('./#/reglages');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exporter mes données/ }).click()]);
  const backupPath = info.outputPath('sauvegarde.json');
  await download.saveAs(backupPath);
  expect(JSON.parse(await readFile(backupPath, 'utf8')).plants).toHaveLength(1);

  // Fichier invalide refusé
  await page.getByTestId('import-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"foo":1}') });
  await expect(page.getByRole('alert')).toHaveText('Fichier de sauvegarde invalide');

  // Supprimer puis réimporter
  await page.goto('./');
  await page.locator('.card', { hasText: 'Monstera' }).click();
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('button', { name: '🗑️ Supprimer' }).click();
  await expect(page.getByText('Aucune plante pour l\'instant')).toBeVisible();

  await page.goto('./#/reglages');
  await page.getByTestId('import-input').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: await readFile(backupPath) });
  await expect(page.getByText('Données importées')).toBeVisible();
  await page.goto('./');
  await page.locator('.card', { hasText: 'Monstera' }).click();
  await expect(page.locator('.tl').getByText('300 mL')).toBeVisible();
  await page.screenshot({ path: info.outputPath('fiche.png') });
  expect(errors).toEqual([]);
});
