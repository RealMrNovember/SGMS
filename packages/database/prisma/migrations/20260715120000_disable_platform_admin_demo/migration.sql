-- "Platform Admin" demo girişi (admin@demo.sgms.local) login ekranından kaldırıldı:
-- prospektif salon müşterilerine tüm kiracıları yöneten iç Master Admin panelini
-- göstermenin bir anlamı yok. Buton kaldırılmasının yanında, halka açık olan bu
-- demo şifresiyle giriş tamamen engellensin diye hesap DISABLED durumuna alınır
-- (bkz. apps/web/src/lib/auth.ts — status !== 'ACTIVE' girişi reddeder).
-- Gerçek Master Admin hesabı (admin@cicibyte.com / mozkarci1991@gmail.com) bundan etkilenmez.
UPDATE "users" SET "status" = 'DISABLED'
WHERE "email" = 'admin@demo.sgms.local' AND "is_demo" = true;
