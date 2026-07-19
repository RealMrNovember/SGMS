import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // `next dev` derlemeyi rota bazında ve sırayla yapar — paralel worker'lar aynı anda
  // birden fazla rotayı tetikleyince (ör. aynı demo hesapla eşzamanlı login) tutarsız
  // sonuçlar çıkabiliyor. CI önceden build edilmiş (`next start`) sunucuyu kullandığı
  // için orada paralellik güvenli.
  workers: process.env.CI ? 2 : 1,
  reporter: [['list']],
  // Next dev sadece ilk ziyarette rota derler (cold compile) — bekleme listesi/dashboard gibi
  // ağır server component'lerde bu birkaç saniye sürebilir; varsayılan 5s expect timeout'u
  // ilk hit'te yanlış negatif verir.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'tr-TR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // CI'da önceden build edilmiş uygulamayı (`next start`) kullan — daha hızlı ve daha
    // gerçekçi; lokal geliştirmede `next dev` hot-reload için tercih edilir.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
