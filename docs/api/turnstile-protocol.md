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

## Sonraki adımlar (Faz 10.3)

- Offline kuyruk: `POST /api/v1/sync/push`
- Üçüncü parti webhook: `POST /api/v1/webhooks/turnstile`
