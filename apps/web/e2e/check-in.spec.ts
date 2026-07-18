import { test, expect } from '@playwright/test';

async function loginAsDemoStaff(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /resepsiyon/i }).click();
  await page.getByRole('button', { name: /^giriş yap$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Salon girişi (check-in)', () => {
  test('resepsiyon check-in ekranını görüntüleyebilir', async ({ page }) => {
    await loginAsDemoStaff(page);
    await page.goto('/dashboard/check-in');

    await expect(page.getByRole('heading', { name: /salon girişi/i })).toBeVisible();
    await expect(page.getByText(/bugün giriş/i)).toBeVisible();
  });
});
