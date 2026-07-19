import { test, expect } from '@playwright/test';
import { registerFreshOrg } from './helpers/register-org';

test.describe('Kasa vardiyası (Faz 25)', () => {
  test('yeni salon vardiya açıp kapatabiliyor, Z raporu görünüyor', async ({ page }) => {
    // Bu test 2FA kurulumu + yeni salon kaydı + birden fazla rota (ilk ziyarette `next dev`
    // cold-compile) içerdiğinden varsayılan 30s'den daha uzun sürebilir.
    test.setTimeout(60_000);
    await registerFreshOrg(page);

    await page.goto('/dashboard/pos');
    await expect(page.getByText(/nakit tahsilat için vardiya açık olmalıdır/i)).toBeVisible();

    await page.getByLabel(/açılış bakiyesi/i).fill('100');
    await page.getByRole('button', { name: /^vardiya aç$/i }).click();

    await expect(page.getByText(/açık vardiya/i)).toBeVisible();

    await page.getByRole('button', { name: /^x raporu$/i }).click();
    await expect(page.getByText(/vardiya özeti/i)).toBeVisible();
    await expect(page.getByText(/beklenen kasa/i)).toBeVisible();

    await page.getByLabel(/sayılan kasa/i).fill('100');
    await page.getByRole('button', { name: /vardiya kapat/i }).click();

    await expect(page.getByText(/^vardiya aç$/i)).toBeVisible();

    await page.goto('/dashboard/pos/shifts');
    await expect(page.getByText(/100/).first()).toBeVisible();
  });
});
