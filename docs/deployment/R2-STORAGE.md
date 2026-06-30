# Cloudflare R2 — Avatar Depolama

Salon üye ve personel fotoğrafları varsayılan olarak `public/uploads/avatars` altında tutulur. Çok şubeli veya yüksek hacimli salonlar için **Cloudflare R2** (S3 uyumlu) kullanılabilir.

## Kurulum

1. Cloudflare Dashboard → R2 → bucket oluşturun (ör. `sgms-avatars`)
2. API token oluşturun (Object Read & Write)
3. İsteğe bağlı: bucket için public custom domain veya `r2.dev` subdomain

## Ortam değişkenleri (`apps/web/.env.local` veya VDS)

```env
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=sgms-avatars
R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
```

`STORAGE_PROVIDER=local` (varsayılan) olduğunda R2 değişkenleri gerekmez.

## Nesne yolu

```
avatars/{organizationId}/{entityType}_{entityId}.{ext}
```

Örnek: `avatars/clxyz/gym_member_abc123.webp`

## Notlar

- Mevcut local avatar URL'leri (`/uploads/avatars/...`) değiştirilmez; yeni yüklemeler R2'ye gider.
- `next.config.ts` içinde `R2_PUBLIC_BASE_URL` hostname'i build sırasında `images.remotePatterns` olarak eklenir.
