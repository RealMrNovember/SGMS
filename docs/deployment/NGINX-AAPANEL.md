# aaPanel — sgms.cicibyte.com Reverse Proxy Kurulumu

> **Güvenlik kuralı:** Yalnızca `sgms.cicibyte.com` sitesini düzenleyin.  
> `cloud.cicibyte.com`, `license.cicibyte.com` (legacy) veya başka hiçbir site/vhost'a dokunmayın.

---

## Ön koşul

PM2 ile Next.js ayakta olmalı (port **3100**):

```bash
cd /www/wwwroot/sgms.cicibyte.com
sudo bash docs/deployment/production-bootstrap.sh
```

Doğrulama:

```bash
curl -sI http://127.0.0.1:3100/ | head -3
# HTTP/1.1 200 veya 307 beklenir
```

---

## Yöntem A — aaPanel arayüzü (önerilen)

### 1. Siteyi açın

1. aaPanel → **Website**
2. Listeden **`sgms.cicibyte.com`** satırına tıklayın ( **license.cicibyte.com değil** )

### 2. Reverse Proxy ekleyin

1. Site ayarları → **Reverse Proxy** (veya **Proxy**)
2. **Add reverse proxy** / **Ekle**
3. Alanları doldurun:

| Alan | Değer |
|------|--------|
| **Proxy name** | `sgms-next` |
| **Target URL** | `http://127.0.0.1:3100` |
| **Sent domain** | `$host` |
| **Enable WebSocket** | ✅ Açık |

4. Kaydedin

### 3. Özel Nginx config (statik dosyalar)

aaPanel’de aynı site için **Config** / **Configuration File** bölümüne gidin.

`server { ... }` bloğu içine, mevcut `location` kurallarından **önce** (veya aaPanel **Custom** alanına) şu snippet’i ekleyin:

```nginx
# --- SGMS Next.js (sgms.cicibyte.com only) ---

location ^~ /_next/static/ {
    alias /www/wwwroot/sgms.cicibyte.com/apps/web/.next/static/;
    expires 365d;
    access_log off;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location ^~ /public/ {
    alias /www/wwwroot/sgms.cicibyte.com/apps/web/public/;
    expires 30d;
    access_log off;
    add_header Cache-Control "public, max-age=2592000";
}

location ^~ /_next/image {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> Tam proxy bloğu repo içinde: `docs/deployment/nginx/next-proxy.conf`

### 4. PHP’yi devre dışı bırakın (önerilen)

SGMS artık Node.js ile çalıştığı için aynı sitede PHP gerekmez:

1. Site ayarları → **PHP Version**
2. **Static** / **Pure static** seçin (veya PHP’yi kapatın)

Böylece kök `index.html` ile proxy çakışması önlenir.

### 5. Test ve reload

1. aaPanel → **Nginx** → **Service** → **Reload** (yalnızca test başarılıysa)
2. Tarayıcı: `https://sgms.cicibyte.com/login`

---

## Yöntem B — Extension dosyası (manuel kopya)

Repo’daki snippet’i **yalnızca sgms extension** klasörüne kopyalayın:

```bash
sudo cp /www/wwwroot/sgms.cicibyte.com/docs/deployment/nginx/next-proxy.conf \
  /www/server/panel/vhost/nginx/extension/sgms.cicibyte.com/next-proxy.conf

sudo nginx -t && sudo nginx -s reload
```

> Bu komut yalnızca `sgms.cicibyte.com` extension’ını etkiler; `license.cicibyte.com.conf` dosyasına dokunulmaz.

---

## PM2 — otomatik başlatma (proje içi)

PM2 state dosyası: `/www/wwwroot/sgms.cicibyte.com/.pm2`

Sunucu reboot sonrası:

```bash
cd /www/wwwroot/sgms.cicibyte.com
sudo -u www env \
  PATH="/www/wwwroot/sgms.cicibyte.com/.tools/node/bin:$PATH" \
  PM2_HOME="/www/wwwroot/sgms.cicibyte.com/.pm2" \
  ./node_modules/.bin/pm2 resurrect
```

Kalıcı cron (aaPanel → Cron, **www** kullanıcısı):

```bash
@reboot sleep 15 && cd /www/wwwroot/sgms.cicibyte.com && env PATH="/www/wwwroot/sgms.cicibyte.com/.tools/node/bin:$PATH" PM2_HOME="/www/wwwroot/sgms.cicibyte.com/.pm2" ./node_modules/.bin/pm2 resurrect
```

Alternatif systemd unit (yalnızca sgms yolları): `docs/deployment/systemd/sgms-pm2.service`

---

## Sorun giderme

| Belirti | Kontrol |
|---------|---------|
| 502 Bad Gateway | `pm2 status` — sgms-web online mi? |
| Statik 404 | `.next/static` build var mı? `pnpm web:build` |
| Login redirect loop | `.env.local` → `AUTH_URL` / `NEXTAUTH_URL` = `https://sgms.cicibyte.com` |
| Eski index.html görünüyor | PHP/static kapatıldı mı? Proxy aktif mi? |

---

## cloud.cicibyte.com — tenant senkron entegrasyonu

CiciByte Cloud'da (Developer → Products) SGMS ürünü zaten kayıtlı (`slug: sgms`). Her ortam için ayrı bir API key üretilir (Developer → API Keys → "sgms-web-production").

API: `PUT https://cloud.cicibyte.com/api/v2/sgms/tenants`
Body: `{ "tenant_slug": "<org.slug>", "tenant_name": "<org.name>", "status": "trialing|active|past_due|cancelled", ... }`

Header: `X-Api-Key: <CLOUD_API_KEY>` (üretimde zorunlu)

Bkz. [`packages/cloud-client`](../../packages/cloud-client) ve `docs/api/license-api.md` (CiciByte Cloud reposu).
