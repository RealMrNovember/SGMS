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

### 0 — Altyapı ve repo ← **şu an: VDS dizin + izin doğrulama**

- [x] Monorepo iskeleti (`pnpm-workspace.yaml`, `package.json`)
- [x] `infra/docker/docker-compose.yml` (PostgreSQL 16 + Redis 7)
- [x] VDS volume yolu: `/www/wwwroot/sgms.cicibyte.com/data`
- [x] `.gitignore` + `docs/deployment/vds-bootstrap.sh` (aaPanel `www:www`)
- [x] `readme.md` Faz 1 checklist
- [x] Git: `git init` (local)
- [ ] **VDS: `/www/wwwroot/sgms.cicibyte.com` oluştur + `chown -R www:www`**
- [ ] VDS: `data/postgres`, `data/redis` alt dizinleri
- [ ] Git: ilk commit + remote + VDS `git clone`
- [ ] VDS: `infra/docker/.env` (`.env.vds.example` kopyası)
- [ ] VDS: `docker compose up -d`

### 1 — Veritabanı

- [ ] `packages/database` — Prisma şema
- [ ] İlk migration
- [ ] Plan seed (Starter / Pro / Enterprise / Franchise)

### 2 — License API

- [ ] `apps/license-api` (NestJS)
- [ ] `GET /health`
- [ ] `POST /v1/licenses/activate`, `validate`, `heartbeat`
- [ ] JWT + Redis cache / revoke

### 3 — Operasyon

- [ ] aaPanel Nginx site → API proxy (mevcut `license` vhost’una **dokunmadan**)
- [ ] TLS
- [ ] CI/CD deploy script

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
git remote add origin <REMOTE_URL>
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

`CiCiByte_SGMS_Ultimate_Enterprise_Blueprint.docx`
