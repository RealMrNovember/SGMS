import { expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';

export type FreshOrgAccount = {
  email: string;
  password: string;
  gymName: string;
};

/**
 * Gerçek /trial kayıt akışını kullanarak yeni, demo OLMAYAN bir organizasyon + OWNER
 * hesabı oluşturur. Demo hesaplar (owner@demo-gym.local vb.) `isDemo: true` olduğundan
 * hiçbir yazma işlemine izin vermez — kasa vardiyası, misafir izni, HR gibi write-flow
 * testleri gerçek bir hesap gerektirir. Her çağrı benzersiz bir e-posta üretir, böylece
 * testler birbirinin verisiyle çakışmaz.
 */
export async function registerFreshOrg(page: Page): Promise<FreshOrgAccount> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const account: FreshOrgAccount = {
    email: `e2e-${unique}@example.com`,
    password: 'E2ePass123!',
    gymName: `E2E Test Gym ${unique}`,
  };

  await page.goto('/trial');
  await page.getByLabel(/işletme adı/i).fill(account.gymName);
  await page.getByLabel(/yönetici adı/i).fill('E2E Test Owner');
  await page.getByLabel(/yönetici e-posta/i).fill(account.email);
  await page.getByLabel(/^parola$/i).fill(account.password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /denemeyi başlat/i }).click();

  await page.getByRole('link', { name: /yönetim paneline giriş/i }).click();
  await page.getByLabel(/^parola$/i).fill(account.password);
  await page.getByRole('button', { name: /^giriş yap$/i }).click();
  await page.waitForURL(/\/dashboard/);

  await completeMandatoryTwoFactorSetup(page);

  return account;
}

/**
 * OWNER/ADMIN rolü için 2FA zorunludur (bkz. Faz 18) — yeni bir hesap ilk girişte
 * /dashboard/account/security'ye yönlendirilir ve kurulum tamamlanmadan başka hiçbir
 * sayfaya gidemez. Test ortamında gerçek bir telefonla QR okutamayacağımız için
 * ekranda düz metin olarak gösterilen anahtarı `otplib` ile kodu üretmek için kullanırız.
 */
async function completeMandatoryTwoFactorSetup(page: Page): Promise<void> {
  await page.goto('/dashboard/account/security');

  const alreadyEnabled = await page.getByText(/^Etkin$/).isVisible().catch(() => false);
  if (alreadyEnabled) {
    return;
  }

  await page.getByRole('button', { name: /kuruluma başla/i }).click();
  const secret = await page.locator('span.font-mono').innerText();
  const code = authenticator.generate(secret.trim());

  await page.getByPlaceholder('123456').fill(code);
  await page.getByRole('button', { name: /doğrula ve etkinleştir/i }).click();

  await expect(page.getByText(/yedek kodlarınız/i)).toBeVisible();
  await page.getByRole('button', { name: /kaydettim, devam et/i }).click();
}
