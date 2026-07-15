export type DemoAccountKey = 'owner' | 'staff' | 'athlete';

export type DemoAccount = {
  key: DemoAccountKey;
  email: string;
  password: string;
};

/**
 * Login sayfasındaki tek tıkla demo giriş butonları. Platform Admin (Master Admin)
 * demosu kasıtlı olarak burada yok — prospektif salon müşterilerine tüm kiracıları
 * yöneten iç panelin gösterilmesi anlamsız; hesabı kaldırmak yerine `is_demo` +
 * `DISABLED` durumuna alınarak giriş tamamen engellendi (bkz. seed.ts).
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: 'owner', email: 'owner@demo-gym.local', password: 'Owner123!' },
  { key: 'staff', email: 'staff@demo-gym.local', password: 'Staff123!' },
  { key: 'athlete', email: 'athlete@demo-gym.local', password: 'Athlete123!' },
];
