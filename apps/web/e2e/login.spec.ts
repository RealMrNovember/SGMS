import { test, expect } from '@playwright/test';

test.describe('Giriş akışı', () => {
  test('demo salon sahibi tek tıkla giriş yapabilir', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /salon sahibi/i }).click();
    await page.getByRole('button', { name: /^giriş yap$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/hoş geldiniz/i)).toBeVisible();
  });

  test('demo resepsiyon (staff) girişi salon paneline yönlenir', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /resepsiyon/i }).click();
    await page.getByRole('button', { name: /^giriş yap$/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('hatalı parola ile giriş reddedilir', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-posta/i).fill('owner@demo-gym.local');
    await page.getByLabel(/^parola$/i).fill('yanlis-parola');
    await page.getByRole('button', { name: /^giriş yap$/i }).click();

    await expect(page.getByText(/e-posta veya parola hatalı/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
