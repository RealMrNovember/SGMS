# Turnike & Check-in API Protokolü

**Senaryo:** Sabah 07:15 — sporcu QR okutur, turnike açılır, resepsiyon panelinde isim belirir.

## Kimlik doğrulama

### Cihaz (turnike / masaüstü istemci)

```
X-Device-Key: sgms_dev_xxxxxxxx
```

veya

```
Authorization: Device sgms_dev_xxxxxxxx
```

Anahtar cihaz kaydında (`POST /api/v1/devices` veya dashboard → Giriş → Cihaz kaydet) **yalnızca bir kez** gösterilir.

### Personel (manuel giriş)

Oturum çerezi veya `Authorization: Bearer sgms_live_...` (STAFF token).

## Check-in

`POST /api/v1/check-in`

### Cihaz ile — QR

Sporcu uygulamasındaki QR değeri (`GET /api/v1/check-in/qr` yanıtındaki `token`):

```json
{
  "qrToken": "sgms_qr_..."
}
```

### Cihaz ile — RFID

Üye profiline kayıtlı kart UID:

```json
{
  "rfidTag": "04A1B2C3D4"
}
```

### Cihaz ile — doğrudan üye ID

```json
{
  "gymMemberId": "clx..."
}
```

### Resepsiyon — manuel

```json
{
  "gymMemberId": "clx..."
}
```

Oturum: OWNER / ADMIN / STAFF.

### Başarılı yanıt (200)

```json
{
  "ok": true,
  "data": {
    "checkIn": {
      "id": "...",
      "gymMemberId": "...",
      "method": "QR",
      "checkedInAt": "2026-06-30T07:15:00.000Z",
      "memberName": "Elif Yılmaz"
    },
    "duplicateWithinHour": false
  }
}
```

### Red nedenleri

| HTTP | Durum |
|------|--------|
| 403 | Üye pasif veya üyelik süresi dolmuş |
| 400 | QR süresi dolmuş / geçersiz |
| 404 | Üye veya RFID eşleşmesi yok |

## Cihaz kaydı

`POST /api/v1/devices` — OWNER / ADMIN

```json
{
  "name": "Ana giriş turnikesi",
  "hardwareId": "TURNIKE-01",
  "location": "Ana giriş",
  "type": "TURNSTILE"
}
```

Yanıt `apiKey` içerir — güvenli saklayın.

## Giriş listesi

`GET /api/v1/check-ins?sinceHours=24` — personel token veya oturum.

## QR token

- TTL: 5 dakika (sunucu `AUTH_SECRET` ile HMAC imzalı)
- Sporcu: `GET /api/v1/check-in/qr` (athlete oturumu veya ATHLETE bearer)
- İstemci 4 dakikada bir yenilemeli

## Örnek curl (cihaz)

```bash
curl -sS -X POST https://sgms.cicibyte.com/api/v1/check-in \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: sgms_dev_YOUR_KEY" \
  -d '{"rfidTag":"04A1B2C3D4"}'
```

## Canlı resepsiyon (WebSocket)

Turnike girişi sonrası dashboard **Giriş** sayfası otomatik yenilenir.

- Soketi kanal: `private-org.{organizationId}.staff`
- Olay: `checkin.created`
- Yedek: `GET /api/v1/check-ins/events` (SSE, personel oturumu)

## Offline senkronizasyon

**Senaryo:** İnternet kesildi → turnike girişleri yerel kuyruğa alınır → bağlantı gelince toplu gönderilir.

### Üye önbelleği (çevrimdışı RFID eşlemesi)

`GET /api/v1/sync/pull` + `X-Device-Key`

```json
{
  "ok": true,
  "data": {
    "syncedAt": "2026-06-30T10:00:00.000Z",
    "memberCount": 120,
    "members": [
      { "id": "...", "name": "Elif Yılmaz", "rfidTag": "04A1...", "membershipEndsAt": "...", "status": "ACTIVE" }
    ]
  }
}
```

### Kuyruk gönderimi

`POST /api/v1/sync/push`

```json
{
  "events": [
    {
      "clientEventId": "550e8400-e29b-41d4-a716-446655440000",
      "method": "RFID",
      "rfidTag": "04A1B2C3D4",
      "checkedInAt": "2026-06-30T07:12:00.000Z"
    }
  ]
}
```

- `clientEventId` zorunlu — tekrar gönderimde idempotent (aynı kayıt döner)
- Offline için `gymMemberId` veya `rfidTag` kullanın (QR token süresi dolabilir)
- Maks. 500 olay / istek

Yanıt: `batchId`, `status` (`COMPLETED` | `PARTIAL` | `FAILED`), `results[]`

## Emülatör

```bash
DEVICE_KEY=sgms_dev_xxx bash scripts/turnstile-emulator.sh
```

## Sonraki adımlar

- Üçüncü parti webhook: `POST /api/v1/webhooks/turnstile`
- Masaüstü referans istemci (Electron/Tauri)
