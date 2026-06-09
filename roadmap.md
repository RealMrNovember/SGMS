# CiCiByte SGMS — Product & Technical Roadmap

| Alan | Değer |
|------|--------|
| **Proje** | Smart Gym Management System (B2B Multi-Tenant SaaS) |
| **VDS** | `/www/wwwroot/sgms.cicibyte.com` → `sgms.cicibyte.com` |
| **Repo** | https://github.com/RealMrNovember/SGMS.git |
| **Strateji** | Local geliştir → Git push → VDS `git pull` (`www:www`) |
| **Komşu (dokunulmaz)** | `license.cicibyte.com` |
| **Kaynak doküman** | `sgms.cicibyte.com - readme.md`, `CiCiByte_SGMS_Ultimate_Enterprise_Blueprint.docx` |

**Son güncelleme:** 2026-06-08 · **HEAD:** `cc01f73` _(yerel — Faz 3–5 tamam, commit bekliyor)_

---

## Durum Özeti

| Faz | Ad | Durum | İlerleme |
|-----|-----|--------|----------|
| 0 | Altyapı & Monorepo | ✅ Tamamlandı | 100% |
| 1 | Veritabanı & Web Paneli | ✅ Tamamlandı | 100% |
| 2 | Multi-Tenant Core & API v1 | ✅ Tamamlandı | 100% |
| 3 | Production & Operasyon | ✅ Tamamlandı | 100% |
| 4 | Tenant UI — Core İş Mantığı | ✅ Tamamlandı | 100% |
| 5 | Merkezi Lisans Entegrasyonu | ✅ Tamamlandı | 100% |
| 6 | Mobil & Sporcu Auth (API-First) | 🔲 Sırada | 0% |
| 7 | Turnike & Cihaz Sync | 🔲 Planlandı | 0% |
| 8 | Real-Time & Bildirimler | 🔲 Planlandı | 0% |

> **Not:** Faz 4–8 sırası bağımlılık optimizasyonuna göre belirlenmiştir. Önce production (Faz 3), ardından panelde eksik iş mantığı (Faz 4), sonra dış istemciler (Faz 6–8).

---

## ✅ Faz 0 — Altyapı ve Repo (Tamamlandı)

- [x] Monorepo iskeleti (`pnpm-workspace.yaml`, `apps/*`, `packages/*`)
- [x] Docker: PostgreSQL 16 + Redis 7 (`infra/docker/docker-compose.yml`)
- [x] VDS volume: `data/{postgres,redis}` · bind mount
- [x] aaPanel `www:www` sahiplik + `vds-bootstrap.sh`
- [x] Git remote → GitHub (`RealMrNovember/SGMS`)
- [x] Proje içi Node 20 (`.tools/node`), PM2 (`.pm2`), loglar (`logs/pm2`)
- [x] `ecosystem.config.cjs`, `production-bootstrap.sh`, `systemd/sgms-pm2.service`
- [x] `@reboot` crontab → `pm2 resurrect`

**Çıktılar:** `sgms-postgres` (5432), `sgms-redis` (6380), `sgms-web` (3100)

---

## ✅ Faz 1 — Veritabanı ve Yönetim Paneli (Tamamlandı)

### Veritabanı
- [x] Prisma şema + client (`packages/database`)
- [x] Migration `20260605191622_init`
- [x] SaaS plan seed (Starter / Pro / Enterprise / Franchise × TRY/USD/AZN)
- [x] Migration `20260608193638_add_superadmin_flag`
- [x] Migration `20260608194923_add_gym_member_models` (`GymMember`, `GymMembershipPlan`)

### Kimlik & RBAC
- [x] NextAuth v5 (Credentials + JWT)
- [x] Session: `organizationId`, `role`, `isSuperAdmin`
- [x] Middleware: Super Admin → `/admin` · Tenant → `/dashboard`

### Paneller
- [x] Super Admin: `/admin` — sistem özeti, org listesi, yeni müşteri (`/admin/organizations/new`)
- [x] Tenant: `/dashboard` — özet
- [x] Tenant: `/dashboard/team` — personel davet (OWNER/ADMIN)
- [x] Tenant: `/dashboard/members` — sporcu kaydı (OWNER/ADMIN/STAFF)

### Seed hesapları (demo-gym)
| Rol | E-posta | Parola |
|-----|---------|--------|
| Super Admin | `admin@demo.sgms.local` | `Admin123!` |
| Gym OWNER | `owner@demo-gym.local` | `Owner123!` |
| TRAINER | `trainer@demo-gym.local` | `Trainer123!` |
| Sporcu (User) | `athlete@demo-gym.local` | `Athlete123!` |

---

## ✅ Faz 2 — Multi-Tenant Core & API v1 (Tamamlandı)

### Veritabanı (Core ekosistem)
- [x] Migration `20260608210000_add_core_ecosystem_models`
- [x] `GymMember.userId` + `trainerId` (sporcu girişi + PT bağlantısı)
- [x] `HealthMeasurement`, `TrainingProgram`, `DirectMessage`
- [x] `organizationId` denormalizasyonu (tenant izolasyonu)
- [x] Demo seed: ölçüm + WORKOUT programı

### API v1 (Route Handlers)
- [x] `GET/POST /api/v1/members`
- [x] `GET/POST /api/v1/measurements`
- [x] `GET/POST /api/v1/programs`
- [x] `GET/POST /api/v1/messages`
- [x] `lib/api/guard.ts` — NextAuth session + rol + org doğrulama
- [x] Middleware: API → `401 JSON` (HTML redirect yok)

**Eksik (bilinçli erteleme):** Bearer token, OpenAPI spec, `PATCH`/`DELETE`, sporcu-oturumu API guard

---

## ✅ Faz 3 — Production & Operasyon (Tamamlandı)

> Canlı ortam doğrulandı; deploy script ve smoke test eklendi.

### 3.1 Nginx & TLS
- [x] aaPanel `sgms.cicibyte.com` → reverse proxy `127.0.0.1:3100`
- [x] `/_next/static/` Nginx alias (`sgms.cicibyte.com.conf`)
- [ ] Site PHP → Static (aaPanel manuel — kök `index.html` artefaktı; proxy çalışıyor)
- [x] TLS / Cloudflare — `https://sgms.cicibyte.com/login` → 200
- [x] `AUTH_URL` = `https://sgms.cicibyte.com` (`apps/web/.env.local`)

**Kabul kriteri:** ✅ login 200 · API anonim → 401 JSON

### 3.2 Deploy otomasyonu
- [x] `docs/deployment/deploy.sh` — pull + install + migrate + build + pm2 reload
- [x] `docs/deployment/verify-production.sh` — smoke test
- [x] Rollback notu (`deploy.sh` üst bilgi)
- [x] `pnpm db:migrate:deploy` + `pnpm deploy:verify` (`package.json`)

**Kabul kriteri:** ✅ tek komut deploy yolu hazır

### 3.3 Gözlemlenebilirlik (minimal)
- [x] PM2 log rotasyonu (`ecosystem.config.cjs`: `max_size`, `retain`)
- [x] Docker healthcheck cron (`docs/deployment/healthcheck-docker.sh`)

**Bağımlılık:** Faz 0–2 tamamlandı ✅

---

## ✅ Faz 4 — Tenant UI: Core İş Mantığı (Tamamlandı)

> **Ertelenen (sonraki fazlara):** mesaj thread görünümü (Faz 8), sporcu read-only portal (Faz 6).

### 4.1 Sağlık ölçümleri UI
- [x] `/dashboard/members/[id]/measurements` — liste + kilo trend grafiği
- [x] Ölçüm ekleme formu (TRAINER, OWNER, ADMIN, STAFF)
- [x] `actions/measurements.ts` Server Action (API ile parity)
- [ ] Sporcu read-only görünümü (Faz 6 athlete portal)

### 4.2 Antrenman & diyet programları UI
- [x] `/dashboard/programs` — PT program listesi
- [x] Program oluşturma: `WORKOUT` / `NUTRITION` + JSON/metin içerik
- [x] Sporcu bazlı filtre (`?member=`)
- [x] Program aktif/pasif toggle (`actions/programs.ts`)

### 4.3 Mesajlaşma UI
- [x] `/dashboard/messages` — inbox / sent
- [x] Okundu işaretleme (`markMessageRead`)
- [ ] Thread görünümü (şu an liste; konuşma gruplama sonraki iterasyon)

### 4.4 Salon üyelik planları yönetimi
- [x] `/dashboard/plans` — `GymMembershipPlan` CRUD (OWNER/ADMIN)
- [x] `actions/plans.ts` — oluştur, güncelle, aktif/pasif toggle
- [x] Üye formunda plan seçimi aktif listeden (`/dashboard/members`)

### 4.5 Sporcu detay sayfası (CRM çekirdeği)
- [x] `/dashboard/members/[id]` — tek Prisma sorgusu (`include`: ölçümler + aktif programlar)
- [x] Tenant izolasyonu (`organizationId` eşleşmesi → `notFound`)
- [x] `AddMeasurementForm` + tam ölçüm geçmişi tablosu (`MemberHealthHistoryTable`)
- [x] `MEASUREMENT_ADDED` audit + transaction (`actions/measurements.ts`)
- [x] Ölçüm alt sayfası (`/measurements`) + üye listesinden profil linki

**Kabul kriteri:** ✅ OWNER/TRAINER ile ölçüm → program → mesaj → plan akışı panelden mümkün

**Bağımlılık:** Faz 2 ✅ · Faz 3 ✅

---

## ✅ Faz 5 — Merkezi Lisans Entegrasyonu (Tamamlandı)

> **Strateji:** `license.cicibyte.com` HTTP client; komşu proje dokunulmadı.

### 5.1 license-client bağlama
- [x] `packages/license-client` → org `installationId` / `centralLicenseKey` senkronu
- [x] Salon oluşturulduğunda trial (`bootstrapOrganizationLicense` → `ensureOrganizationLicense`)
- [x] Giriş hook: `syncLicenseOnLogin` (`auth.ts`)
- [x] Periyodik heartbeat: `pnpm license:heartbeat` + `docs/deployment/license-heartbeat.sh`
- [x] `Organization.centralLicenseStatus` + `licenseExpiresAt` güncelleme
- [x] Panel: özet kartı + `LicenseStatusBanner` (trial / süresi doldu uyarısı)

### 5.2 Tenant limit enforcement
- [x] `lib/tenant-access.ts` — `maxMembers`, `maxStaff`, `maxDevices` kontrolleri
- [x] Server Action + API v1 POST → `getTenantWriteBlockReason` (salt okunur mod)
- [x] Lisans `EXPIRED` / `REVOKED` → yazma işlemleri engellenir

### 5.3 (Opsiyonel) `apps/license-api`
- [ ] Ertelendi — merkezi sunucu yeterli

**Kabul kriteri:** ✅ `demo-gym` girişinde lisans senkronu; panelde durum + banner

**Bağımlılık:** Faz 3 ✅ · `license.cicibyte.com` **dokunulmaz**

---

## 🔲 Faz 6 — Mobil & Sporcu Auth — API-First (Öncelik: P1)

> **Hedef:** Mobil uygulama ve sporcu self-service; cookie yerine Bearer.

### 6.1 API token katmanı
- [ ] `ApiToken` modeli veya NextAuth JWT Bearer export
- [ ] `POST /api/v1/auth/login` → `{ accessToken, expiresAt }`
- [ ] `lib/api/guard.ts` — `Authorization: Bearer` desteği
- [ ] Token revoke listesi (Redis)

### 6.2 Sporcu oturumu
- [ ] `GymMember.userId` ile giriş → session'da `gymMemberId` claim
- [ ] Sporcu rolü: yalnızca kendi ölçüm/program/mesajları
- [ ] `/api/v1/me` — profil + aktif üyelik

### 6.3 API tamamlama
- [ ] `PATCH`/`DELETE` üyeler, ölçümler, programlar
- [ ] Sayfalama (`cursor`, `limit`) tüm listelerde
- [ ] OpenAPI 3.1 spec (`docs/api/openapi.yaml`)
- [ ] Hata kodu standardı (`code`, `message`, `details`)

### 6.4 Sporcu web portalı (hafif)
- [ ] `/athlete` veya `/app` route group — mobil uyumlu
- [ ] Aktif program, son ölçüm, mesajlar

**Kabul kriteri:** `athlete@demo-gym.local` Bearer ile mobil simülasyon (curl/Postman)

**Bağımlılık:** Faz 4 (iş kuralları net) · Faz 5 (limitler)

---

## 🔲 Faz 7 — Turnike & Cihaz Sync (Öncelik: P2)

> **Hedef:** Masaüstü turnike offline/online; `Device` modeli hazır.

### 7.1 Device API
- [ ] `POST /api/v1/devices/register` — `hardwareId`, org pairing
- [ ] Device API key (org + device scoped)
- [ ] `POST /api/v1/check-in` — `gymMemberId` veya QR/nfc payload

### 7.2 Offline sync
- [ ] `SyncBatch` modeli — queued events, `deviceId`, `syncedAt`
- [ ] `POST /api/v1/sync/push` + `GET /api/v1/sync/pull`
- [ ] Çakışma çözümü (last-write-wins + audit)

### 7.3 Turnike istemci sözleşmesi
- [ ] `docs/api/turnstile-protocol.md`
- [ ] Heartbeat: `Device.lastSeenAt`, `status: ONLINE`

**Kabul kriteri:** Emülatör ile offline check-in → online sync → `AuditLog`

**Bağımlılık:** Faz 6 (API auth) · Faz 5 (cihaz limiti)

---

## 🔲 Faz 8 — Real-Time & Bildirimler (Öncelik: P3)

- [ ] WebSocket veya SSE (`/api/v1/messages/stream`)
- [ ] Push (FCM/APNs) gateway abstraction
- [ ] Bildirim tercihleri (org + user)
- [ ] Program atandı / ölçüm hatırlatma / mesaj event'leri

**Bağımlılık:** Faz 4 (mesaj UI) · Faz 6 (mobil token)

---

## Teknik Borç & İyileştirmeler (Paralel)

| Öğe | Öncelik | Not |
|-----|---------|-----|
| Monorepo yapısı readme'de güncelle (`apps/web`, API v1) | P2 | `sgms.cicibyte.com - readme.md` |
| `readme.md` ↔ `roadmap.md` çapraz link | P2 | Bu dosya |
| E2E testler (Playwright) — login, üye ekle, API | P2 | Faz 4 sonrası |
| Prisma `migrate dev` → CI'da `migrate deploy` | P1 | Faz 3 deploy script |
| Super Admin: org detay + askıya alma | P2 | Operasyonel |
| i18n (TR/EN) | P3 | Blueprint Faz 8 referans |

---

## Önerilen Build Sırası (Özet)

```text
1. Faz 3  → Production (Nginx/TLS/deploy)     ✅
2. Faz 4  → Tenant UI (ölçüm, program, mesaj, plan)  ✅
3. Faz 5  → license.cicibyte.com entegrasyonu        ✅
4. Faz 6  → Bearer auth + sporcu API/portal          ← ŞİMDİ
5. Faz 7  → Turnike sync
6. Faz 8  → Real-time & push
```

---

## Hızlı Komutlar (VDS)

```bash
cd /www/wwwroot/sgms.cicibyte.com
pnpm install
pnpm db:migrate:deploy   # packages/database
pnpm db:seed
pnpm web:build
pnpm pm2:reload
sudo bash docs/deployment/deploy.sh      # tam deploy
pnpm deploy:verify                       # smoke test
pnpm license:heartbeat                   # merkezi lisans sync
```

---

## Referanslar

- Teknik günlük: [`sgms.cicibyte.com - readme.md`](./sgms.cicibyte.com%20-%20readme.md)
- Nginx: [`docs/deployment/NGINX-AAPANEL.md`](./docs/deployment/NGINX-AAPANEL.md)
- API guard: `apps/web/src/lib/api/guard.ts`
- Prisma: `packages/database/prisma/schema.prisma`
