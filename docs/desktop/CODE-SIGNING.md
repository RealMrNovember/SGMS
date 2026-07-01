# Windows Authenticode — SGMS Resepsiyon

SmartScreen **"Tanınmayan yayıncı"** uyarısını kaldırmak için kurulum dosyasını kod imzalamak gerekir.

## Gereksinimler

- Windows SDK (`signtool.exe`)
- Geçerli **Authenticode** sertifikası (EV önerilir — SmartScreen hızlı güven)
- `.pfx` veya USB HSM token

## Ortam değişkenleri

```powershell
$env:CODESIGN_PFX_PATH = "C:\certs\sgms-codesign.pfx"
$env:CODESIGN_PFX_PASSWORD = "secret"
$env:CODESIGN_TIMESTAMP_URL = "http://timestamp.digicert.com"
```

## İmzalama (PowerShell)

```powershell
cd apps\reception
pnpm reception:dist
..\..\scripts\sign-reception.ps1
```

## `scripts/sign-reception.ps1`

Depoda şablon script bulunur. Sertifika yoksa script bilgilendirici mesaj verir; build yine çalışır.

## CI/CD

GitLab/GitHub runner'da imzalama için sertifikayı **masked secret** olarak saklayın; yalnızca release tag'lerinde çalıştırın.

## Kullanıcı deneyimi (imzasız)

`docs/desktop/INSTALL.md` — ilk kurulumda **Yine de çalıştır** adımı dokümante edilmiştir.
