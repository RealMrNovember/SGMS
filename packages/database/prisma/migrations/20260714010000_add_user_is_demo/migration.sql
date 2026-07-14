-- Demo hesapları (login sayfasındaki tek tıkla giriş butonları) için salt-okunur bayrak.
-- Var olan tüm kullanıcılar için varsayılan false; demo hesaplar aşağıda elle işaretlenir.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- Bilinen demo giriş adresleri (apps/web/src/lib/demo-accounts.ts) — yazma engeli bunlara uygulanır.
UPDATE "users" SET "is_demo" = true
WHERE "email" IN (
  'admin@demo.sgms.local',
  'owner@demo-gym.local',
  'staff@demo-gym.local',
  'trainer@demo-gym.local',
  'athlete@demo-gym.local'
);
