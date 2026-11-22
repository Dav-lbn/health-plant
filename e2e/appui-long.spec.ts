import { test, expect } from '@playwright/test';

test('faire défiler les soins n’ouvre pas la fenêtre de soin', async ({ page }) => {
  await page.goto('./#/nouvelle-plante');
  await page.getByLabel('Nom *').fill('Ficus');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('heading', { name: 'Ficus', level: 1 })).toBeVisible();

  const btn = page.getByRole('button', { name: 'Engrais' });
  await btn.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
  await btn.dispatchEvent('pointercancel', { pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(800);
  await expect(page.getByRole('form', { name: 'Engrais' })).toHaveCount(0);
});
