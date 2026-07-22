# Google Play mağaza görselleri — SGMS Sporcu

Klasör: `apps/mobile/play-store/`

## Yükleme sırası (Play Console → Mağaza girişi)

| Dosya | Alan | Ölçü |
|-------|------|------|
| `icon-512.png` | Uygulama simgesi | 512×512 |
| `feature-graphic.png` | Özellik grafiği | 1024×500 |
| `phone-01-giris.png` | Telefon ekran görüntüsü 1 | 1080×1920 |
| `phone-02-ana-sayfa.png` | Telefon ekran görüntüsü 2 | 1080×1920 |
| `phone-03-programlar.png` | Telefon ekran görüntüsü 3 | 1080×1920 |
| `phone-04-olcumler.png` | Telefon ekran görüntüsü 4 | 1080×1920 |
| `phone-05-hesap.png` | Telefon ekran görüntüsü 5 | 1080×1920 |
| `phone-06-mesajlar.png` | Telefon ekran görüntüsü 6 | 1080×1920 |

Tablet / Chromebook / Video / XR: boş bırakılabilir.

## Not

Ekran görüntüleri marka uyumlu **mağaza mockup**’larıdır. Emülatör bu makinede hypervisor (AEHD) olmadığı için açılamadı.

Gerçek cihaz ekran görüntüsü almak için:
1. Android Studio’da Device Manager → `sgms_test` → Hypervisor/AEHD kurulumunu tamamla **veya** USB ile telefon bağla
2. `adb devices` ile cihazı gör
3. Uygulamayı aç → her ekranda: `adb exec-out screencap -p > shot.png`

## Metinler (tr-TR)

- Ad: `SGMS Sporcu`
- Kısa: `Spor salonu üyeliğinizi, programınızı ve ölçümlerinizi tek uygulamadan yönetin.`
