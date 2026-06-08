# CiCiByte SGMS — Smart Gym Management System

| Ortam | Yol |
|--------|-----|
| **Blueprint** | `CiCiByte_SGMS_Ultimate_Enterprise_Blueprint.docx` |
| **VDS (aaPanel)** | `/www/wwwroot/sgms.cicibyte.com` → `sgms.cicibyte.com` |
| **Komşu (mevcut)** | `license.cicibyte.com` — aynı `wwwroot` altında; **dokunulmaz** |
| **Local** | `C:\Users\Admin\Cicibyte Projects\SGMS` |
| **Sunucu IP** | `31.40.199.47` |

Strateji: **Local geliştir → Git push → VDS `git pull` (aaPanel `www:www`)**

---

## Faz 1 — Checklist (güncel durum)

> **Teknik günlük:** Tamamlanan fazların altındaki özetler arşiv niteliğindedir. Gelecek işler **Henüz Başlanmamış** ve **Gelecek Planları** bölümlerinde korunur.

### 0 — Altyapı ve repo ✅ tamamlandı

- [x] Monorepo iskeleti (`pnpm-workspace.yaml`, `package.json`)
- [x] `infra/docker/docker-compose.yml` (PostgreSQL 16 + Redis 7)
- [x] VDS volume yolu: `/www/wwwroot/sgms.cicibyte.com/data`
- [x] `.gitignore` + `docs/deployment/vds-bootstrap.sh` (aaPanel `www:www`)
- [x] `readme.md` Faz 1 checklist
- [x] Git: `git init` + ilk commit (local)
- [x] VDS: `/www/wwwroot/sgms.cicibyte.com` + `www:www`
- [x] VDS: `data/postgres`, `data/redis`
- [x] Git: remote + VDS `git clone` → `https://github.com/RealMrNovember/SGMS.git`
- [x] VDS: `infra/docker/.env` (güçlü şifreler, `SGMS_DATA_DIR` ayarlı)
- [x] VDS: Docker kurulu + `docker compose up -d`
- [x] VDS: `sgms-postgres` + `sgms-redis` Up (Redis port **6380** — sistem 6379 kullanımda)

#### Teknik özet (Faz 0)

- Postgres 16 + Redis 7 Docker stack; veri bind mount: `data/{postgres,redis}`
- aaPanel `www:www` sahiplik politikası; `license.cicibyte.com` dizinine dokunulmaz
- Proje içi Node 20 (`.tools/node`), PM2 state (`.pm2`), loglar (`logs/pm2`)
- `docs/deployment/production-bootstrap.sh`, `ecosystem.config.cjs`, `systemd/sgms-pm2.service`

### 1 — Veritabanı ve Web Paneli ✅ tamamlandı

- [x] `packages/database` — Prisma şema
- [x] İlk migration (`20260605191622_init`)
- [x] Plan seed (Starter / Pro / Enterprise / Franchise — TRY / USD / AZN)
- [x] Web Paneli (Next.js) İskeleti — NextAuth v5, login, dashboard, middleware
- [x] `ecosystem.config.cjs` + PM2 production script’leri
- [x] `isSuperAdmin` flag + migration (`20260608193638_add_superadmin_flag`)
- [x] Super Admin paneli (`/admin`) + organizasyon oluşturma Server Action
- [x] Tenant dashboard (`(tenant)/dashboard`) — personel (`/team`) ve üye (`/members`) yönetimi
- [x] `GymMember` + `GymMembershipPlan` modelleri + migration (`20260608194923_add_gym_member_models`)

#### Teknik özet (Faz 1)

- **Prisma:** `User`, `Organization`, `Plan`, `Subscription`, `GymMember`, `GymMembershipPlan`, `AuditLog`
- **Auth:** NextAuth v5 Credentials + JWT; session alanları: `organizationId`, `role`, `isSuperAdmin`
- **RBAC middleware:** Super Admin → `/admin`; tenant → `/dashboard`; çapraz erişim engelli
- **PM2:** `sgms-web` port `127.0.0.1:3100`; `@reboot` crontab ile `pm2 resurrect`
- **Seed hesapları:** `admin@demo.sgms.local`, `owner@demo-gym.local`, `trainer@demo-gym.local`, `athlete@demo-gym.local`

### 2 — Multi-Tenant Core & API-First ✅ tamamlandı

- [x] Core ekosistem migration (`20260608210000_add_core_ecosystem_models`)
- [x] `GymMember.userId` + `trainerId` (sporcu girişi ve PT bağlantısı)
- [x] `HealthMeasurement`, `TrainingProgram`, `DirectMessage` modelleri
- [x] `organizationId` denormalizasyonu (tenant izolasyonu)
- [x] API v1 iskeleti: `/api/v1/members`, `/measurements`, `/programs`, `/messages`
- [x] API guard (`lib/api/guard.ts`) — NextAuth session + rol + org doğrulama
- [x] Demo seed: PT ↔ sporcu ↔ ölçüm ↔ antrenman programı
- [x] GitHub senkron: VDS → `origin/main` (`cc01f73`)

#### Teknik özet (Faz 2)

- **Modeller:** `HealthMeasurement`, `TrainingProgram` (`WORKOUT` / `NUTRITION`), `DirectMessage`
- **API v1:** Route Handlers; middleware API için `401 JSON` (redirect yok)
- **RBAC (API):** OWNER/ADMIN/STAFF/TRAINER tenant rolleri; Super Admin tenant API’ye erişemez
- **Audit:** `MEMBER_REGISTERED`, `MEMBER_INVITED`, `MEMBER_UPDATED` (API kaynaklı işlemler dahil)
- **Sonraki API adımı (planlı):** Mobil Bearer token, turnike device key — henüz uygulanmadı

#### Lisans Sunucusu Haberleşme Protokolü (`license.cicibyte.com`)

> **Kaynak:** Salt okunur analiz — `license.cicibyte.com` koduna yazma yapılmadı. GarageLedger (`garageledger`) entegrasyonu referans alındı.

**Mimari özeti:** Merkezi Laravel API; istemciler (GarageLedger, SGMS) **aynı sunucu geneli API anahtarını** paylaşır, ürün ayrımı istek gövdesindeki **`app_code`** ile yapılır. JWT, domain whitelist veya uygulama bazlı secret key **yoktur**.

| Katman | Mekanizma | Dosya / konum |
|--------|-----------|----------------|
| API kimlik doğrulama | `X-Api-Key` header ↔ `LICENSE_API_KEY` (`.env`) | `app/Http/Middleware/VerifyApiKey.php`, `config/license.php` |
| Boş anahtar | `LICENSE_API_KEY` boşsa middleware **atlanır** (yalnızca geliştirme) | `VerifyApiKey.php` satır 15–17 |
| Route koruması | `api.key` + `throttle:license-api` (60/dk/IP) | `routes/api.php`, `AppServiceProvider.php` |
| Ürün seçimi | `app_code` → `applications` tablosu (`name`, `app_code`, `is_active`) | `LicenseService::findApplication()` |
| Tenant eşlemesi | `hwid` → `licenses` + `license_devices` (cihaz başına kayıt) | `LicenseService::validateHwid()` / `trial()` |
| Lisans anahtarı | `license_key` yalnızca `/activate` için; trial'da otomatik üretilir | `licenses.license_key` |

**Endpoint'ler** (`POST https://license.cicibyte.com/api/v1/license/...`):

| Yol | Gövde (zorunlu) | Amaç |
|-----|-----------------|------|
| `/trial` | `app_code`, `hwid` (+ opsiyonel `client_name`, `email`) | İlk kurulum — 14 gün deneme |
| `/activate` | `app_code`, `license_key`, `hwid` | Üretim lisansı bağlama |
| `/check` | `app_code`, `hwid` | Periyodik doğrulama (**önerilen**; WAF `verify`'ı engelleyebilir) |
| `/verify`, `/heartbeat` | `/check` ile aynı handler | Geriye dönük uyumluluk |

**Standart yanıt:**

```json
{
  "success": true,
  "data": {
    "status": "active",
    "type": "trial",
    "expires_at": "2026-06-22T12:00:00+04:00",
    "hwid": "<uuid>",
    "max_devices": 3,
    "registered_devices": 1
  },
  "message": "Lisans doğrulandı."
}
```

**GarageLedger nasıl kullanıyor?** (`garageledger.cicibyte.com/saas/backend`)

- Env: `LICENSE_API_BASE`, `LICENSE_API_KEY`, `LICENSE_APP_CODE=garageledger`
- Her istekte header: `X-Api-Key: <LICENSE_API_KEY>`
- `hwid` = organizasyon `licenseAnchorId` (kayıt sırasında üretilen UUID)
- Akış: kayıt → `POST /trial` → giriş/kota → `POST /check`
- İstemci: `src/lib/licenseClient.ts` (GarageLedger kodu **değiştirilmedi**)

**SGMS eşlemesi** (`packages/license-client` + `apps/web/src/lib/license.ts`):

| GarageLedger | SGMS |
|--------------|------|
| `LICENSE_APP_CODE=garageledger` | `LICENSE_APP_CODE=sgms` |
| `licenseAnchorId` | `Organization.installationId` |
| Kayıt sonrası `startTrial()` | Super Admin org oluşturma → `bootstrapOrganizationLicense()` |
| Login `checkLicense()` | Tenant login → `syncLicenseOnLogin()` |
| Cron heartbeat | `pnpm license:heartbeat` |

**SGMS bağlantı adımları (GarageLedger'ı bozmadan):**

1. **Merkezi panel (Filament):** Uygulamalar → `sgms` kaydı (`is_active`). `garageledger` kaydına dokunulmaz.
2. **Paylaşılan API anahtarı:** `license.cicibyte.com` `.env` içindeki `LICENSE_API_KEY` değerini SGMS `apps/web/.env.local` → `LICENSE_API_KEY` olarak kopyalayın. *(GarageLedger ile aynı sunucu anahtarı — ürünler `app_code` ile ayrılır.)*
3. **SGMS env:** `LICENSE_API_BASE_URL=https://license.cicibyte.com`, `LICENSE_APP_CODE=sgms`
4. **İlk trial:** Yeni salon `installationId` (UUID) otomatik `hwid` olarak `/trial`'a gider.
5. **Doğrulama:** Owner girişi veya `pnpm license:heartbeat` → `/check` → `Organization.centralLicenseStatus` güncellenir.
6. **Çakışma yok:** Farklı `app_code` + farklı `hwid` → `licenses` tablosunda tamamen ayrı satırlar.

**Hata kodları:** `401` API anahtarı · `403` lisans/cihaz limiti · `404` uygulama veya hwid · `409` trial zaten var · `422` validasyon · `429` rate limit

### 2 — Merkezi Lisans Entegrasyonu [x] TAMAMLANDI

- [x] `packages/license-client` → `license.cicibyte.com` HTTP client (GarageLedger protokolü ile uyumlu)
- [x] Shared `LICENSE_API_KEY` + `app_code=sgms` ayrımı
- [x] Org oluşturma / giriş / heartbeat senkronu
- [x] Tenant dashboard özet kartlarında merkezi lisans durumu

> **Bağlantı notu (2026-06-08):** Lisans sunucusu ile el sıkışma sağlandı, shared key aktif. `pnpm license:heartbeat` → `demo-gym` + `test-salon` trial_started.

---

## Henüz Başlanmamış

### 2 — Yerel License API (opsiyonel)

- [ ] `apps/license-api` (NestJS) — yalnızca merkezi sunucudan bağımsız senaryo için

> **Not:** Merkezi entegrasyon tamamlandı (`packages/license-client` → `license.cicibyte.com`). Eksik operasyonel adım: Filament'te `sgms` uygulama kaydı + `LICENSE_API_KEY` env doldurma (yukarıdaki protokol notu).

---

## Gelecek Planları

### 3 — Operasyon

- [ ] aaPanel Nginx site → API proxy (mevcut `license` vhost’una **dokunmadan**)
- [ ] TLS
- [ ] CI/CD deploy script

### 4 — Mobil, Turnike ve Gelişmiş API

- [ ] Mobil uygulama Bearer / API token auth
- [ ] Turnike (desktop) offline/online sync API
- [ ] Sporcu self-service portal (GymMember `userId` oturumu)
- [ ] Push bildirimleri ve mesajlaşma real-time katmanı

---

## aaPanel dizin politikası

- Tüm dosyalar: **`/www/wwwroot/sgms.cicibyte.com`**
- Sahiplik: **`www:www`** — `chown -R www:www /www/wwwroot/sgms.cicibyte.com`
- Docker veri bind mount: **`/www/wwwroot/sgms.cicibyte.com/data/{postgres,redis}`**
- `license.cicibyte.com` kurulumu **değiştirilmez**; SGMS yalnızca kendi dizininde çalışır.

---

## Monorepo yapısı

```text
sgms/
├── apps/
├── packages/
├── infra/docker/
│   ├── docker-compose.yml
│   ├── .env.example          # local
│   └── .env.vds.example      # VDS şablonu
├── docs/deployment/
│   └── vds-bootstrap.sh
├── package.json
└── pnpm-workspace.yaml
```

---

## VDS — Adım 0 (Remote SSH terminalinde çalıştırın)

Cursor’da **Remote SSH → 31.40.199.47** bağlı terminalde:

```bash
# Dizin + izinler (aaPanel standardı)
sudo mkdir -p /www/wwwroot/sgms.cicibyte.com/data/postgres
sudo mkdir -p /www/wwwroot/sgms.cicibyte.com/data/redis
sudo chown -R www:www /www/wwwroot/sgms.cicibyte.com
sudo chmod -R 755 /www/wwwroot/sgms.cicibyte.com
sudo chmod -R 770 /www/wwwroot/sgms.cicibyte.com/data

# Doğrulama
ls -la /www/wwwroot/ | grep sgms
ls -la /www/wwwroot/sgms.cicibyte.com
```

Alternatif (repo clone sonrası):

```bash
cd /www/wwwroot/sgms.cicibyte.com
sudo bash docs/deployment/vds-bootstrap.sh
```

**Beklenen çıktı:** `drwxr-xr-x www www sgms.cicibyte.com`

### Repo deploy (git remote hazır olduktan sonra)

```bash
cd /www/wwwroot
# Dizin boşsa clone (www kullanıcısı veya clone sonrası chown)
sudo git clone <REMOTE_URL> sgms.cicibyte.com
sudo chown -R www:www /www/wwwroot/sgms.cicibyte.com

cd /www/wwwroot/sgms.cicibyte.com
sudo cp infra/docker/.env.vds.example infra/docker/.env
sudo nano infra/docker/.env   # şifreleri güncelle

sudo docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d
sudo docker compose -f infra/docker/docker-compose.yml ps
```

> Postgres/Redis varsayılan olarak **127.0.0.1** üzerinde dinler (`POSTGRES_HOST_BIND` / `REDIS_HOST_BIND`).

---

## Local geliştirme

```powershell
cd "C:\Users\Admin\Cicibyte Projects\SGMS"
pnpm install

copy infra\docker\.env.example infra\docker\.env
# Şifreleri değiştirin

mkdir infra\docker\data\postgres, infra\docker\data\redis -Force
pnpm docker:up
pnpm docker:ps
```

---

## Git

```powershell
cd "C:\Users\Admin\Cicibyte Projects\SGMS"
git status
git remote add origin https://github.com/RealMrNovember/SGMS.git
git push -u origin main
```

VDS güncelleme:

```bash
cd /www/wwwroot/sgms.cicibyte.com
sudo -u www git pull
sudo docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d
```

---

## Docker komutları

| Komut | Açıklama |
|--------|----------|
| `pnpm docker:up` | Stack başlat |
| `pnpm docker:down` | Durdur |
| `pnpm docker:ps` | Durum |
| `pnpm docker:logs` | Loglar |

---

## Referans

- [`roadmap.md`](./roadmap.md) — ürün & teknik yol haritası (build sırası)
- `CiCiByte_SGMS_Ultimate_Enterprise_Blueprint.docx`
