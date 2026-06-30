# SGMS Resepsiyon — Kurulum Kılavuzu

> **Hedef kitle:** Salon sahibi, IT sorumlusu, resepsiyon yöneticisi  
> **Platform:** Windows 10 / 11 (64-bit)

---

## Senaryo — Yeni salon devreye alma

**Cuma 17:00 — IT kurulumu**

1. Resepsiyon bilgisayarına `SGMS-Resepsiyon-0.3.0-Setup.exe` kopyalanır.
2. Kurulum sihirbazı açılır → CiCiByte SGMS logosu, lisans metni, kurulum dizini (`C:\Users\...\AppData\Local\Programs\SGMS Resepsiyon`).
3. **Masaüstü kısayolu** ve **Başlat menüsü** otomatik oluşturulur.
4. Kurulum bitince uygulama bir kez açılır → **Resepsiyon Kontrol Merkezi** (markalı giriş ekranı).

**Cuma 17:15 — İlk oturum (Ayşe, resepsiyon)**

1. Ayşe personel hesabıyla giriş yapar.
2. Soketi anahtarı salon sahibinden alınır (`NEXT_PUBLIC_SOKETI_KEY`).
3. **Canlı dinlemeyi başlat** → bağlantı yeşile döner.
4. Sistem otomatik olarak **Windows açılışında başlat** seçeneğini etkinleştirir.
5. Ayşe **Tepsiye gizle** → bilgisayarı kapatmadan Cuma akşamı eve gider.

**Pazartesi 06:50 — İlk otomatik açılış**

1. Bilgisayar açılır → SGMS tepside belirir (pencere açılmaz).
2. Kayıtlı oturumla Soketi bağlanır.
3. **07:12** — ilk üye girişinde Windows toast + canlı akış; Ayşe henüz Excel açmamış olsa bile bildirimi görür.

---

## Kurulum adımları

### 1. Installer oluşturma (geliştirici)

Monorepo kökünden:

```bash
pnpm reception:dist
```

Çıktı:

```text
apps/reception/release/SGMS-Resepsiyon-0.3.0-Setup.exe   # yerel build
releases/sgms-reception/v0.3.0/SGMS-Resepsiyon-0.3.0-Setup.exe   # GitHub dağıtımı
```

### 2. Salon PC’ye kurulum

**İndirme (GitHub):**  
https://github.com/RealMrNovember/SGMS/raw/main/releases/sgms-reception/v0.3.0/SGMS-Resepsiyon-0.3.0-Setup.exe

Alternatif: repo içi `releases/sgms-reception/v0.3.0/` klasörü.

1. `SGMS-Resepsiyon-0.3.0-Setup.exe` dosyasını çalıştırın.
2. İlk kurulumda Windows SmartScreen **“Tanınmayan yayıncı”** uyarısı gösterebilir (henüz Authenticode imzası yok) → **Yine de çalıştır**.
3. Kurulum dizinini onaylayın.
3. Kurulum tamamlanınca uygulama açılır.
4. Windows **bildirim izni** isteğini kabul edin.

### 3. İlk yapılandırma

| Alan | Değer |
|------|--------|
| SGMS sunucu | `https://sgms.cicibyte.com` |
| Soketi anahtarı | Sunucu `.env` → `NEXT_PUBLIC_SOKETI_KEY` |
| E-posta | Resepsiyon STAFF / OWNER hesabı |
| Parola | Personel parolası |

### 4. Doğrulama

1. Web panelden test check-in veya turnike emülatörü.
2. Windows toast gelmeli.
3. Kontrol panelinde canlı kart görünmeli.
4. Bilgisayarı yeniden başlatın → tepside SGMS ikonu otomatik görünmeli.

---

## Otostart davranışı

| Durum | Davranış |
|-------|----------|
| İlk başarılı giriş | **Windows açılışında başlat** otomatik açılır |
| `--tray` ile başlangıç | Pencere gizli; kayıtlı oturum varsa dinler |
| Oturum yok + `--tray` | Yapılandırma penceresi açılır |
| Kullanıcı kapatır | Panel veya tepsi menüsünden kapatabilir |

---

## Kaldırma

**Ayarlar → Uygulamalar → SGMS Resepsiyon → Kaldır**

- Oturum ayarları (`electron-store`) varsayılan olarak korunur (`deleteAppDataOnUninstall: false`).
- Tam temizlik için `%APPDATA%\sgms-reception` klasörünü silin.

---

## Sorun giderme

| Sorun | Çözüm |
|-------|--------|
| Bildirim gelmiyor | Windows → Bildirimler → SGMS Resepsiyon açık |
| Tepsi ikonu yok | Görev Yöneticisi’nde çalışıyor mu kontrol edin |
| Bağlantı kapalı | Soketi anahtarı, firewall, `sgms.cicibyte.com` erişimi |
| Otostart çalışmıyor | Panelde toggle kapalı olabilir; tekrar açın |

---

## Destek

- E-posta: support@cicibyte.com  
- Web: https://sgms.cicibyte.com  
- Protokol: `docs/api/turnstile-protocol.md`
