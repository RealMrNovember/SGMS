# SGMS Resepsiyon — Windows Kurulum

| Sürüm | Dosya | Notlar |
|-------|--------|--------|
| **0.4.0** | [SGMS-Resepsiyon-0.4.0-Setup.exe](./v0.4.0/SGMS-Resepsiyon-0.4.0-Setup.exe) | Sadece e-posta + parola · `Program Files\Cicibyte\SGMS` · tepsi logosu düzeltildi |
| 0.3.0 | [SGMS-Resepsiyon-0.3.0-Setup.exe](./v0.3.0/SGMS-Resepsiyon-0.3.0-Setup.exe) | Eski sürüm |

## İndirme (güncel)

**GitHub (main):**  
https://github.com/RealMrNovember/SGMS/raw/main/releases/sgms-reception/v0.4.0/SGMS-Resepsiyon-0.4.0-Setup.exe

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
