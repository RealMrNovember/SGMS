# SGMS Resepsiyon — Windows Kurulum

| Sürüm | Dosya | Boyut |
|-------|--------|-------|
| **0.3.0** | [SGMS-Resepsiyon-0.3.0-Setup.exe](./v0.3.0/SGMS-Resepsiyon-0.3.0-Setup.exe) | ~79 MB |

## İndirme

**GitHub (main):**  
https://github.com/RealMrNovember/SGMS/raw/main/releases/sgms-reception/v0.3.0/SGMS-Resepsiyon-0.3.0-Setup.exe

## Kurulum

Detaylı adımlar: [`docs/desktop/INSTALL.md`](../../docs/desktop/INSTALL.md)

1. Setup.exe’yi indirin ve çalıştırın.
2. Resepsiyon personeli hesabıyla oturum açın.
3. Windows bildirim iznini onaylayın.

## Geliştirici build

```bash
pnpm reception:dist
```

Çıktı yerel olarak `apps/reception/release/` altında oluşur (git’e dahil değil).
