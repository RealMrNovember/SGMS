# CiCiByte SGMS — Smart Gym Management System

| Ortam | Yol |
|--------|-----|
| **Blueprint** | `CiCiByte_SGMS_Ultimate_Enterprise_Blueprint.docx` |
| **VDS (aaPanel)** | `/www/wwwroot/sgms.cicibyte.com` → `sgms.cicibyte.com` |
| **Merkezi platform** | `cloud.cicibyte.com` — CiciByte Cloud (bkz. `roadmap.md` Faz 13) |
| **Komşu vhost'lar (dokunulmaz)** | `license.cicibyte.com` (legacy, artık SGMS'in bağımlılığı değil), `cloud.cicibyte.com` |
| **Local** | `C:\Users\Captain\CicibyteProjects\SGMS` |
| **Sunucu IP** | `31.40.199.47` |

Strateji: **Local geliştir → Git push → VDS `git pull` (aaPanel `www:www`)**

> **Faz/durum takibi:** Bu dosya yalnızca hızlı başlangıç ve deploy talimatlarını içerir. Hangi özelliğin tamamlandığı, hangisinin devam ettiği ve genel mimari için **tek doğru kaynak [`roadmap.md`](./roadmap.md)**'dir.

---

## aaPanel dizin politikası

- Tüm dosyalar: **`/www/wwwroot/sgms.cicibyte.com`**
- Sahiplik: **`www:www`** — `chown -R www:www /www/wwwroot/sgms.cicibyte.com`
- Docker veri bind mount: **`/www/wwwroot/sgms.cicibyte.com/data/{postgres,redis}`**
- Komşu sitelerin (`license.cicibyte.com`, `cloud.cicibyte.com`) kurulumu **değiştirilmez**; SGMS yalnızca kendi dizininde çalışır.

---

## Monorepo yapısı

```text
sgms/
├── apps/
│   ├── web/            # Next.js — tenant dashboard, sporcu portalı, admin, marketing
│   └── reception/       # SGMS Resepsiyon — Electron masaüstü uygulaması
├── packages/
│   ├── database/        # Prisma şema + client
│   └── cloud-client/     # cloud.cicibyte.com (CiciByte Cloud) tenant senkron istemcisi
├── infra/docker/
│   ├── docker-compose.yml
│   ├── .env.example          # local
│   └── .env.vds.example      # VDS şablonu
├── docs/
│   ├── api/              # OpenAPI, turnike protokolü
│   ├── deployment/        # Nginx, R2, Soketi, deploy scriptleri
│   └── desktop/           # SGMS Resepsiyon kurulum/kod imzalama
├── scripts/               # Turnike emülatörü, cloud entegrasyon doğrulaması
├── package.json
└── pnpm-workspace.yaml
```

---

## VDS — Adım 0 (Remote SSH terminalinde çalıştırın)

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
sudo git clone <REMOTE_URL> sgms.cicibyte.com
sudo chown -R www:www /www/wwwroot/sgms.cicibyte.com

cd /www/wwwroot/sgms.cicibyte.com
sudo cp infra/docker/.env.vds.example infra/docker/.env
sudo nano infra/docker/.env   # şifreleri güncelle

sudo docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d
sudo docker compose -f infra/docker/docker-compose.yml ps
```

> Postgres/Redis varsayılan olarak **127.0.0.1** üzerinde dinler (`POSTGRES_HOST_BIND` / `REDIS_HOST_BIND`).

### Uygulama ortam değişkenleri + ilk deploy

```bash
cd /www/wwwroot/sgms.cicibyte.com
cp apps/web/.env.example apps/web/.env.local
nano apps/web/.env.local   # DATABASE_URL, AUTH_SECRET, CLOUD_API_KEY, ...

pnpm install
pnpm db:migrate:deploy
pnpm db:seed
pnpm web:build
pnpm pm2:reload
pnpm deploy:verify
pnpm cloud:heartbeat
bash scripts/verify-cloud-integration.sh
```

---

## Local geliştirme

```powershell
cd "C:\Users\Captain\CicibyteProjects\SGMS"
pnpm install

copy infra\docker\.env.example infra\docker\.env
# Şifreleri değiştirin

mkdir infra\docker\data\postgres, infra\docker\data\redis -Force
pnpm docker:up
pnpm docker:ps

copy apps\web\.env.example apps\web\.env.local
# DATABASE_URL, AUTH_SECRET, CLOUD_API_KEY, ... doldurun

pnpm db:migrate
pnpm db:seed
pnpm web:dev
```

---

## Git

```powershell
cd "C:\Users\Captain\CicibyteProjects\SGMS"
git status
git push
```

VDS güncelleme:

```bash
cd /www/wwwroot/sgms.cicibyte.com
sudo -u www git pull
pnpm install
pnpm db:migrate:deploy
pnpm web:build
pnpm pm2:reload
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

## Diğer önemli komutlar

| Komut | Açıklama |
|--------|----------|
| `pnpm cloud:heartbeat` | Tüm organizasyonları cloud.cicibyte.com ile senkronize eder |
| `pnpm reception:dev` / `reception:build` / `reception:dist` | SGMS Resepsiyon masaüstü uygulaması |
| `bash scripts/verify-cloud-integration.sh` | Production'da cloud.cicibyte.com bağlantı/anahtar doğrulaması |
| `bash scripts/turnstile-emulator.sh` | Turnike webhook emülatörü |

---

## Referans

- Faz/durum takibi ve mimari: [`roadmap.md`](./roadmap.md)
- `CiCiByte_SGMS_Ultimate_Enterprise_Blueprint.docx`
- Teknik günlük (arşiv): [`sgms.cicibyte.com - readme.md`](./sgms.cicibyte.com%20-%20readme.md)
