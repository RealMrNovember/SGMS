# SGMS Resepsiyon — Windows Kurulum

| Sürüm | Dosya | Notlar |
|-------|--------|--------|
| **0.5.0** | [SGMS-Resepsiyon-0.5.0-Setup.exe](./v0.5.0/SGMS-Resepsiyon-0.5.0-Setup.exe) | Tam resepsiyon paneli: üyeler, manuel giriş, kasa, ayarlar |
| 0.4.1 | [SGMS-Resepsiyon-0.4.1-Setup.exe](./v0.4.1/SGMS-Resepsiyon-0.4.1-Setup.exe) | Pusher giriş hatası düzeltildi |
| 0.4.0 | [SGMS-Resepsiyon-0.4.0-Setup.exe](./v0.4.0/SGMS-Resepsiyon-0.4.0-Setup.exe) | Sadece e-posta + parola |

## İndirme (güncel)

**GitHub (main):**  
https://github.com/RealMrNovember/SGMS/raw/main/releases/sgms-reception/v0.5.0/SGMS-Resepsiyon-0.5.0-Setup.exe

## Kurulum

Detaylı adımlar: [`docs/desktop/INSTALL.md`](../../docs/desktop/INSTALL.md)

1. Setup.exe’yi indirin ve çalıştırın (yönetici izni gerekebilir).
2. Kurulum dizini: `C:\Program Files\Cicibyte\SGMS`
3. Resepsiyon personeli hesabıyla **yalnızca e-posta ve parola** girin.
4. Windows bildirim iznini onaylayın.

## Geliştirici build

```bash
pnpm reception:dist
```

Çıktı yerel olarak `apps/reception/release/` altında oluşur.
