# Soketi — Gerçek Zamanlı Mesajlaşma (WebSocket)

**Senaryo:** PT mesaj yazar → sporcu telefonunda 1–2 saniye içinde görür (WhatsApp benzeri).

SGMS, [Soketi](https://soketi.app/) (Pusher protokolü) + mevcut **Redis** ile WebSocket sunar. Soketi yapılandırılmazsa sistem otomatik olarak **SSE** (`/api/v1/messages/events`) kullanır.

## Docker

`infra/docker/docker-compose.yml` içinde `sgms-soketi` servisi tanımlıdır (port `127.0.0.1:6001`).

```bash
cd /www/wwwroot/sgms.cicibyte.com
docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env up -d soketi
```

## Ortam değişkenleri

### `infra/docker/.env`

```env
SOKETI_APP_ID=sgms
SOKETI_APP_KEY=<güçlü-rastgele-key>
SOKETI_APP_SECRET=<güçlü-rastgele-secret>
```

### `apps/web/.env.local` (sunucu + istemci)

```env
SOKETI_APP_ID=sgms
SOKETI_APP_KEY=<aynı-key>
SOKETI_APP_SECRET=<aynı-secret>
SOKETI_HOST=127.0.0.1
SOKETI_PORT=6001

NEXT_PUBLIC_SOKETI_KEY=<aynı-key>
NEXT_PUBLIC_SOKETI_WS_PATH=/realtime/app
NEXT_PUBLIC_SOKETI_FORCE_TLS=true
```

`NEXT_PUBLIC_SOKETI_KEY` boş bırakılırsa tarayıcı SSE modunda kalır.

## Nginx (aaPanel) — WebSocket proxy

Site ayarlarına ekleyin (`sgms.cicibyte.com`):

```nginx
location /realtime/ {
    proxy_pass http://127.0.0.1:6001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

Deploy sonrası `pm2 reload` gerekir (Next.js env yeniden yüklenir).

## Güvenlik

- Kanal: `private-org.{organizationId}.user.{userId}`
- Abonelik: `POST /api/v1/realtime/auth` — yalnızca kendi kanalınıza izin
- Mesaj içeriği yalnızca DB'den; WebSocket yalnızca “yeni mesaj” sinyali taşır

## Doğrulama

```bash
curl -s http://127.0.0.1:6001/
docker inspect -f '{{.State.Health.Status}}' sgms-soketi
```
