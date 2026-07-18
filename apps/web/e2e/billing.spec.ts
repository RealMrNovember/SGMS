import { test, expect } from '@playwright/test';

async function loginAsDemoOwner(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /salon sahibi/i }).click();
  await page.getByRole('button', { name: /^giriş yap$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Abonelik & Ödeme', () => {
  test('salon sahibi planları ve ödeme seçeneklerini görebilir', async ({ page }) => {
    await loginAsDemoOwner(page);
    await page.goto('/dashboard/billing');

    await expect(page.getByRole('heading', { name: /abonelik & ödeme|deneme süreniz sona erdi/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /kartla öde/i })).toBeVisible();
  });
});
