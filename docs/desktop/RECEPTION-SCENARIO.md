# SGMS Resepsiyon — Premium Masaüstü Deneyimi

## Ürün tanımı

**SGMS Resepsiyon**, CiCiByte markasıyla uyumlu, Windows için tasarlanmış **premium salon kontrol merkezi**dir. Basit bir web formu değil; frameless native pencere, sistem tepsisi, markalı bildirimler ve canlı giriş/çıkış panosu sunar.

| Özellik | Açıklama |
|---------|----------|
| **Marka** | CiCiByte SGMS logosu — pencere, tepsi, bildirim |
| **Mimari** | Electron + Vite + React (modern masaüstü stack) |
| **Gerçek zamanlı** | Soketi `private-org.{orgId}.staff` kanalı |
| **Arka plan** | Tepsi modu — uygulama görünmezken bile dinler |
| **Bildirim** | Windows toast — giriş/çıkış, isim, saat, turnike |

---

## Operasyon senaryosu — Premium Fitness Studio

### Karakterler

| Rol | Kişi | Cihaz |
|-----|------|-------|
| Salon sahibi | Deniz | Web panel (OWNER) |
| Resepsiyon | Ayşe | **SGMS Resepsiyon** (Windows PC) |
| Sporcu | Elif | RFID bileklik |
| Antrenör | Ahmet | Personel kartı |
| Turnike | Ana giriş | RFID okuyucu + SGMS cihaz anahtarı |

---

### Bölüm 1 — Sabah açılış (06:55)

1. Ayşe resepsiyon bilgisayarını açar; Windows oturumunda **SGMS Resepsiyon** tepside zaten çalışıyordur (isteğe bağlı otostart).
2. Tepsi ikonuna çift tıklar → **frameless kontrol paneli** açılır:
   - Sol panel: CiCiByte logosu, salon adı, canlı bağlantı durumu (yeşil nabız)
   - Sağ panel: boş canlı akış — *“Turnike bekleniyor”*
3. Ayşe paneli kapatır (X) → uygulama **tepsiye iner**, dinlemeye devam eder.

> Resepsiyonist artık tarayıcı sekmesi açmak zorunda değil; masaüstü uygulama salon operasyonunun kalıcı parçasıdır.

---

### Bölüm 2 — İlk üye girişi (07:12)

1. Elif turnikeden geçer → `POST /api/v1/check-in` (`rfidTag`, `direction: ENTRY`).
2. **Windows bildirimi** (SGMS logosu ile):

   **Giriş · Elif Yılmaz**  
   `07:12 · Üye · Premium Aylık · Ana giriş`

3. Ayşe Excel’de kasa sayımı yaparken toast’ı görür.
4. Bildirime tıklarsa kontrol paneli açılır; sağ panelde animasyonlu kart belirir:
   - Yeşil **Giriş** rozeti
   - Avatar / initials
   - Saat, plan, turnike adı
5. Sol panelde **Bugün giriş: 1** sayacı güncellenir.

---

### Bölüm 3 — Personel girişi (07:28)

1. Ahmet personel kartını okutur (`subjectType: STAFF`).
2. Bildirim:

   **Giriş · Ahmet Yılmaz**  
   `07:28 · Personel · TRAINER · Ana giriş`

3. Canlı akışta altın tonlu **Personel** etiketi görünür.

---

### Bölüm 4 — Yoğun saat filtresi (18:00)

1. Akşam peak saatinde Ayşe paneli açar.
2. Üst filtrelerden yalnızca **Giriş** seçer → sadece gelenler listelenir.
3. **Bugün giriş / çıkış** sayaçları gün sonu raporu için anlık referans sağlar.

---

### Bölüm 5 — Çıkış ve kapanış (22:05)

1. Elif `direction: EXIT` ile çıkar.
2. Sarı **Çıkış** rozeti + toast bildirimi.
3. Ayşe **Tepsiye gizle** → bilgisayarı kapatmadan uygulama dinlemeye devam eder (gece vardiyası / erken açılış).

---

## Kurulum

### Salon hazırlığı (web panel)

1. **Üyeler → RFID** — sporcu kartları  
2. **Personel → Turnike kartı** — çalışan kartları  
3. **Giriş → Cihaz kaydet** — turnike API anahtarı  
4. Soketi anahtarı: sunucu `NEXT_PUBLIC_SOKETI_KEY`

### Resepsiyon PC

```bash
cd apps/reception
pnpm install
pnpm dev          # geliştirme
pnpm build        # production build
pnpm start        # build sonrası çalıştır
```

Monorepo kökünden:

```bash
pnpm reception:dev
pnpm reception:build
```

**İlk giriş ekranı:**
- SGMS sunucu: `https://sgms.cicibyte.com`
- Soketi anahtarı
- Resepsiyon personeli e-posta / parola (`scope: staff`)

Windows ilk çalıştırmada bildirim iznini onaylayın.

---

## Teknik mimari

```text
Turnike RFID/QR
    → POST /api/v1/check-in
    → CheckIn (ENTRY|EXIT) + AuditLog
    → Soketi checkin.created
    → Electron main process (Pusher-js)
         ├─ Notification API (logo + toast)
         └─ IPC → React kontrol paneli (canlı akış)
```

**Güvenlik:**
- Turnike: yalnızca cihaz API anahtarı
- Resepsiyon: personel Bearer token + Soketi kanal auth
- Ayarlar: `electron-store` (yerel, şifreli depolama)

---

## Sonraki adımlar

- [x] Windows `.exe` installer — `pnpm reception:dist` · `docs/desktop/INSTALL.md`
- [x] Windows açılışında otostart (`--tray` + panel / tepsi toggle)
- [ ] Kod imzalama (Authenticode) — SmartScreen uyarısını kaldırır
- [ ] Bildirim ses profilleri (VIP üye vurgusu)
- [ ] Tepsi badge — içerideki üye sayısı
