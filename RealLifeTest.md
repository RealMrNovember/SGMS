1. Şirket Sahibi (Owner)

Gerçek hayatta sabah salona geliyor.

#### 1. İlk giriş
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Tüm roller (OWNER/ADMIN/STAFF/TRAINER) tek bir `/login` sayfasından (`apps/web/src/app/login/page.tsx`) tek bir `LoginForm`'a girer; OWNER'a özel ayrı bir giriş akışı yok. `login-form.tsx:11-16,34-44` login ekranına doğrudan "Demo Owner/Staff/Trainer/Athlete" butonları koyuyor — üretim girişiyle demo girişi aynı ekranda karışık. `/trial` kaydı sonrası (`apps/web/src/app/(marketing)/trial/page.tsx:13`) doğrudan `redirect('/dashboard')` yapılıyor; hiçbir onboarding sihirbazı ("ilk üyeni ekle", "ödeme sağlayıcını bağla", "personelini davet et" gibi bir checklist) yok. `dashboard/page.tsx:26-30` sadece oturum/organizasyon kontrolü yapıp aynı operasyonel paneli herkese açıyor; OWNER ile STAFF arasındaki tek fark hangi hızlı-eylem kutucuklarının görüneceği (`RECEPTION_ROLES`/`TEAM_MANAGER_ROLES`, satır 15-16, 193-201).
**Gerçekçilik sorusu cevabı:** Gerçek bir salon sahibi ilk girişte "önce ne yapmalıyım" diye bir yol haritası bekler; şu an sıfırdan kayıt olan bir OWNER, tüm KPI kartları sıfır olan aynı "günlük operasyon" panelini görüyor — hem kafa karıştırıcı hem profesyonel değil.
**Öneri:** İlk kayıt sonrası tek seferlik bir "kurulum checklist" bileşeni (üye ekle, personel davet et, ödeme yöntemi tanımla, ilk paketi oluştur) eklenmeli; demo hesap butonları prod giriş formundan görsel olarak ayrılmalı.

#### 2. Dashboard
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `dashboard/page.tsx` + `lib/dashboard-kpis.ts` günlük check-in sayısı, ay-içi net tahsilat, 7 gün içinde bitecek üyelik sayısı, geciken taksit sayısı ve düşük stok sayısını gösteriyor (`dashboard-kpis.ts:30-90`). `kpis.revenueThisMonth` alanı isminin aksine "bugün" değil ayın 1'inden bugüne toplamı hesaplıyor (`monthBounds`, satır 12-16, 45-48) — bu Faz 43.10'da not edilmiş ve kodda hâlâ aynen doğrulandı. Yeni gözlem: dashboard'da hiçbir trend/karşılaştırma oku yok (dünle/geçen haftayla kıyas yok), gerçek P&L/kâr rakamı yok, hızlı-eylem ızgarasında (`164-202`) Raporlar/HR'a kısayol bile yok.
**Gerçekçilik sorusu cevabı:** Sabah salona giren bir OWNER ilk 5 saniyede "dün ne oldu" görmek ister; şu anki kart seti "ayın toplamı" ile "dün"ü ayırt etmiyor, hiçbir kart bir öncekiyle kıyaslanmıyor.
**Öneri:** `revenueThisMonth`'un yanına gerçek "dünkü ciro" kartı + "%X artış/azalış" trend etiketi eklenmeli.

#### 3. Finans
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/billing` (`billing/page.tsx:1-149`) aslında salonun SGMS lisansı için CiciByte'a yaptığı ödemeyi yönetiyor — gymin kendi finansmanıyla ilgisi yok, isim çakışması kafa karıştırıcı. Gerçek ciro `reports/page.tsx` + `lib/reports/revenue.ts:35-120`'de: `collected`/`billed` ayrı gösteriliyor ama aralık seçenekleri sadece `7d/30d/90d/month` (`reports/page.tsx:17`) — "bugün/dün" preseti yok. **En kritik eksik:** `Expense` modeli aslında **üye alacağı/faturasıdır** (`schema.prisma:1389-1429`), gerçek işletme gideri (kira/fatura/maaş) hiçbir yerde ciroya karşı toplanmıyor — `OrganizationMember.baseSalary` HR ekranında girilebiliyor ama hiçbir raporda gidere yazılmıyor. Sistemde **gerçek bir kâr-zarar (P&L) tablosu yok**.
**Gerçekçilik sorusu cevabı:** OWNER "bu ay ne kâr ettim" sorusunu hiç yanıtlayamıyor çünkü gider tarafı sisteme hiç girilmiyor — bu en büyük yapısal boşluk.
**Öneri:** Gerçek bir `BusinessExpense` (kira/fatura/maaş) modeli + reports'a "Net Kâr = Tahsilat − İşletme Gideri" satırı; reports'a "Bugün/Dün" preseti eklenmeli.

#### 4. Personel
**Durum:** ✅ Çalışıyor (bir istisnayla)
**Bulgu:** `/dashboard/hr` (`hr/page.tsx:1-219`) bekleyen izinler, bugün izinli/vardiyalı olanlar özetini gösteriyor; ADMIN/OWNER için performans değerlendirme, disiplin kaydı, maaş bölümü render ediliyor. `/dashboard/hr/leaves`, `/dashboard/hr/shifts` tam işlevsel. `/dashboard/team` personel davet/çıkarma/RFID atama yapıyor ama **rol değiştirme yok** (Faz 43.10'da not edilmiş, `actions/team.ts`'te gerçekten böyle bir action yok, doğrulandı).
**Gerçekçilik sorusu cevabı:** "Bir kasiyeri terfi ettirip PT yapmak" gibi sık yaşanan bir senaryo hâlâ imkânsız — "yapamıyorum" kategorisi.
**Öneri:** `actions/team.ts`'e `changeStaffRole` eklensin (RFID/geçmiş korunarak).

#### 5. PT performansları
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/trainers` + `[id]` seans sayısı/saat/ciro/komisyon/no-show oranını gösteriyor (43.1 düzeltmesi doğrulandı: `isActive` filtresi kaldırılmış). **Yeni bulgu:** `getTrainerMonthlyStats`/`listTrainersWithMonthlyStats` bir `reference: Date` parametresi kabul ediyor (`queries.ts:21-24,74`) ama sayfalar bunu **hiçbir tarih argümanı vermeden** çağırıyor — geriye dönük ay seçici UI'da hiç yok.
**Gerçekçilik sorusu cevabı:** Backend hazır, sadece bir `<select>` eksik — "yarım bırakılmış" bir özellik.
**Öneri:** `trainers/page.tsx`'e `?month=YYYY-MM` query param + ay seçici eklensin.

#### 6. Üyelik satışları
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/reports` MRR, LTV, ortalama üyelik süresi, yeni/kaybedilen üye, yenileme oranını gösteriyor. CSV export sadece "ziyaretçi trendi", "en çok satan PT/ürün" için var — **üyelik satışlarının kendisi için** (hangi paket ne kadar sattı, hangi personel ne kadar üyelik sattı) ne tablo ne CSV var.
**Gerçekçilik sorusu cevabı:** OWNER "bu ay hangi paket en çok sattı, hangi resepsiyonist en çok üyelik kapattı" diye bakmak isterdi — ikisi de yok.
**Öneri:** `reports`'a "paket bazlı satış" + "personel bazlı satış" (`Transaction.createdById`) tablosu eklensin.

#### 7. Şube yönetimi
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Gerçek çoklu-şube desteği var: `Organization.parentOrganizationId` self-relation hiyerarşisi, `/dashboard/enterprise` konsolide rapor. **Ancak** iki şubeyi birbirine bağlamak (`setOrganizationParent`) yalnızca CiciByte süper-admin'i tarafından yapılabiliyor (`actions/admin-hierarchy.ts:28-42` — `requireSuperAdmin`) — OWNER kendi ikinci şubesini kendi panelinden kuramıyor.
**Gerçekçilik sorusu cevabı:** "Yeni şube açtım, hemen bağlayayım" der ama yapamıyor — net bir "yapamıyor muyum? hayır" cevabı.
**Öneri:** OWNER/ADMIN'e kendi ana organizasyonunun altına şube-organizasyon oluşturup bağlayabileceği kısıtlı bir self-servis action eklensin.

#### 8. Kasalar
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/pos/shifts` kapanmış vardiyaların arşivini (açan/kapatan, bakiye, discrepancy, Z-raporu) gösteriyor — iyi çalışan, denetlenebilir. **Yeni bulgu:** `getOpenCashShift` organizasyon başına **tek** açık vardiya arıyor (`findFirst`, `closedAt: null`) — birden fazla terminal/kasiyerin eşzamanlı kasa açması desteklenmiyor; OWNER için "şu an hangi kasalar açık" canlı görünümü yok.
**Gerçekçilik sorusu cevabı:** "Kasalar" çoğul ama sistem tekil.
**Öneri:** `CashRegisterShift`'e opsiyonel `terminalId` eklenip eşzamanlı vardiyaya izin verilsin; OWNER için "açık kasalar" canlı paneli eklensin.

#### 9. Bildirimler
**Durum:** ❌ Yok
**Bulgu:** Dashboard'un kendisi "Bildirim Merkezi"ni `COMING_SOON_TEASER_FEATURES` listesinde açıkça "Çok Yakında" işaretliyor. Gerçekte var olan tek mekanizma tarayıcı Web Push'tur; OWNER'a giden **tek** otomatik push her check-in/check-out içindir (`notifyReceptionOfCheckIn`) — yoğun salonda saatte yüzlerce bildirim, throttle yok. İşletme-kritik hiçbir şey (başarısız ödeme, geciken taksit, düşük stok, kasa açığı) push olarak gitmiyor.
**Gerçekçilik sorusu cevabı:** Bildirim önceliklendirmesi tam tersine kurulmuş — önemsiz her giriş-çıkış push, kritik olaylar sessiz.
**Öneri:** Check-in push'ları OWNER/ADMIN için varsayılan kapalı yapılsın; geciken taksit/başarısız ödeme/düşük stok/kasa açığı için gerçek push tetikleyicileri eklensin.

#### 10. Gün sonu
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Organizasyon çapında bir "günü kapat" iş akışı yok. En yakın karşılığı kasa vardiyası X/Z raporu — ama vardiya bazlı, günün tamamını kapsamıyor. `getDailyPosSummary` (`lib/pos-summary.ts:12-66`) tam olarak "bugünün özeti"ni hesaplıyor ama resmi bir "günü kapat/onayla" adımı ya da PDF çıktısı yok.
**Gerçekçilik sorusu cevabı:** "Günün resmi kaydı" (dondurulmuş/imzalanmış bir rapor) yok.
**Öneri:** `getDailyPosSummary` çıktısını PDF/e-posta "gün sonu raporu" haline getiren, isteğe bağlı OWNER onayı alan bir adım eklensin.

#### 11. Ay sonu
**Durum:** ❌ Yok
**Bulgu:** `reports/page.tsx`'teki `month` presetinin görüntülemesi dışında herhangi bir ay-sonu finansal kapama akışı, "ayı kilitle" işlevi ya da otomatik özet e-posta/PDF'i yok. Madde 3'teki P&L eksikliği burada daha da ağırlaşıyor: gerçek gider verisi olmadan ay sonu kâr/zarar hesaplanamaz.
**Gerçekçilik sorusu cevabı:** "Geçen ay" görünümü canlı sorgu, dondurulmuş/onaylanmış bir "ay sonu kapanışı" değil.
**Öneri:** Aylık, otomatik oluşturulan ve PDF olarak arşivlenen "ay sonu finansal özet" raporu (gelir+gider+net+üyelik istatistikleri) eklensin.

#### 12. Muhasebe
**Durum:** ❌ Yok
**Bulgu:** E-fatura/GİB entegrasyonu veya vergi raporu hiçbir yerde yok. Var olan PDF üretimleri: üyelik sözleşmesi, tek bir üyenin ödeme dökümü, salonun CiciByte'a ödediği SaaS faturası (gymin kendi muhasebesiyle ilgisi yok). Organizasyon çapında ham işlem defterini muhasebeciye verilecek CSV/Excel formatında dışa aktaran hiçbir yol yok.
**Gerçekçilik sorusu cevabı:** OWNER "işte tüm işlemler" diye muhasebeciye verecek bir dosya oluşturamıyor — elle her sayfayı dolaşmak ya da veritabanına SQL atmak zorunda.
**Öneri:** Tarih aralığı seçilebilir, tüm `Transaction` kayıtlarını (tarih/üye/tutar/yöntem/fatura no) döken bir CSV export eklensin.

#### 13. Problemler
**Durum:** ❌ Yok
**Bulgu:** OWNER'a sorunları tek yerde toplayan bir "uyarı merkezi" yok — bu literal olarak "Çok Yakında". Şu an var olan tek sinyaller dashboard'daki 2 statik banner ve `lowStockCount` KPI kartı — proaktif değil, sadece OWNER dashboard'a girerse görünür. Başarısız online ödemeler sessizce `failed` yazılıp hiçbir bildirim gönderilmeden bırakılıyor; kasa açığı/fazlası bir uyarı tetiklemiyor; bekleyen izin/teslimat için merkezi liste yok. Kod tabanında zamanlanmış görev/kuyruk motoru (cron/QStash/Inngest) da yok.
**Gerçekçilik sorusu cevabı:** En can alıcı madde — gerçek bir OWNER "bana ne göstermen gerekiyorsa göster" bekler; sistem tam tersini istiyor.
**Öneri:** Dashboard'a tüm modüllerden veri çeken tek bir "Bugün Dikkat Et" bölümü eklensin; en azından günlük e-posta özeti devreye alınsın.

### Owner Persona — Denetim Özeti (ajan bulgusu)
- **Kritik** — Gerçek bir P&L tablosu yok: `Expense` modeli üye alacağıdır, işletme giderleri hiçbir raporda ciroya karşı toplanmıyor (madde 3, 11).
- **Kritik** — Merkezi bir "sorun/uyarı merkezi" yok, "Bildirim Merkezi" literal olarak "Çok Yakında" (madde 9, 13).
- **Yüksek** — Muhasebe/dışa aktarım tamamen eksik: ham işlem defteri CSV'si yok, e-fatura/GİB entegrasyonu yok (madde 12).
- **Yüksek** — Çoklu şube bağlama sadece CiciByte süper-admin'inde (madde 7).
- **Orta** — PT aylık performans sayfalarında geriye dönük ay seçici yok (madde 5).
- **Orta** — Kasa tasarımı organizasyon başına tek açık vardiya varsayıyor (madde 8).
- **Orta** — İlk giriş/onboarding akışı yok (madde 1).
- **Düşük-Orta** — Üyelik satış raporlarında paket/personel kırılımı yok (madde 6).
- **Düşük** — Personelin rolü sonradan değiştirilemiyor (madde 4).

Sonra kendime şu soruları soracağım.

Eğer ben gerçekten salon sahibi olsaydım burada ne yapmak isterdim?

Yapamıyor muyum?

Çok uzun mu sürüyor?

Yanlış mı tasarlanmış?

Daha profesyonel nasıl olurdu?

Her maddeyi yazacağım.

2. Kasiyer / Resepsiyon

Bu en kritik rol.

Sabah 08:00

Kapı açılıyor.

20 kişi aynı anda geliyor.

#### 1. Birisi kartını unutmuş
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/check-in` sayfasındaki `ManualCheckInForm` (`apps/web/src/components/manual-check-in-form.tsx:61-72`) kart/RFID olmadan check-in için tek alternatiftir: isim/telefon arama YOK, sadece native `<select>` içinde ada göre sıralı, en fazla 200 AKTİF üye (`check-in/page.tsx:59-64`, `take: 200`) — tam olarak roadmap 43.9'daki sorun.
**Hız/tıklama değerlendirmesi:** Az üyeli salonda 2 tık hızlı; 200+ üyeli veya kalabalık salonda kasiyer native select içinde parmakla arama yapmak zorunda — 08:00 kuyruğunda gerçekçi değil.
**Öneri:** 43.9'daki `SearchableSelect` (Faz 6.4 deseni) uygulanmalı; telefon numarasıyla arama eklenmeli.

#### 2. Birisi üyeliğini uzatacak
**Durum:** ✅ Çalışıyor
**Bulgu:** `MembershipRenewalPanel` (`components/membership-renewal-panel.tsx:59-232`), `/dashboard/members/[id]`'de `canSellMembership` (OWNER/ADMIN/STAFF) rolüne açık. Plan seçimi, "Şimdi Öde"/"Hesaba İşle", ödeme yöntemi ve not alanıyla `renewMembership` çağrılıyor.
**Hız/tıklama değerlendirmesi:** Sayfaya ulaşmak + plan/ödeme seçimi + "Sat" ≈ 4-5 etkileşim. Check-in/POS ekranından yenilemeye direkt bağlantı yok.
**Öneri:** POS/check-in ekranında seçili üyenin yanına "Üyeliği Yenile" kısayolu eklenebilir.

#### 3. Birisi protein tozu alacak
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/pos`'ta `PosTerminal` önceden fiyatlandırılmış kategoriler için hızlı butonlar sunuyor (`quickAddCategoryExpense` → `createCategorySaleExpense`, mobil self-servis mağazayla aynı kod yolu — tutarlı). Ancak satış her zaman `status:'OPEN'` (borç) açılıyor; tahsilatı kapatmak için kasiyer AYRICA ödeme formunu doldurmak zorunda, tutar otomatik dolmuyor (elle yazılıyor).
**Hız/tıklama değerlendirmesi:** Üye seç → +Protein tıkla (borç açılır) → tutarı elle yaz → yöntem seç → "Ödeme Kaydet" = en az 4 gerçek etkileşim + elle tutar yazma.
**Öneri:** Açık bakiyeyi otomatik dolduran bir "Tam Öde" kısayolu POS terminaline eklenmeli.

#### 4. Birisi su alacak
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Aynı akış (madde 3) — küçük/hızlı satışlar için özel bir "tek tıkla sat ve tahsil et" modu yok.
**Hız/tıklama değerlendirmesi:** 4+ etkileşim; ₺1-2'lik su satışı için bu kadar adım 20 kişilik sabah kuyruğunda gerçekçi değil.
**Öneri:** `quickAddCategoryExpense`'e opsiyonel "anında tahsil et" parametresi eklenip tek buton sunulabilir.

#### 5. Birisi PT seansı satın alacak
**Durum:** 🐛 Bug bulundu
**Bulgu:** Resepsiyon/STAFF `schedulePtSession` ile seans planlayabiliyor ama **bu action hiçbir `Expense`/`Transaction` kaydı oluşturmuyor**. Ücret yalnızca seans TAMAMLANDIĞINDA `PtSession.revenueAmount`/`commissionAmount`'a yazılıyor — tamamen PT performans/prim takibi için, üyenin cari hesabına/POS'a hiç yansımıyor. `getDailyPosSummary` `PtSession`'ı hiç dahil etmiyor. Kasiyer PT seansı için gerçek anlamda tahsilat kaydı işleyemiyor.
**Hız/tıklama değerlendirmesi:** Randevu açmak hızlı ama gerçek tahsilat akışı yok — resmi olmayan iş-around gerekiyor.
**Öneri:** `PtSession`'a satın alma anında bir `Expense` bağlantısı eklenmeli; en azından `completePtSession` bir `Expense`/`Transaction` satırı da yazmalı.

#### 6. Birisinin üyeliği bitmiş
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Check-in sırasında sistem üyeliği net reddediyor (`membership_expired`, `checkInMembershipExpired` mesajı). Ana panelde "Süresi Yakında Dolacaklar" KPI kartı var ama "Görüntüle" linki **filtresiz** `/dashboard/members`'e gidiyor — hesaplanan bu durumu filtreleyecek bir yol yok. Kasiyer reddedildiğinde aynı ekrandan tek tıkla yenileme akışına geçemiyor.
**Hız/tıklama değerlendirmesi:** Reddetme anlık ve doğru; "reddet → yenilet" arası kopuk.
**Öneri:** Check-in hata mesajına üyenin profil sayfasına direkt link eklenmeli; dashboard linki gerçek bir filtreyle çalışmalı.

#### 7. Birisinin taksidi gecikmiş
**Durum:** ✅ Çalışıyor
**Bulgu:** POS'ta üye seçildiğinde `getMemberPosSnapshot` `hasOverdueInstallment` bayrağını hesaplıyor, kırmızı rozet gösteriliyor. `/dashboard/payment-plans` tüm gecikmiş/yaklaşan taksitleri STAFF dahil listeliyor, `PaymentPlanPayButton` ile tek tıkla tam tutar tahsil ediliyor. **Check-in ekranında bu bilgi hiç yok.**
**Hız/tıklama değerlendirmesi:** `/dashboard/payment-plans`'tan tahsilat tek tık; POS'ta rozet var ama tahsilat için manuel tutar girişi gerekiyor.
**Öneri:** `PaymentPlanPayButton`'a kart/havale seçeneği eklenmeli (şu an sabit CASH); check-in feed'inde küçük bir "gecikmiş taksit" ikonu gösterilebilir.

#### 8. Birisi QR ile geldi
**Durum:** ✅ Çalışıyor
**Bulgu:** Sporcu `/api/v1/check-in/qr` ile kısa ömürlü (240sn yenileme) token alıyor; turnike/kiosk cihazı bunu `device-key` ile doğruluyor, tek kullanımlık (`qr_already_used` koruması var). Uçtan uca sağlam.
**Hız/tıklama değerlendirmesi:** Üye tarafında anlık; resepsiyon hiç müdahale etmiyor — sabah kuyruğu için ideal.
**Öneri:** Yok.

#### 9. Birisi RFID ile geldi
**Durum:** ✅ Çalışıyor
**Bulgu:** `resolveSubject` `rfidTag`'i hem `GymMember` hem `OrganizationMember`'da arıyor; atama üye profilinde `MemberRfidForm` ile serbest metin girişiyle yapılıyor. Donanım-agnostik tasarım (klavye-emülasyonlu okuyucularla uyumlu).
**Hız/tıklama değerlendirmesi:** Fiziksel check-in anlık; kasiyer sadece bir defalık atama yapıyor.
**Öneri:** Yok.

#### 10. Birisi misafir getirdi
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `/dashboard/guest-passes`'te misafir kartı oluşturulabiliyor, QR tek seferlik gösteriliyor (kaybedilirse yeniden gösterilemiyor). Misafirin gerçek girişi SADECE fiziksel cihaz üzerinden çalışıyor (`/api/v1/check-in/guest` `deviceKey` şart) — `ManualCheckInForm` sadece `gymMemberId` kabul ediyor, **misafir kartını manuel/elle check-in etmenin web panelinde hiçbir yolu yok**.
**Hız/tıklama değerlendirmesi:** Kart oluşturma hızlı; fiziksel tarayıcı cihazı yoksa misafiri check-in etmenin hiçbir yolu yok — ciddi bir tıkanıklık noktası.
**Öneri:** `ManualCheckInForm`'a bekleyen misafir kartlarından seçip manuel işaretleme özelliği eklenmeli; QR yeniden üretme akışı eklenmeli.

#### 11. Birisi üyeliğini donduracak
**Durum:** ⚠️ Kısmen çalışıyor (eksik var) — roadmap 43.10 doğrulandı
**Bulgu:** `MembershipLifecyclePanel`, `canManage` (OWNER/ADMIN/STAFF) rolüyle **hem** talep oluşturma **hem** onay/red butonlarını gösteriyor. `requestMembershipFreeze` ve `approveMembershipFreeze`/`rejectMembershipFreeze` **hepsi aynı** rol setini kontrol ediyor — talep eden ile onaylayan arasında ayrım yok, dört-göz kontrolü yok. Bir kasiyer talep açıp hemen kendisi onaylayabilir.
**Hız/tıklama değerlendirmesi:** Talep + onay ikisi de tek tık — hızlı ama denetimsiz.
**Öneri:** Onay adımı OWNER/ADMIN'e kısıtlanabilir veya STAFF'in kendi açtığı talebi onaylamasını engelleyen bir kontrol eklenebilir.

#### 12. Birisi iptal ettirecek
**Durum:** ❌ Yok
**Bulgu:** Web panelinde hiçbir yerde "üyeliği iptal et" butonu/aksiyonu yok. Backend'de bir `DELETE /api/v1/members/[id]` uç noktası var (soft-delete → `INACTIVE`) ama dashboard'daki hiçbir bileşen bunu çağırmıyor. `recordRefund` genel bir iade aksiyonu ama **proraw/proration hesaplaması hiç yok** (kod tabanında `prorat` kelimesi bile geçmiyor).
**Hız/tıklama değerlendirmesi:** Uygulanamaz — akış eksik.
**Öneri:** Üye profil sayfasına kalan gün sayısını otomatik hesaplayıp (`remainingMembershipDays` yardımcı fonksiyonu zaten var) oranlı iade öneren bir "Üyeliği İptal Et" aksiyonu eklenmeli.

#### 13. Birisi şubesini değiştirecek
**Durum:** ❌ Yok
**Bulgu:** Şubeler arası üye taşıma diye bir özellik yok. `transferMembership` action'ı **aynı organizasyon içinde** bir üyenin kalan hakkını başka bir üyeye devretmesi anlamına geliyor (kalan günleri arkadaşına satmak) — şube değişikliğiyle ilgisi yok. Her "şube" ayrı bir `Organization` kaydı; bir üyeyi organizasyondan organizasyona taşıyan hiçbir action yok.
**Hız/tıklama değerlendirmesi:** Uygulanamaz — özellik yok.
**Öneri:** Gerçek bir "GymMember branch transfer" akışı eklenmeli; mevcut `transferMembership` adı da kafa karıştırıcı, "hak devri" olarak yeniden adlandırılabilir.

### Kasiyer/Resepsiyon Persona — Denetim Özeti (ajan bulgusu)
- **Kritik** — PT seansı satışı muhasebeden tamamen kopuk: `schedulePtSession`/`completePtSession` hiçbir `Expense`/`Transaction` üretmiyor (madde 5).
- **Kritik** — Üyelik iptali web panelinde hiç yok; ne buton ne proration yardımcısı var (madde 12).
- **Yüksek** — Misafir check-in'i cihazsız salonda tıkanıyor (madde 10).
- **Yüksek** — Dondurma tek imzayla STAFF'e açık, dört-göz kontrolü yok (madde 11).
- **Orta** — POS'ta küçük/hızlı satışlar (su, protein) gereğinden fazla adım (madde 3, 4).
- **Orta** — Aranabilir üye seçici yok, 200 kayıt sınırı (madde 1).
- **Orta** — Dashboard uyarı linkleri filtresiz (madde 6).
- **Düşük** — Şube transferi özelliği hiç yok, isim çakışması kafa karıştırıcı (madde 13).
- **Genel değerlendirme:** Check-in/POS/üye profili/payment-plans dört farklı sayfaya dağılmış, aralarında derin link yok. QR/RFID otomatik check-in gerçekten hızlı ve iyi tasarlanmış; manuel/nakit ağırlıklı işlemler gereğinden fazla tıklama istiyor.

Birisi üyeliğini uzatacak.

Birisi protein tozu alacak.

Birisi su alacak.

Birisi PT seansı satın alacak.

Birisinin üyeliği bitmiş.

Birisinin taksidi gecikmiş.

Birisi QR ile geldi.

Birisi RFID ile geldi.

Birisi misafir getirdi.

Birisi üyeliğini donduracak.

Birisi iptal ettirecek.

Birisi şubesini değiştirecek.

Gerçek resepsiyon yoğunluğunu simüle edeceğim.

3. PT / Antrenör

Bu kısmı daha da derin inceleyeceğim.

#### 1. Sabah sisteme giriş
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Sol menü kısmen role göre filtreleniyor — TRAINER için `leads`, `classes/groups/discounts/guestPasses/equipment`, `trainer-requests`, `reports` gizleniyor (`dashboard/layout.tsx:83-95,130-144`). Ancak `/dashboard` ana sayfasının **içeriği** hiç role göre ayrılmıyor: `getDashboardKpis` role parametresi almıyor ve PT girişte tüm salonun bu ayki cirosunu, düşük stok uyarılarını, gecikmiş taksitleri aynen OWNER gibi görüyor. `apps/mobile` tamamen sporcu uygulaması — PT'ye özel mobil deneyim yok.
**Yetkilendirme notu:** Menü filtrelemesi var ama sayfa içeriği yok — Faz 36.5'in "TRAINER finansal veri göremesin" niyetiyle tutarsız bir görsel sızıntı.
**Öneri:** PT'ye özel bir landing (bugünkü seansların/sporcuların özeti) + ana dashboard'daki ciro/stok kartlarının TRAINER'a göre gizlenmesi.

#### 2. Bugünkü sporcular
**Durum:** ❌ Yok
**Bulgu:** Kod tabanında `trainerId` ile filtrelenen herhangi bir "bugün"/"benim sporcularım" sorgusu yok. `/dashboard/members` listesi tüm üyeleri gösteriyor, `trainerId` filtresi hiç yok.
**Yetkilendirme notu:** Daha vahimi — üye detay sayfası da yetkisiz genişlikte: `prisma.gymMember.findFirst({ where: { id, organizationId } })` (`members/[id]/page.tsx:61-66`) sadece organizasyon kontrolü yapıyor, `trainerId` kontrolü **hiç yok**. Herhangi bir TRAINER, URL'yi bilerek başka bir PT'nin sporcusunun tam profiline (ölçüm, not, hedef, program) erişebiliyor.
**Öneri:** `/dashboard/members` ve `/dashboard/members/[id]` sorgularına `role === 'TRAINER' ? { trainerId: userId } : {}` eklenmeli.

#### 3. Bugünkü dersler
**Durum:** ❌ Yok
**Bulgu:** `/dashboard/classes` ve `[sessionId]` sayfaları `MANAGER_ROLES` (OWNER/ADMIN/STAFF) ile gate'lenmiş; TRAINER `redirect('/dashboard')` ile tamamen dışarı atılıyor. `GymClass`/`ClassSession`'da `trainerId` alanı olmasına rağmen bir PT kendi verdiği grup dersinin bugünkü katılım listesini bile göremiyor.
**Yetkilendirme notu:** N/A — erişim sıfır.
**Öneri:** TRAINER için salt-okunur bir görünüm: kendi dersleri + yoklama işaretleme izni.

#### 4. Program düzenleme
**Durum:** 🐛 Bug bulundu
**Bulgu:** `createTrainingProgram` içinde sporcu araması sadece organizasyona göre yapılıyor (`actions/programs.ts:103-105`), `trainerId` kontrolü yok. Sayfadaki sporcu seçici de tüm aktif üyeleri listeliyor. Buna karşın `toggleTrainingProgramActive` doğru şekilde `trainerId: context.userId` ile scoped — program *oluşturma* korumasız, program *aç/kapa* korumalı, tutarsız.
**Yetkilendirme notu:** Roadmap.md:1782'deki "TRAINER kendi müşterisi olmayana da program yazabiliyor" bulgusu hâlâ **aktif**, ürün kararı beklendiği için düzeltilmemiş.
**Öneri:** Ürün kararı verilirse `createTrainingProgram`'a da `gymMember.trainerId !== context.userId` kontrolü eklenmeli.

#### 5. Ölçü girme
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `addHealthMeasurement` işlevsel olarak çalışıyor ama `gymMember` araması sadece organizasyon bazlı (`actions/measurements.ts:219-221`), `trainerId` kontrolü yok.
**Yetkilendirme notu:** Madde 2'deki aynı boşluk — bir TRAINER kendi sporcusu olmayan herhangi bir üyeye ölçüm ekleyebiliyor.
**Öneri:** Aynı `trainerId` guard'ı eklenmeli.

#### 6. Fotoğraf ekleme
**Durum:** ✅ Çalışıyor (yetkilendirme hariç)
**Bulgu:** Tam zincir doğrulandı: form → `uploadMeasurementPhoto` → doğrulama → R2'ye `PutObjectCommand` → `MeasurementPhoto` satırı. Galeri açı etiketiyle (`FRONT/SIDE/BACK/OTHER`) gösteriliyor.
**Yetkilendirme notu:** Aynı kök sorun — `gymMember` araması `trainerId` kontrolü içermiyor.
**Öneri:** Aynı guard.

#### 7. Sporcuyla mesajlaşma
**Durum:** ✅ Çalışıyor
**Bulgu:** `DirectMessage` modeli kalıcı, iki yönlü. `sendDirectMessage` kaydediyor, Soketi/Pusher event yayınlıyor, push bildirimi gönderiyor. İstemci `MessageLiveRefresh` WS kanalına bağlanıp yenileniyor; Soketi yoksa SSE fallback var — sağlam. Eski mesajlar doğru sırada yükleniyor, okundu bilgisi takip ediliyor.
**Yetkilendirme notu:** `loadPeerDirectory` TRAINER'a organizasyondaki tüm personel ve tüm sporcuları alıcı olarak sunuyor — "sadece kendi sporcum" kısıtı yok (kasıtlı olabilir).
**Öneri:** Yok; istenirse alıcı listesinde "benim sporcularım" bölümü öne çıkarılabilir.

#### 8. Beslenme
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `MemberNutritionLogView` günlük toplam kaloriyi, aktif beslenme programının hedef kalorisini ve gün bazlı öğün listesini gösteriyor — sadece ham liste değil, hedefle karşılaştırma var.
**Yetkilendirme notu:** Madde 2 ile aynı kök sorun — bu görünüm PT'nin kendi sporcusu olup olmadığına bakılmadan render ediliyor.
**Öneri:** Haftalık/trend grafiği eklenebilir (madde 9'a bakınız).

#### 9. İlerleme grafikleri
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** Tek grafik bileşeni `MeasurementSparkline` — son 6 noktayı gösteren küçük bir SVG polyline, tooltip/etkileşim yok. Sadece kilo/yağ oranı/bel çevresi için çiziliyor; göğüs/kalça/kol/uyluk/beslenme kalorisi/hedef ilerlemesi için hiçbir grafik yok.
**Yetkilendirme notu:** N/A.
**Öneri:** Kalori trendi ve diğer ölçüm alanları için de sparkline/grafik.

#### 10. Performans
**Durum:** ❌ Yok
**Bulgu:** PT'nin kendi performansı görülebiliyor ama "sporcularım toplu olarak nasıl gidiyor" (katılım oranı, hedef tamamlama) türünde hiçbir agregasyon yok. `/dashboard/reports` TRAINER'a tamamen kapalı.
**Yetkilendirme notu:** N/A — özellik yok.
**Öneri:** Trainer detay sayfasına "sporcularım" bölümü: atanmış sporcu sayısı, hedef tamamlama oranı, son 30 gün katılım özeti.

#### 11. Komisyon
**Durum:** ✅ Çalışıyor
**Bulgu:** 43.1 düzeltmesi kodda gerçek — pasif PT'ler "Pasif" rozetiyle listede kalıyor, sayfa 404 vermiyor. `calculateSessionCommission` üç modeli (FIXED/PERCENTAGE/TIERED) doğru hesaplıyor, test edilmiş.
**Yetkilendirme notu:** Doğru scoped — TRAINER otomatik kendi ID'sine yönlendiriliyor, başka bir PT'nin komisyonunu göremiyor.
**Öneri:** Yok, sağlam.

#### 12. Prim
**Durum:** ❌ Yok (ayrı bir kavram değil)
**Bulgu:** Şemada ayrı bir "bonus"/"prim" alanı yok; `PtSession.commissionAmount` tek para alanı, "prim" Türkçe metinlerde bu tutarın eş anlamlısı. Tek seferlik prim/ikramiye sistemi yok.
**Yetkilendirme notu:** N/A.
**Öneri:** Eğer komisyondan ayrı, tek seferlik bir "prim/ikramiye" konsepti isteniyorsa yeni bir model gerekir.

#### 13. PT değiştirme
**Durum:** ⚠️ Kısmen çalışıyor (eksik var)
**Bulgu:** `reviewTrainerRequest` doğru çalışıyor — onayda `trainerId` güncelleniyor, audit log yazılıyor. Ama bildirim sadece sporcuya gidiyor — **eski PT'ye ve yeni PT'ye hiçbir push/bildirim gönderilmiyor.**
**Yetkilendirme notu:** Sayfalar dinamik render edildiği için bozuk/eski referans riski yok, ama madde 2'deki "benim sporcularım" listesinin olmaması nedeniyle PT kaybedilen sporcuyu proaktif olarak öğrenemiyor.
**Öneri:** `reviewTrainerRequest` içine eski/yeni PT için de `sendPushToUser` çağrısı eklenmeli.

### PT/Antrenör Persona — Denetim Özeti (ajan bulgusu)
- **Kritik** — Satır seviyesi yetkilendirme boşluğu: TRAINER, üye detay sayfası, ölçüm/fotoğraf ekleme ve program oluşturma akışlarında **kendi sporcusu olup olmadığına bakılmaksızın** her üyeye erişip veri yazabiliyor.
- **Yüksek** — "Bugünkü sporcularım/derslerim" konsepti hiç yok.
- **Yüksek** — `/dashboard/classes` TRAINER'a tamamen kapalı — kendi grup dersinin yoklamasını göremiyor.
- **Yüksek** — PT değişikliğinde ne kaybeden ne kazanan PT'ye bildirim gidiyor.
- **Orta** — PT girişte kişiselleştirilmemiş genel dashboard'u görüyor (salon geneli ciro/stok verisi dahil).
- **Orta** — `createTrainingProgram`'da sporcu-antrenör eşleşmesi hiç kontrol edilmiyor.
- **Orta** — İlerleme grafikleri çok sınırlı (sadece 3 ölçüm alanı, mini sparkline).
- **Düşük** — PT bazlı toplu performans görünümü yok.
- **Düşük** — "Prim" ayrı bir kavram değil.
- **Düşük** — Kapasitesi dolu antrenörler listeden filtrelenmiyor; mobil uygulama tamamen sporcu odaklı, PT'ye özel mobil deneyim hiç yok.

Sabah sisteme giriş.

Bugünkü sporcular.

Bugünkü dersler.

Program düzenleme.

Ölçü girme.

Fotoğraf ekleme.

Sporcuyla mesajlaşma.

Beslenme.

İlerleme grafikleri.

Performans.

Komisyon.

Prim.

PT değiştirme.

PT'nin günlük hayatındaki her ekranı tek tek gezeceğim.

4. Sporcu

Gerçek kullanıcı gibi davranacağım.

#### 1. İlk kayıt
**Durum:** ❌ Yok (kritik, Faz 43'te bile flaglenmemiş yeni bulgu)
**Bulgu:** Kod tabanında sporcunun kendi kendine kayıt olabileceği HİÇBİR yol yok — ne web'de ne mobilde bir `/register` sayfası var. Personel tarafında da bir sporcuya giriş bilgisi (User hesabı) oluşturan/bağlayan HİÇBİR action/UI yok: `addGymMember` sadece bir `GymMember` satırı yaratır, `userId` alanına asla dokunmaz. `GymMember.userId` alanının prod kodunda hiçbir yerde set edildiği yok — tek istisna `seed.ts` (yalnızca demo verisi).
**Gerçek kullanıcı deneyimi:** Sporcu telefonuna uygulamayı indirse bile giriş ekranından öteye geçemez — e-posta/parola hiçbir ürün akışından üretilmiyor. Bu bir "yarım özellik" değil, **eksik bir özellik**.
**Öneri:** Üye detay sayfasına "Portal/Mobil erişimi oluştur" butonu — geçici parola üretip e-posta ile gönderen, `GymMember.userId`'yi dolduran bir action.

#### 2. Telefonundan giriş
**Durum:** ✅ Çalışıyor (ama akış OTP değil, klasik e-posta/parola)
**Bulgu:** `LoginScreen.tsx` sade bir e-posta+parola formu; `/api/v1/auth/login`'e `scope:'athlete'` ile POST atıyor. Sunucu `bcryptjs.compare` ile doğruluyor, Bearer token döndürüyor — düzgün, tenant-izole.
**Gerçek kullanıcı deneyimi:** Akıcı (haptic geri bildirim, parola göster/gizle var) — ama telefon/SMS OTP bekleyen kullanıcı için "e-posta hatırlamak" ek sürtünme. Madde 1'deki sorun nedeniyle ilk kez gelen sporcunun elinde giriş bilgisi bile olmayabilir.
**Öneri:** "Parolamı unuttum" linki mobilde yok, eklenmeli.

#### 3. Kart ekleme
**Durum:** ❌ Yok
**Bulgu:** Kod tabanında `cardToken`/`savedCard`/`CardToken` gibi kayıtlı-kart kavramı YOK. Iyzico/PayTR entegrasyonu her zaman **hosted checkout** üretir, kart bilgisi asla SGMS tarafında saklanmaz.
**Gerçek kullanıcı deneyimi:** Sporcu her ödeme için kartını yeniden girmek zorunda — "kayıtlı kartlarım" ekranı hiç yok.
**Öneri:** Iyzico'nun kayıtlı kart API'si entegre edilebilir, en azından PSP-seviyesi tokenization ile tek tıkla yenileme sağlanabilir.

#### 4. Üyelik satın alma (ilk kez)
**Durum:** ❌ Yok — staff müdahalesi zorunlu
**Bulgu:** Mobil `api.ts`'te sadece `startMembershipRenewal()` var, "ilk satın alma" diye ayrı bir fonksiyon yok. `startMembershipRenewalCheckout` `member.planId` yoksa açıkça hata döner: "Üyeliğinize atanmış bir paket yok. Lütfen resepsiyona başvurun."
**Gerçek kullanıcı deneyimi:** "Üyeliğimi Yenile" butonu yalnızca **halihazırda bir paketi olan** sporcu içindir — yepyeni bir kullanıcı hiçbir şekilde uygulama üzerinden ilk üyeliğini satın alamaz. Madde 1 ile birleşince mobil uygulamanın "yeni müşteri kazanımı" için hiçbir işlevi yok.
**Öneri:** Planı boş sporcular için "Paket satın al" akışı (teknik altyapı Iyzico/PayTR hazır, ürün kararı gerekir).

#### 5. Üyelik yenileme
**Durum:** ✅ Çalışıyor
**Bulgu:** Uçtan uca doğrulandı: mobil `handleRenew` → `/api/v1/me/membership/renew` → `startMembershipRenewalCheckout` → ücretsiz paket anında uzatma, ücretli ise Iyzico/PayTR checkout URL'i, `Linking.openURL` ile açılıyor. Ödeme onayı webhook'la geldiğinde üyelik uzatılıyor (güvenli tasarım).
**Gerçek kullanıcı deneyimi:** Akıcı, tek dokunuş. Ama **ödeme bitince uygulamaya otomatik dönüş yok** — `sgms-athlete://` şeması tanımlı ama `Linking.addEventListener`/`expo-linking` kullanımı sıfır; kullanıcı elle uygulamaya dönüp yenilemesi gerekiyor.
**Öneri:** `App.tsx`'e deep-link dinleyici eklenip ödeme sonrası otomatik dönüş+refresh sağlanmalı.

#### 6. Check-in
**Durum:** ✅ Çalışıyor, iyi tasarlanmış
**Bulgu:** `HomeScreen`'deki CTA `CheckInQrModal`'ı açıyor; `/api/v1/check-in/qr` kısa ömürlü, otomatik yenilenen (240sn) token üretiyor. Modal kapanınca arka plan isteği kalmıyor.
**Gerçek kullanıcı deneyimi:** Gerçekçi ve hızlı — QR ana sayfada gereksiz otomatik açılmıyor, dokununca büyük okunaklı kod + geri sayım halkası var.
**Öneri:** Yok.

#### 7. Program görüntüleme
**Durum:** ⚠️ Kısmen çalışıyor (mobilde ciddi eksik)
**Bulgu:** Mobil `ProgramsScreen` içeriği **hiç yapısal olarak render etmiyor** — sadece "X günlük plan" veya ham `notes` metni gösteriyor, egzersiz/set/tekrar/ağırlık listesi mobilde YOK. Web `athlete/programs/page.tsx` ise Faz 34.6'nın tam `InteractiveWorkoutView`'ını kullanıyor — günlere/egzersizlere bölünmüş, işaretlenebilir, ilerleme takipli.
**Gerçek kullanıcı deneyimi:** Salonda telefonuyla antrenman yapan bir sporcu için mobil ekran işe yaramaz düzeyde yetersiz — PT'sinin yazdığı programı görmek için web tarayıcısına geçmek zorunda.
**Öneri:** Web'deki `InteractiveWorkoutView` mantığı mobile taşınmalı.

#### 8. Beslenme
**Durum:** ✅ Çalışıyor
**Bulgu:** Uçtan uca doğrulandı: create/list/delete tam işlevsel (`NutritionScreen` → `createFoodLogEntry`/`deleteFoodLogEntry` → API route → `actions/nutrition.ts`, Zod doğrulama + sahiplik kontrolü var). Liste/özet salonun timezone'una göre günlere gruplanıyor, `plannedDailyCalories` hesaplanıyor.
**Gerçek kullanıcı deneyimi:** İyi tasarlanmış — günlük toplam kalori büyük puntoyla, PT hedefiyle karşılaştırma var. Eksik: kayıt **düzenleme** yok, yalnızca ekle/sil.
**Öneri:** `PATCH /api/v1/nutrition/[id]` eklenip düzenleme desteklenebilir.

#### 9. Mesaj
**Durum:** ⚠️ Kısmen çalışıyor (gerçek zamanlı değil, arka planda bildirim yok)
**Bulgu:** Mobil `MessagesScreen` **15 saniyelik polling** kullanıyor, WebSocket/Soketi/SSE'ye hiç bağlanmıyor — oysa sunucuda `/api/v1/messages/events` SSE endpoint'i zaten hazır, mobil bunu kullanmıyor. `isRead` alanı backend'de var ama mobil UI'da hiç render edilmiyor.
**Gerçek kullanıcı deneyimi:** Uygulama açıkken "yeterince hızlı" ama PT'den gelen mesajı görmek için uygulamayı elle açıp beklemek gerekiyor.
**Öneri:** Mobilin SSE'ye bağlanması + push bildirim (madde 14) öncelenmeli.

#### 10. PT değiştirme
**Durum:** ⚠️ Kısmen çalışıyor (oluşturma/iptal sağlam, sonuç görünürlüğü eksik)
**Bulgu:** Talep oluşturma/iptal uçtan uca çalışıyor. Ancak `loadAll()` yalnızca `status === 'PENDING'` talebi state'e alıyor — APPROVED/REJECTED/CANCELLED geçmişi ekranda **hiç gösterilmiyor** (Faz 43.10 doğrulandı, hâlâ düzeltilmemiş).
**Gerçek kullanıcı deneyimi:** Talep reddedilince/onaylanınca ekranda hiçbir sonuç bildirimi yok; push da olmadığından sonucu öğrenmek tesadüfe kalıyor.
**Öneri:** Son 1-2 karara ait basit bir "Geçmiş" bölümü eklenmeli.

#### 11. Market
**Durum:** 🐛 Bug bulundu
**Bulgu:** Temel akış çalışıyor ama **stok düşümü ve `Expense` (OPEN) oluşturma, ödeme onaylanmadan önce, checkout URL üretilirken hemen yapılıyor**. Sporcu ödeme sayfasını kapatır/tamamlamazsa: stok kalıcı olarak düşük kalıyor (geri ekleyen kod yok), `Expense` `OPEN` durumda kalıp sporcunun bakiyesine **hayalet borç** olarak yansıyor.
**Gerçek kullanıcı deneyimi:** Ödeme sayfasını yarıda kapatan sporcu hem "borcum var" uyarısıyla karşılaşır hem de satın almadığı ürün stoktan düşmüş olur.
**Öneri:** Süresi dolmuş/iptal edilmiş `TenantCheckoutSession`'lar için temizlik job'ı — ilişkili `OPEN` `Expense`'leri silip stoğu geri eklemeli.

#### 12. Borç
**Durum:** ⚠️ Kısmen çalışıyor (görünürlük var, mobilde ödeme yolu eksik)
**Bulgu:** Mobil "Bakiye" kartı doğru gösteriyor. Ancak borç varsa mobilde tek seçenek "Ödemenizi resepsiyonda yapabilirsiniz" — web'deki "kartla öde" seçeneğine eşdeğer bir yol mobilde YOK.
**Gerçek kullanıcı deneyimi:** Sporcu borcunu görebiliyor ama telefonundan ödeyemiyor — mağaza/yenileme kartla ödenebilirken genel bakiye için resepsiyona gitmek şart, tutarsız.
**Öneri:** `POST /api/v1/me/pay-balance` eklenip `startTenantCardCheckout` deseni mobile de açılmalı.

#### 13. Taksit
**Durum:** ✅ Çalışıyor
**Bulgu:** Mobil "Ödeme Planı" kartında her taksidin sırası/vade/ödenen-toplam tutarı gösteriliyor.
**Gerçek kullanıcı deneyimi:** Anlaşılır — sadece salt-okunur (taksidi doğrudan mobilden ödeme yok, madde 12'yle aynı kök).
**Öneri:** Madde 12'deki online ödeme köprüsü eklenince otomatik ödenebilir hale gelir.

#### 14. Bildirimler
**Durum:** ❌ Yok (Faz 43.8'de zaten flaglenmiş, doğrulandı: hâlâ çözülmemiş)
**Bulgu:** `apps/mobile/package.json`'da `expo-notifications` bağımlılığı **yok**. Mevcut bildirim altyapısı tarayıcı Web Push — native mobil uygulamaya hiç ulaşmıyor.
**Gerçek kullanıcı deneyimi:** Uygulama arka plandayken/kapalıyken sporcu HİÇBİR bildirim almaz — ne PT talebi sonucu, ne yeni mesaj, ne üyelik bitişi.
**Öneri:** `expo-notifications` kurulumu + izin akışı + `DeviceToken` modeli + Expo Push API entegrasyonu.

#### 15. QR
**Durum:** ✅ Çalışıyor
**Bulgu:** Madde 6 ile aynı mekanizma — kısa ömürlü, otomatik yenilenen QR (`react-native-qrcode-svg`). Ayrı bir "dijital üyelik kartı" QR'ı yok, check-in QR'ı bu amacı da karşılıyor.
**Gerçek kullanıcı deneyimi:** Basit, hızlı, güvenlik tasarımı doğru (statik olmadığı için suistimal edilemez).
**Öneri:** Yok.

#### 16. Wallet
**Durum:** ❌ Yok (bilinçli ertelenmiş)
**Bulgu:** Apple/Google Wallet entegrasyonu için hiçbir iz yok. Roadmap bunu "Faz 26 ← P2, imzalama sertifikası gerekli (henüz yok)" olarak backlog'da tutuyor — unutulmuş değil, bilinçli erteleme.
**Gerçek kullanıcı deneyimi:** Pratik fark küçük, QR zaten güvenli/anlık çalışıyor.
**Öneri:** Öncelik değiştirilmesi gerekmiyor.

### Sporcu Persona — Denetim Özeti (ajan bulgusu)
- **Kritik** — İlk kayıt tamamen eksik: sporcunun mobil/web portal girişi alması için ürün içinde hiçbir yol yok; madde 4'teki "ilk üyelik satın alamama" ile birleşince mobil uygulama yeni müşteri kazanımında hiçbir rol oynamıyor.
- **Kritik** — Native push bildirim altyapısı yok (Faz 43.8 doğrulandı, hâlâ açık).
- **Kritik** — Mağaza checkout'unda stok/borç rollback bug'ı: ödeme tamamlanmadan stok düşülüyor ve OPEN borç açılıyor.
- **Yüksek** — Kayıtlı kart yönetimi hiç yok.
- **Yüksek** — Mesajlaşma gerçek zamanlı değil (15s polling, SSE altyapısı kullanılmıyor).
- **Yüksek** — Mobilden genel borç/taksit ödemesi yapılamıyor.
- **Orta** — PT talebi sonucu mobilde görünmüyor (yalnızca PENDING render).
- **Orta** — Antrenman programı mobilde interaktif değil.
- **Orta** — Ödeme sonrası uygulamaya otomatik dönüş yok.
- **Düşük** — Wallet/dijital kart yok ama bilinçli ertelenmiş (Faz 26); QR check-in zaten güvenli ve hızlı.

İlk kayıt

Telefonundan giriş

Kart ekleme

Üyelik satın alma

Üyelik yenileme

Check-in

Program görüntüleme

Beslenme

Mesaj

PT değiştirme

Market

Borç

Taksit

Bildirimler

QR

Wallet

Her şeyi inceleyeceğim.

Sonra ikinci aşama

Bundan sonra sistemi aşağıdaki açılardan inceleyeceğim.

> **Not:** Bu bölümdeki tüm bulgular çapraz analiz ajanı tarafından, önce `roadmap.md`'deki Faz 43 denetiminin `[x]` işaretli kalemleri koda karşı doğrulanarak (43.1-43.6, hepsi gerçekten kapatılmış), sonra yalnızca yeni/derinlemesine bulgular üreterek elde edildi. Bilinen açık `[ ]` kalemler (43.7 OWNER audit log, 43.8 mobil push, 43.9 üye seçici, 43.10 listesi) burada tekrar türetilmedi, sadece anımsatıldı.

UX

Butonlar doğru yerde mi?

Bir işlem kaç tıklama sürüyor?

Kafa karıştırıyor mu?

#### UX — Bulgular
- ⚠️ POS'ta "ürün sat" iki ayrı, bağlantısız adım: kategori butonu tıklanınca yalnızca borç (Expense) ekleniyor, tahsilat için kasiyer aynı tutarı ödeme formuna elle tekrar yazmak zorunda — yazım hatası riski (`apps/web/src/components/pos-terminal.tsx:189-289`).
- 🐛 "Bekleyen Dondurma Talepleri" onay listesi üye bazlı değil **organizasyon genelinde** her tek üyenin detay sayfasında tekrar render ediliyor — Ahmet'in profiline girip Ayşe'nin talebini onaylayabilirsiniz (`members/[id]/page.tsx:92-96` sorgusu `gymMemberId` filtresi yok). Dedike bir "Onay Bekleyenler" merkezi sayfası yok.
- ⚠️ Yeni üye ekleme formu 3 adımlı sihirbaz (`add-member-form.tsx:69,194,245`) — hızlı resepsiyon senaryosunda en az 3× "İleri" + 1× "Kaydet".
- ✅ Ürün satışı: üye seçme + kategori butonu = 2 etkileşim, ekstra navigasyon yok.
- ⚠️ Dondurma onayı keşfedilebilirlik sorunu: dedike sayfa yoksa personel bunu tesadüfen bir üye profiline girene kadar bulamayabilir.
- ⚠️ PT komisyon KPI'sı trainer detay sayfasında STAFF dahil herkese aynı kartta gösteriliyor, ayrı bir erişim ayrımı yok.

İş Mantığı

Gerçek hayatta böyle çalışır mı?

Muhasebe açısından doğru mu?

Vergi açısından mantıklı mı?

Salon sahibi böyle ister mi?

#### İş Mantığı — Bulgular
- 🐛 **Erken dondurma çözme, kullanılmayan günleri geri almıyor:** `approveMembershipFreeze` üyeliği talep edilen TÜM gün sayısı kadar uzatıyor. `unfreezeMembership` erken çözüldüğünü tespit ediyor ama sonuç olarak **hiçbir şey yapmıyor** (`actions/membership-lifecycle.ts:290-298`, "// Erken çözme" yorumunun altında kod yok). 30 gün dondurup 5 gün sonra dönen üye kullanmadığı 25 günü bedavaya kazanıyor.
- 🐛 **PT randevusunda çift-rezervasyon koruması yok:** `schedulePtSession` aynı antrenöre aynı saatte ikinci seans planlanmasını engellemiyor — hiçbir `scheduledAt` çakışma sorgusu yok (`actions/trainers.ts:134-183`).
- 🐛 **Aynı üyeliği eşzamanlı yenileme → çift ücretlendirme riski:** `renewMembership`, `membershipEndsAt`'i transaction'ın **dışında** okuyup hesaplama yapıyor, sonra koşulsuz güncelliyor — iki kasiyer (veya çift tıklama) aynı üyeyi aynı anda yenilerse iki bağımsız `Expense`/`Transaction` oluşur (`actions/membership.ts:77-139`).
- ✅ PT komisyon hesaplama zamanlaması doğru: 21. seanstan itibaren bonus başlıyor, roadmap tanımıyla tutarlı.
- ⚠️ **Muhasebe:** Refund/void `Transaction.refundOfTransactionId` ile izlenebilir ve `AuditLog` yazılıyor (iyi) — ama VOID sonrası veri katmanında immutability yok, sadece UI'da rol gate'i var.
- ❌ **Vergi:** `Invoice`'da `invoiceNumber`/`taxId` var ama **KDV oranı/tutarı alanı hiçbir yerde yok** (`schema.prisma:1821-1868`) — fatura mali/e-fatura standardına uygun değil.
- ⚠️ **AccountDeletionRequest onaylanınca hiçbir şey silinmiyor:** GDPR talebi sadece kayıt altına alınıyor, gerçek silme/anonimleştirme pipeline'ı yok.

Veri Modeli

Tablolar yeterli mi?

Eksik entity var mı?

Yanlış ilişki var mı?

Normalization problemi var mı?

#### Veri Modeli — Bulgular
- ✅ Fatura, kupon, kasa vardiyası, üyelik dondurma/devir için ayrık, normalize tablolar var — genel model olgun.
- ❌ **Hediye üyelik / cari kredi (store credit/wallet) için ayrı bir model yok.** `MembershipTransfer.creditAmount` sadece tek seferlik mahsup; genel amaçlı, sonradan kullanılabilir bakiye/kredi hesabı yok.
- ❌ **Şube (Branch) ayrı bir model olarak yok** — Faz 30 hiyerarşisi `Organization.parentOrganizationId` self-relation'ıyla çözülmüş, tek bir "tip" alanı olmadan anlam karmaşasına açık.
- 🐛 **KDV/Vergi oranı modeli tamamen eksik** (bkz. İş Mantığı).
- 🐛 **Cascade delete finansal geçmişi silebilir — teorik değil, gerçek bir aksiyon var:** `Organization` → `Expense`/`Transaction`/`Invoice`/`PtSession`/`PaymentIntent` tamamı `onDelete: Cascade`. Master Admin panelindeki `hardDeleteOrganization` gerçekten `prisma.organization.delete()` çağırıyor (`actions/admin-organizations.ts:678`) — tek güvenlik önlemi organizasyon adını elle yazarak onaylamak. Tüm bir salonun yıllarca birikmiş finansal/sağlık/denetim verisi tek bir aksiyonla, zorunlu yedekleme adımı olmadan kalıcı olarak yok edilebilir.
- ⚠️ `DiscountCode.organizationId` nullable — global-kupon senaryosu için tasarlanmış ama oluşturma yolu her zaman tenant-scoped, doğrulama sorgusu `null` satırları asla eşleştirmiyor — şemadaki global-kupon kapasitesi hiçbir zaman kullanılamayan, ölü bir tasarım.
- ✅ `TrainingProgram.content` JSON blob kullanımı makul bir tasarım kararı; `ExerciseSetLog` ayrı normalize tablo olarak ilerleme takibini doğru ayırmış.

Yetkilendirme

Kasiyer bunu görebilmeli mi?

PT bunu değiştirebilmeli mi?

Owner bunu silebilmeli mi?

Master Admin bunu görebilmeli mi?

#### Yetkilendirme — Rol-Görünürlük Matrisi

| # | Kaynak/Aksiyon | OWNER | ADMIN | STAFF | TRAINER | ATHLETE | Master Admin |
|---|---|---|---|---|---|---|---|
| 1 | PT komisyon tutarını görüntüleme | Evet | Evet | **Evet**⚠️ | Kısmi¹ | Hayır | Hayır |
| 2 | Üyelik dondurma onaylama | Evet | Evet | Evet² | Hayır | Hayır (sadece talep) | Hayır |
| 3 | Başka bir sporcunun sağlık ölçümlerini görüntüleme | Evet | Evet | Evet | **Evet**³⚠️ | Hayır (sadece kendi) | Hayır |
| 4 | Üye silme/deaktive etme | Evet | Evet | Evet⁴ | Hayır | Hayır | Evet (farklı kapsam) |
| 5 | Antrenör talebi "reason" alanını görüntüleme | Evet | Evet | Hayır⁵ | Hayır | Evet (kendi talebi) | Hayır |
| 6 | Master Admin bir tenant'ı impersonate etme | — | — | — | — | — | **Yok**⁶ |
| 7 | Organizasyon ödeme ağgeçidi ayarlarını düzenleme | Evet | Evet | Hayır⁷ | Hayır | Hayır | Hayır (ayrı ayar) |
| 8 | Çapraz organizasyon verisi görüntüleme | Hayır | Hayır | Hayır | Hayır | Hayır | Evet⁸ (by design) |

¹ Sadece kendi seansları (`dashboard/trainers/[id]/page.tsx:28-29`).
² `MANAGER_ROLES = OWNER/ADMIN/STAFF` (`actions/membership-lifecycle.ts:16-27`) — Faz 43.10'da bilinen açık madde.
³ `members/[id]/page.tsx:60-70` sorgusunda `trainerId` filtresi yok — herhangi bir TRAINER kendi sporcusu olmayan üyenin `healthMeasurements`'ını tamamen görebiliyor (PT persona madde 2/5 ile aynı kök).
⁴ `MANAGER_ROLES` (`lib/api/guard.ts:25-27`); işlem soft-delete (`api/v1/members/[id]/route.ts:137-140`).
⁵ `ADMIN_ROLES = OWNER/ADMIN`, şema yorumuyla tutarlı.
⁶ Kod tabanında hiçbir "impersonate/login-as" mekanizması yok — Master Admin sadece salt-okunur panelden görüntülüyor, tenant oturumu açamıyor. Güvenlik açığı değil ama beklenen "destek amaçlı bakabilme" özelliği tamamen eksik.
⁷ `actions/tenant-payment-gateway.ts:14-15`.
⁸ Master Admin + Faz 30 `HierarchyMember` ile kendi ağacı içinde konsolide görüntüleme — spot-check edilen tüm action'lar `organizationId` filtresi kullanıyor, çapraz-org sızıntısı bulunamadı.

**Yeni bulgu (⚠️ #1, #3):** STAFF'in PT komisyon tutarlarını görebilmesi ve herhangi bir TRAINER'ın kendi müşterisi olmayan sporcuların sağlık verisine erişebilmesi — sistemin başka yerlerde (finansal panel TRAINER'dan saklanıyor, Faz 36.5) uyguladığı hassasiyetin komisyon/sağlık verisinde uygulanmadığını gösteriyor — tutarsız bir yetkilendirme deseni.

Finans

Eksik ödeme senaryoları

İade

Kısmi iade

Kredi

Hediye üyelik

Kupon

Promosyon

Şube transferi

Aidat

Komisyon

#### Finans — Bulgular
- ✅ **İade/Kısmi iade:** Tam ve kısmi iade destekleniyor — `Transaction.refundOfTransactionId` self-relation ile izleniyor.
- ❌ **Kredi (store credit):** Yok. `creditRemainingRights` bir üyeye tek seferlik `ADJUSTMENT` transaction'ı yazıyor ama kalıcı, tekrar kullanılabilir bir bakiye değil.
- ❌ **Hediye üyelik:** Şemada veya action'larda hiçbir "gift" alanı/akışı yok.
- ✅ **Kupon:** `DiscountCode`/`DiscountRedemption` mevcut — ama global-kupon ölü kod sorunuyla (bkz. Veri Modeli).
- ⚠️ **Promosyon:** `validFrom`/`validUntil` zaman kısıtlaması sağlıyor, ayrı bir "kampanya" kavramı yok — kabul edilebilir.
- ❌ **Şube transferi (proration):** Yok — `transferMembership` sadece **tek bir organizasyon içinde** iki `GymMember` arasında kalan gün devri yapıyor, farklı organizasyonlar arası taşıma desteklenmiyor.
- ✅ **Aidat:** Otomatik değil, manuel tetiklemeli — bilinçli bir kapsam kararı gibi görünüyor.
- 🐛 **Komisyon değil ama gösterim hatası — çok önemli:** Ana dashboard KPI'sı tüm para birimlerini FX çevrimi yapmadan doğrudan topluyor (`lib/dashboard-kpis.ts:75`) — multi-currency bir salonda "1000 TRY + 100 USD" dashboard'da "1.100 ₺" olarak gösterilir, anlamsız ve yanıltıcı.
- 🐛 **Aynı hata kurumsal konsolide raporda daha derin:** `getCollectedRevenueByOrganization` para birimi ayrımı yapmadan grupluyor — bir şubenin USD geliri TRY geliriyle doğrudan toplanıyor (`lib/reports/revenue.ts:122-166`, `lib/enterprise/queries.ts:53,81,89`).
- ⚠️ **Webhook başarısız sonra kalıcı olarak "failed" kalabilir:** Claim deseni doğru/idempotent ama transaction içi hata durumunda session `failed` yapılıyor ve webhook tekrar denese de bir daha işlenmiyor — ödeme ağgeçidinde başarılı olduysa ama DB'de geçici hata olduysa otomatik mutabakat mekanizması yok.

Hata Senaryoları

İnternet giderse?

Elektrik kesilirse?

POS hata verirse?

Turnike açılmazsa?

Ödeme yarıda kalırsa?

Çift ödeme olursa?

İki kasiyer aynı üyeyi aynı anda düzenlerse?

#### Hata Senaryoları — Bulgular
- **İnternet giderse (mobil):** `apiFetch` network hatasında yakalanmamış bir `TypeError` fırlatır; offline kuyruk/retry mekanizması yok — kullanıcı işlemi manuel tekrar denemek zorunda.
- **Elektrik kesilirse (POS ortasında):** Her POS aksiyonu ayrı bir `prisma.$transaction` içinde — kesinti commit'ten önce olursa Postgres otomatik rollback yapar, tutarsız yarım kayıt oluşmaz (✅ iyi tasarım).
- **POS/ödeme ağgeçidi hata verirse:** Iyzico/PayTR webhook'ları hash/imza doğrulaması yapıyor, başarısız işlemi `failed` işaretliyor (✅ makul).
- **Turnike açılmazsa:** SGMS'te turnikeye "aç" komutu gönderen bir yol **yok** — webhook sadece cihazın zaten gerçekleştirdiği bir olayı pasif kaydediyor; donanım arızası için proaktif alarm yok.
- **Ödeme yarıda kalırsa:** `pending` kalan `TenantCheckoutSession` kayıtları için hiçbir süre-aşımı/temizlik cron'u yok — kullanıcı checkout'u başlatıp sayfayı kapatırsa kayıt sonsuza kadar "pending" kalır (yetim kayıt — Market bug'ıyla aynı köke bağlı).
- **Çift ödeme/duplicate webhook:** ✅ İyi korunmuş — atomik claim deseni (`updateMany` pending→processing) hem tenant hem platform tarafında tutarlı, aynı webhook iki kez gelse sessizce çıkıyor.
- **İki kasiyer aynı üyeyi aynı anda düzenlerse:** Optimistic locking/versiyon alanı **hiçbir modelde yok** — tüm `update` çağrıları koşulsuz yazıyor, son yazan sessizce kazanıyor (`renewMembership` özelinde çift ücretlendirmeye kadar gidiyor).

Ölçeklenebilirlik

100 üye

1.000 üye

10.000 üye

100 salon

500 salon

1 milyon sporcu

Nerelerde darboğaz oluşur?

#### Ölçeklenebilirlik — Bulgular
- 🐛 **N+1 sorgu — PT roster sayfası:** `listTrainersWithMonthlyStats` her antrenör için ayrı bir `getTrainerMonthlyStats` çağrısı yapıyor (`Promise.all` içinde). **Yaklaşık eşik: 50-100 antrenör** civarında sayfa gecikmesi fark edilir hale gelir.
- 🐛 **In-memory agregasyon — operasyonel raporlar:** `getOperationalReport` seçilen aralıktaki TÜM check-in/expense/PT session kayıtlarını çekip Node.js'te hesaplıyor — SQL tarafında yapılması gereken bir agregasyon uygulama katmanına taşınmış. **Yaklaşık eşik: 2.000-5.000 aktif üye** ve 90 günlük rapor aralığında belirgin yavaşlama.
- ✅ **İyi tasarlanmış agregasyon:** `getRevenueForPeriod`/`getCollectedRevenueByOrganization` `prisma.groupBy` kullanıyor — DB tarafında toplanıyor, **500 organizasyon** ölçeğinde bile sorun büyümez.
- ✅ **Doğru indeksleme:** `GymMember` üzerinde sık filtrelenen alanlar (`organizationId+status`, `+lastName/firstName`, `+trainerId`) indeksli; ana üye listesi düzgün sayfalama kullanıyor.
- ⚠️ **POS/check-in üye seçici** (Faz 43.9) `take:200` + arama yok — **200+ aktif üyeli** bir salonda listenin sonu erişilemez hale geliyor; bu sadece UX değil gerçek bir kullanılabilirlik tavanı.
- 📌 **1M sporcu / 500 org ölçeğinde genel değerlendirme:** `groupBy` tabanlı raporlar bu ölçekte sorun yaratmaz; asıl risk "kaç org var" değil "en büyük tek salon ne kadar büyük" sorusu — N+1 antrenör istatistiği ve in-memory rapor bucketing'i **tek bir organizasyon içinde 5.000+ üye** olduğu anda darboğaz haline gelir.

#### Çapraz Analiz — Özet (ajan bulgusu)
- **Kritik** — Üyelik dondurma erken çözüldüğünde kullanılmayan günler geri alınmıyor — doğrudan ücretsiz gün/gelir kaybı.
- **Kritik** — Dashboard ve kurumsal konsolide rapor farklı para birimlerini FX çevrimi yapmadan doğrudan topluyor — multi-currency salonda "ciro" rakamı anlamsız.
- **Kritik** — `renewMembership`'te eşzamanlılık koruması yok — çift ücretlendirme riski.
- **Yüksek** — Master Admin'in `hardDeleteOrganization` aksiyonu cascade-delete nedeniyle bir salonun TÜM finansal/sağlık geçmişini tek işlemde, geri dönüşsüz siliyor.
- **Yüksek** — Fatura modelinde KDV oranı/tutarı alanı hiç yok.
- **Yüksek** — PT randevu planlamasında çakışan saatte ikinci seans engellenmiyor.
- **Yüksek** — STAFF herhangi bir PT'nin aylık komisyon tutarını görebiliyor.
- **Orta** — TRAINER kendi müşterisi olmayan sporcunun sağlık ölçümlerini görüntüleyip ekleyebiliyor.
- **Orta** — Şube-transferi (farklı organizasyonlar arası) hiç desteklenmiyor.
- **Orta** — Operasyonel raporlar SQL-side agregasyona geçmeli.
- **Orta** — PT roster N+1 sorgu deseni.
- **Düşük** — Dondurma onay paneli her üye sayfasında org-geneli listeyi tekrarlıyor.
- **Düşük** — Şemadaki global kupon desteği ölü kod.
- **Düşük** — GDPR silme talebi onaylandığında otomatik pipeline tetiklenmiyor.

Rakip Analizi

Bu sistem;

GymMaster

ABC Glofox

Mindbody

Virtuagym

Zen Planner

PushPress

Perfect Gym

ClubReady

gibi dünya çapındaki sistemlerle karşılaştırıldığında eksikleri neler?

### Karşılaştırma (kod denetimi + genel sektör bilgisiyle)

**SGMS'in bu ürünlere göre görece güçlü olduğu noktalar:**
- **Çoklu para birimi bakiye motoru** (Faz 36.2) — çoğu rakip tek para birimi varsayar veya bunu üst pakette sunar; SGMS bunu çekirdeğe gömmüş. *(Not: bu denetimde bakiye motorunun kendisi sağlam bulundu, ama dashboard/kurumsal raporlama katmanı para birimlerini yanlışlıkla topluyor — bkz. yukarıdaki "Finans" bölümü, Kritik madde. Motor güçlü, üzerine kurulu raporlama zayıf.)*
- **Bölgesel ödeme sağlayıcı desteği** (Iyzico/PayTR, Faz 8.7) — Mindbody/Glofox/PushPress gibi ABD merkezli ürünler varsayılan olarak Stripe'a bağımlı, Türkiye/EMEA pazarı için yerel gateway desteği SGMS'in gerçek bir farkı.
- **8 dilli i18n** (TR/EN/RU/AZ/ES/FR + devam eden IT/PT) — bölgesel rakiplerin çoğu bu kadar geniş bir dil kapsamına sahip değil.
- **PT komisyon/prim** çekirdek veri modeline gömülü (çoğu rakipte sonradan eklenmiş, yüzeysel bir alan) — ama bu denetimde komisyon *görünürlüğünün* STAFF'e de sızdığı, çakışan randevu koruması olmadığı ve "prim"in ayrı bir kavram olmadığı bulundu (bkz. PT persona + Çapraz Analiz).
- **Gerçek zamanlı mesajlaşma** (Soketi/WebSocket) — web tarafında güçlü; mobil tarafta bu altyapı hâlâ kullanılmıyor (15s polling, bkz. Sporcu persona madde 9) — **kısmi güç**.
- **Kendi self-servis mağazası** (Faz 40) ve **beslenme/kalori takibi** (Faz 41, bu denetim sırasında tamamlandı — aşağıya bakınız) — Virtuagym'in çekirdek farklarından ikisi artık SGMS'te de var, ama mağazada ödeme-öncesi stok/borç bug'ı bulundu (bkz. Sporcu persona madde 11).

**Bu ürünlerin SGMS'te bugün eksik olan, ama sektör standardı sayılan özellikleri:**
- **Native mobil push bildirim** — sektörün tamamında var, SGMS'te `expo-notifications` bağımlılığı hâlâ yok (bu denetimde 3 farklı persona tarafından ayrı ayrı doğrulandı: Owner, PT, Sporcu).
- **Wearable/sağlık entegrasyonu** (Apple Health, Google Fit, Fitbit, Garmin) — özellikle Virtuagym'in güçlü olduğu alan, SGMS'te hiç yok.
- ~~Beslenme/kalori takibi — Virtuagym'in çekirdek farkı, SGMS'te Faz 41 hâlâ yapılmadı.~~ **Güncelleme (2026-07-21):** Faz 41 bu gece tamamlandı — `FoodLogEntry` modeli, günlük özet, plan-vs-gerçekleşen karşılaştırması web+mobilde çalışıyor (bkz. Sporcu persona madde 8, PT persona madde 8). Rakip karşılaştırmasında artık bir **güç** olarak sayılabilir, ancak mobilde düzenleme (update) desteği ve PT tarafında trend grafiği hâlâ eksik.
- **Pazarlama otomasyonu** (e-posta/SMS drip kampanyaları, terk edilmiş sepet hatırlatması) — Glofox/PushPress/ClubReady'nin güçlü olduğu alan, SGMS'te yalnızca temel işlemsel e-posta var. *(İronik olarak bu denetimde SGMS'in kendi "terk edilmiş sepeti" — mağaza checkout'u — hatırlatma göndermek yerine sessizce hayalet borç/stok kaybına yol açtığı bulundu.)*
- **Video/on-demand içerik kütüphanesi** — Glofox ve Mindbody'de var, SGMS'te hiç yok.
- **Şube/franchise self-servis kurulumu** — Perfect Gym gibi kurumsal odaklı rakiplerde salon zinciri kendi şubesini kendi ekler; SGMS'te bu CiciByte süper-admin'e bağımlı (bu denetimde Owner persona madde 7'de tekrar doğrulandı).
- **Muhasebe yazılımı entegrasyonu** (QuickBooks/Xero) ve genel API/Zapier ekosistemi — SGMS'te dışa entegrasyon yüzeyi neredeyse yok; bu denetim ayrıca organizasyon-çapında ham işlem defterini dışa aktaracak bir CSV'nin bile olmadığını buldu (Owner persona madde 12).
- **Kiosk self-check-in cihaz modu** — SGMS'in QR/RFID check-in'i işlevsel olarak güçlü (bu denetimde her iki akış da sağlam bulundu) ama özel kiosk donanım/tablet modu yok.
- **Gerçek bir P&L/kâr-zarar raporu** — bu denetimde bulunan, roadmap'te önceden hiç bahsedilmemiş yeni bir sektör-standardı eksiği: rakiplerin hepsinde temel bir "gelir-gider-net kâr" görünümü var, SGMS'te işletme giderleri hiç modellenmediği için bu hesaplanamıyor (Owner persona madde 3, 11).

**Genel değerlendirme (güncellenmiş):** SGMS, operasyonel çekirdekte (üyelik yaşam döngüsü, POS/kasa, çok kiracılı mimari, PT komisyonu, çoklu şube iskeleti, artık beslenme takibi) olgun ve bazı noktalarda (bölgesel ödeme, çoklu para birimi *motoru*, i18n) rakiplerinden daha güçlü. Ama bu denetim, "büyüme/elde tutma" katmanındaki bilinen boşlukların (pazarlama otomasyonu, wearable, video içerik, native push) yanında, daha önce belgelenmemiş **operasyonel/finansal olgunluk sorunları** da ortaya çıkardı: gerçek bir P&L yok, multi-currency raporlama hatalı topluyor, PT randevu çakışması engellenmiyor, dondurma erken bitişi ücretsiz gün kaybına yol açıyor, sporcu kendi kendine kayıt olamıyor. Bunlar "eksik özellik" değil, **var olan özelliklerin gerçek hayatta yanlış/riskli çalıştığı** noktalar — bir ilk sürüm için beklenen ölçekte değil, aksine sistemin "olgun" göründüğü tam da bu alanlarda bulunmuş oldukları için daha kritik.

---

TESLİM EDİLECEK RAPORLAR;

Yönetici Özeti
Owner Senaryosu (uçtan uca)
Kasiyer Senaryosu
PT Senaryosu
Sporcu Senaryosu
Her senaryoda bulunan mantık hataları
UX problemleri
Eksik özellikler
İş akışı problemleri
Veri modeli eksikleri
Güvenlik açıkları
Finansal riskler
Gerçek hayatta oluşabilecek sorunlar
Önceliklendirilmiş geliştirme listesi (Kritik / Yüksek / Orta / Düşük)
Dünya standartlarına göre değerlendirme
"Bu ürünü bugün satışa çıkarsam ne olur?" analizi
Sonuç ve öneriler

---

# KAPSAMLI DENETİM RAPORU (2026-07-21)

> Bu rapor, 5 paralel denetim ajanının (Owner, Kasiyer/Resepsiyon, PT/Antrenör, Sporcu, Çapraz Analiz) gerçek kod tabanı üzerinde satır-satır yaptığı incelemenin sentezidir. Her bulgu, yukarıdaki ilgili madde altında dosya:satır referansıyla kanıtlanmıştır — bu rapor onların üstüne kurulu bir özet/önceliklendirme katmanıdır, spekülasyon içermez. Faz 43'teki (roadmap.md) önceki denetimin `[x]` işaretli kalemleri bu turda koda karşı yeniden doğrulanmış (gerçekten kapatılmış), açık `[ ]` kalemleri ise tekrar üretilmeden referans verilmiştir.

## Yönetici Özeti

SGMS'in operasyonel çekirdeği (check-in, POS, üyelik yaşam döngüsü, PT komisyonu, çok-kiracılı mimari) olgun ve genel olarak sağlam çalışıyor — QR/RFID check-in, mesajlaşma, çift-ödeme koruması gibi kritik akışlar iyi tasarlanmış ve test edilebilir durumda. Ancak bu denetim, ürünün "olgun göründüğü" tam da bu alanlarda, gerçek hayatta para kaybettirecek veya güven kırıcı **5 kritik sınıf sorun** buldu:

1. **Finansal doğruluk sorunları** — gerçek bir kâr-zarar tablosu yok, multi-currency dashboard/raporlama farklı para birimlerini yanlışlıkla topluyor, üyelik yenilemede çift ücretlendirme riski var, dondurma erken bitişi ücretsiz gün/gelir kaybına yol açıyor.
2. **Yetkilendirme sızıntıları** — bir PT, kendi sporcusu olmayan herhangi bir üyenin sağlık verisine/profiline erişip veri yazabiliyor; STAFF herhangi bir PT'nin komisyonunu görebiliyor.
3. **Yarım bırakılmış self-servis akışları** — sporcu kendi kendine kayıt olamıyor ve ilk üyeliğini satın alamıyor (mobil uygulama yeni müşteri kazanımında rol oynamıyor), mağaza checkout'u ödeme tamamlanmadan stok/borç işliyor (bug), PT seansı satışı muhasebeye hiç bağlı değil.
4. **Eksik "işletme sahibi" araçları** — merkezi bir uyarı/sorun merkezi yok (dashboard'da literal "Çok Yakında"), muhasebeye verilecek bir dışa aktarım yok, gün/ay sonu resmi kapanış raporu yok, üyelik iptali için web panelinde hiçbir arayüz yok.
5. **Mobil deneyim boşlukları** — native push bildirim altyapısı hiç yok, antrenman programı mobilde yapısal gösterilmiyor, mesajlaşma gerçek zamanlı değil (polling).

Sistem, "sıkı denetlenmeyen, tek şubeli, sahibi her şeyi elle takip etmeye razı" bir salon için bugün kullanılabilir. Büyüyen, çok şubeli, muhasebe/vergi uyumu arayan veya sporcu tarafından dijital self-servis bekleyen bir müşteri profili için ciddi, somut boşluklar var.

## Owner Senaryosu (uçtan uca)

Bir salon sahibi sabah girdiğinde: ayrı bir onboarding/kurulum rehberi göremiyor (madde 1), dashboard'da "dün" ile "bu ay"ı ayıramıyor ve hiçbir trend karşılaştırması yok (madde 2), gerçek kâr-zararını hesaplayamıyor çünkü işletme giderleri sisteme hiç girilmiyor (madde 3), personelinin rolünü değiştiremiyor (madde 4), PT'lerinin geçmiş ay performansına bakamıyor (madde 5), hangi paketin/personelin en çok sattığını göremiyor (madde 6), ikinci şubesini kendi panelinden bağlayamıyor (madde 7), aynı anda birden fazla kasa açtıramıyor (madde 8), kritik olaylar (başarısız ödeme, kasa açığı) için hiçbir proaktif bildirim almıyor (madde 9), günü/ayı resmi olarak kapatamıyor (madde 10-11), muhasebecisine verecek bir işlem dökümü çıkaramıyor (madde 12) ve tüm bu sorunları tek bir yerden görmek isteyip bulamıyor, çünkü "Bildirim Merkezi" dashboard'da literal olarak "Çok Yakında" yazıyor (madde 13). En kritik ikisi: **P&L yok** ve **merkezi uyarı sistemi yok** — bunlar birleşince OWNER, sistemin "her şeyi kayıt altına aldığını" düşünürken aslında en önemli iki soruyu ("bugün ne oldu, ne kâr ettim") hiçbir zaman yanıtlayamıyor.

## Kasiyer Senaryosu

Sabah 08:00, kapı açılıyor, 20 kişi geliyor: kart unutan üye 200 kayıtla sınırlı, aranamaz bir dropdown'da bulunmaya çalışılıyor (madde 1); üyelik yenileme çalışıyor ama check-in'den direkt bağlantısı yok (madde 2); protein tozu/su gibi küçük satışlar için borç açma ve tahsilat iki ayrı, tutar-elle-yazılan adım (madde 3-4); PT seansı "satılıyor" ama hiçbir muhasebe kaydı oluşmuyor — resmi olmayan bir iş-around gerekiyor (madde 5, **bug**); bitmiş üyelik doğru reddediliyor ama yenilemeye tek tıkla geçilemiyor (madde 6); gecikmiş taksit POS'ta görülüyor ve `/payment-plans`'tan tek tıkla tahsil edilebiliyor (madde 7, ✅); QR/RFID check-in'ler kusursuz çalışıyor, kasiyer hiç müdahale etmiyor (madde 8-9, ✅); misafir kartı oluşturuluyor ama fiziksel tarayıcı cihazı yoksa check-in edilemiyor (madde 10); dondurma talebi tek imzayla açılıp aynı kişi tarafından onaylanabiliyor (madde 11); ve en çarpıcısı — **üyelik iptali için web panelinde hiçbir buton yok**, kasiyer bunu yapamıyor (madde 12), şube değiştirme de aynı şekilde tamamen yok (madde 13). Genel değerlendirme: otomatik akışlar (QR/RFID) mükemmel, manuel/nakit akışlar (satış, iptal, misafir) gereğinden fazla sürtünmeli veya tamamen eksik.

## PT Senaryosu

Bir PT sisteme girdiğinde, OWNER'la aynı genel dashboard'u (salon geneli ciro/stok dahil) görüyor (madde 1); "bugünkü sporcularım" veya "bugünkü derslerim" diye bir görünüm hiç yok — tam, filtrelenmemiş üye listesinde arama yapmak zorunda (madde 2-3); ve en kritik bulgu — **bir PT, kendi sporcusu olmayan herhangi bir üyenin profiline girip sağlık ölçümü/fotoğraf ekleyebiliyor, program yazabiliyor** çünkü `trainerId` eşleşmesi hiçbir yerde kontrol edilmiyor (madde 2, 4, 5, 6 — **satır seviyesi yetkilendirme boşluğu**). Mesajlaşma ve fotoğraf yükleme sağlam çalışıyor (madde 6-7, ✅); beslenme/ilerleme grafikleri var ama sınırlı (madde 8-9); komisyon hesaplaması ve görünürlüğü doğru scoped (madde 11, ✅); "prim" ayrı bir kavram değil, komisyonun eş anlamlısı (madde 12); ve PT değişikliğinde ne kaybeden ne kazanan PT'ye bildirim gitmiyor (madde 13).

## Sporcu Senaryosu

Bir sporcu için en temel soru — "nasıl hesap açarım?" — sistemde yanıtsız: **self-signup hiç yok, personel de bir sporcuya giriş bilgisi oluşturan bir buton bulamıyor** (madde 1). Zaten hesabı olan bir sporcu için giriş/check-in/beslenme akışları gerçekten iyi çalışıyor (madde 2, 6, 8, ✅) — beslenme takibi (Faz 41) özellikle sağlam. Ama yeni sporcu kazanımı tamamen personele bağımlı (madde 4), kart bilgisi hiç saklanmıyor (madde 3), antrenman programı mobilde yapısal görünmüyor (madde 7), mesajlaşma 15 saniyelik polling ile (madde 9), PT değişikliği sonucu görünmüyor (madde 10), mağaza checkout'unda ödeme tamamlanmadan stok/borç işleyen bir **bug** var (madde 11), genel borç/taksit mobilden ödenemiyor (madde 12-13), ve hiçbir native push bildirimi yok (madde 14) — uygulama kapalıyken sporcu hiçbir şeyden haberdar olmuyor.

## Her Senaryoda Bulunan Mantık Hataları (🐛)

1. Üyelik dondurma erken çözüldüğünde kullanılmayan günler geri alınmıyor (`actions/membership-lifecycle.ts:290-298`).
2. `renewMembership`'te eşzamanlılık koruması yok — çift ücretlendirme riski (`actions/membership.ts:77-139`).
3. PT randevusunda aynı antrenöre çakışan saatte ikinci seans engellenmiyor (`actions/trainers.ts:134-183`).
4. Mağaza checkout'unda ödeme tamamlanmadan stok düşülüp OPEN borç açılıyor, terk edilen sepetler kalıcı hasar bırakıyor (`lib/store/checkout.ts`, `category-sale.ts:49-57`).
5. PT seansı satışı (`schedulePtSession`/`completePtSession`) hiçbir `Expense`/`Transaction` üretmiyor — muhasebeden kopuk.
6. Dashboard ve kurumsal konsolide rapor farklı para birimlerini FX çevrimi yapmadan doğrudan topluyor (`lib/dashboard-kpis.ts:75`, `lib/reports/revenue.ts:122-166`).
7. Webhook başarısız sonrası kalıcı olarak "failed" kalabilir, otomatik mutabakat mekanizması yok.
8. `pending` kalan checkout session'lar için süre-aşımı/temizlik cron'u yok — yetim kayıtlar birikiyor.

## UX Problemleri

- POS'ta "sat" ve "tahsil et" iki bağlantısız adım, tutar elle yeniden yazılıyor (yazım hatası riski).
- Dondurma onay listesi dedike bir sayfada değil, her üye profilinde tekrar render ediliyor — hem kafa karıştırıcı hem gereksiz sorgu tekrarı.
- POS/check-in üye seçici aranamıyor, 200 kayıtla sınırlı — kalabalık salonda pratik bir tavan.
- Yeni üye ekleme 3 adımlı sihirbaz — hızlı resepsiyon senaryosu için biraz uzun.
- PT komisyon KPI'sı STAFF'e de aynı şekilde görünüyor, hassasiyet ayrımı yok.
- Check-in reddi ("üyeliğiniz bitmiş") ile yenileme akışı kopuk, kasiyer manuel geçiş yapmak zorunda.

## Eksik Özellikler

- Sporcu self-signup / self-servis ilk üyelik satın alma.
- Native mobil push bildirim (`expo-notifications`).
- Kayıtlı kart / kart tokenization.
- Mobilden genel borç/taksit ödeme.
- Üyelik iptali (web panelinde arayüz yok).
- Şubeler arası üye transferi (proration ile).
- Gerçek P&L / işletme gideri modeli.
- Muhasebe dışa aktarımı (CSV/e-fatura).
- Gün sonu / ay sonu resmi kapanış raporu.
- Merkezi "sorun/uyarı" bildirim merkezi.
- PT için "bugünkü sporcularım/derslerim" görünümü ve toplu performans paneli.
- Hediye üyelik, cari kredi (store credit).
- Personel rolü değiştirme.
- OWNER'ın kendi panelinden şube açıp bağlaması.

## İş Akışı Problemleri

- PT seansı satışı POS/kasa raporlarına hiç yansımıyor — iki paralel, birbirinden habersiz sistem (randevu takibi vs. tahsilat).
- Dondurma talep+onay aynı role (STAFF) açık — dört-göz kontrolü yok.
- Misafir check-in'i fiziksel tarayıcı cihazı olmadan tamamen tıkanıyor.
- Kasa vardiyası tasarımı tek-terminal varsayıyor — çok terminalli salonlarda eşzamanlı kasa açılamıyor.
- Ay sonu/gün sonu "kapanış" kavramsal olarak yok, sadece canlı sorgu var.

## Veri Modeli Eksikleri

- KDV/vergi oranı alanı `Invoice`/`InvoiceItem`'da hiç yok.
- Gerçek işletme gideri (kira/maaş/fatura) modeli yok — `Expense` üye alacağıdır.
- Şube (Branch) ayrı bir model değil, `Organization` self-relation'ı ile taklit ediliyor.
- Store credit / hediye üyelik / bakiye hesabı modeli yok.
- Optimistic locking / versiyon alanı hiçbir modelde yok.
- Şemadaki global (organizationId=null) kupon desteği hiçbir zaman kullanılamayan ölü bir tasarım.

## Güvenlik Açıkları

- **PT, kendi sporcusu olmayan herhangi bir üyenin profiline/sağlık verisine erişip veri yazabiliyor** (`members/[id]/page.tsx:61-66`, `actions/measurements.ts:219-221,326-328`, `actions/programs.ts:103-105`) — en ciddi bulgu.
- STAFF, herhangi bir PT'nin komisyon tutarını görebiliyor (finansal hassasiyet tutarsızlığı).
- Master Admin'in `hardDeleteOrganization` aksiyonu cascade-delete zinciriyle bir salonun TÜM finansal/sağlık geçmişini tek işlemde, geri dönüşsüz siliyor — tek koruma isim-yazma onayı.
- GDPR "hesap silme" talebi onaylandığında otomatik veri silme/anonimleştirme tetiklenmiyor (yasal risk).

## Finansal Riskler

- Gerçek bir P&L yok — OWNER kâr/zarar durumunu hiçbir zaman sistemden öğrenemiyor.
- Multi-currency dashboard/raporlama farklı para birimlerini yanlışlıkla topluyor — yanlış karar riski.
- `renewMembership` çift ücretlendirme riski taşıyor (eşzamanlılık koruması yok).
- Dondurma erken bitişi ücretsiz gün/gelir kaybına yol açıyor.
- Mağaza checkout bug'ı: terk edilen sepetler kalıcı stok kaybı + hayalet borç yaratıyor.
- PT seansı satışı muhasebeye yansımadığı için gelir kaçağı/tutarsızlık riski.
- Fatura KDV'siz — vergi uyum riski.

## Gerçek Hayatta Oluşabilecek Sorunlar

- Sabah kuyruğunda kart unutan/su-protein alan üyeler için gereğinden yavaş POS akışı.
- Bir üye iptal etmek istediğinde kasiyerin elinde hiçbir resmi yol olmaması → elle/SQL çözüm arayışı.
- İki kasiyerin aynı üyeyi aynı anda yenilemesi sonucu üyenin iki kez faturalandırılması.
- Bir sporcunun mağazada ödemeyi yarıda kesmesi sonucu hem borçlu görünmesi hem de aslında almadığı bir ürünün stoktan düşmüş olması.
- Yeni bir müşterinin mobil uygulamayı indirip hiçbir şey yapamaması (hesabı yok).
- Bir PT'nin, başka bir PT'nin sporcusunun özel sağlık notlarını görebilmesi.
- OWNER'ın ay sonunda muhasebecisine verecek hiçbir resmi rapor bulamaması.
- Multi-currency çalışan bir salonun dashboard'ında "toplam ciro" rakamının anlamsız çıkması.

## Önceliklendirilmiş Geliştirme Listesi

**Kritik:**
1. PT'nin kendi sporcusu olmayan üyeye erişimini engelleyen `trainerId` guard'ı (üye sayfası, ölçüm, fotoğraf, program oluşturma).
2. Mağaza checkout'unda stok/borç işlemini ödeme onayına bağlayan düzeltme (Sporcu madde 11 bug'ı).
3. `renewMembership`'e eşzamanlılık koruması (transaction içi kilit veya versiyon kontrolü).
4. Üyelik dondurma erken çözülmesinde kullanılmayan günlerin geri alınması.
5. Gerçek bir P&L: işletme gideri modeli + net kâr raporu.
6. Merkezi "sorun/uyarı merkezi" (dashboard'daki "Çok Yakında" teaser'ın gerçek implementasyonu).
7. Native mobil push bildirim altyapısı (`expo-notifications`).
8. Sporcu self-signup + ilk üyelik satın alma akışı.

**Yüksek:**
9. Multi-currency dashboard/rapor toplama hatasının düzeltilmesi (para birimine göre ayrıştırma).
10. PT seansı satışının muhasebeye (`Expense`/`Transaction`) bağlanması.
11. Üyelik iptali için web panelinde arayüz + proration hesaplama.
12. Fatura modeline KDV oranı/tutarı eklenmesi.
13. PT randevu çakışma kontrolü.
14. STAFF'in PT komisyonu görme yetkisinin kısıtlanması.
15. Master Admin `hardDeleteOrganization` için zorunlu yedekleme/export adımı.
16. Misafir check-in'in cihazsız salonlarda da çalışması.
17. Mobilden genel borç/taksit ödeme köprüsü.

**Orta:**
18. Muhasebe CSV dışa aktarımı.
19. OWNER'ın kendi panelinden şube açıp bağlaması.
20. PT için "bugünkü sporcularım/derslerim" görünümü.
21. Dondurma talep/onay için dört-göz kontrolü.
22. Aranabilir üye seçici (check-in/POS, Faz 43.9).
23. Mesajlaşmanın mobilde gerçek zamanlı (SSE) hale getirilmesi.
24. PT değişikliği sonucunun her iki PT'ye de bildirilmesi.
25. Gün sonu/ay sonu resmi kapanış raporu.
26. Operasyonel raporların SQL-side agregasyona taşınması.

**Düşük:**
27. Personel rolü değiştirme.
28. PT roster N+1 sorgusunun optimize edilmesi.
29. Antrenman programının mobilde yapısal gösterilmesi.
30. Ödeme sonrası mobil uygulamaya otomatik dönüş (deep link).
31. Kayıtlı kart / tokenization.
32. Şemadaki ölü global-kupon kodunun temizlenmesi veya gerçek işlevle desteklenmesi.
33. GDPR silme talebi için otomatik pipeline.
34. Hediye üyelik / store credit modeli.
35. Şubeler arası üye transferi (proration ile).

## Dünya Standartlarına Göre Değerlendirme

Yukarıdaki "Karşılaştırma" bölümünde (Rakip Analizi altında) detaylandırıldığı ve bu denetimle güncellendiği gibi: SGMS operasyonel çekirdekte (üyelik yaşam döngüsü, POS/kasa, çok kiracılı mimari, PT komisyonu, artık beslenme takibi) GymMaster/Glofox/Mindbody/Virtuagym/Zen Planner/PushPress/Perfect Gym/ClubReady seviyesine yakın veya bazı noktalarda (bölgesel ödeme, i18n, çoklu para birimi motoru) daha ileride. Ancak bu denetim, sektör standardı sayılan ama SGMS'te olmayan native push/wearable/video/pazarlama otomasyonu gibi bilinen boşlukların yanında, rakiplerin hepsinde temel kabul edilen ama SGMS'te bulunmayan **P&L raporu**, **muhasebe dışa aktarımı** ve **self-servis müşteri kazanımı** gibi temel SaaS beklentilerinin de eksik olduğunu ortaya çıkardı. Bu, "gelişmiş özellik eksikliği" değil, "temel işletme aracı eksikliği" kategorisine giriyor.

## "Bu Ürünü Bugün Satışa Çıkarsam Ne Olur?" Analizi

**Küçük, tek şubeli, düşük hacimli bir salona satılırsa:** Muhtemelen sorunsuz çalışır — sahibi zaten her şeyi elle takip etmeye alışkın, tek para birimiyle çalışıyor, kasiyer sayısı az (eşzamanlılık riskleri düşük), sporcu self-servis beklentisi düşük. Ürün bu segmentte **bugün satılabilir**.

**Büyüyen, çok şubeli veya çok kasiyerli bir zincire satılırsa:** Ciddi riskler ortaya çıkar — şube bağlama CiciByte'a bağımlı (satış sürecini yavaşlatır), kasa tasarımı tek-terminal varsayıyor (büyük salonlarda çalışmaz), çift-yenileme/çift-ücretlendirme riski kasiyer sayısıyla doğru orantılı büyür, multi-currency raporlama zaten yanlış rakam gösteriyor. Bu segmente **bugün, bu bulgular çözülmeden satmak riskli**.

**Dijital-öncelikli, mobil bekleyen bir sporcu tabanına satılırsa:** Native push olmadığı, sporcu self-signup yapamadığı ve antrenman programının mobilde yapısal görünmediği için müşteri deneyimi rakiplerin belirgin gerisinde kalır — bu segment için **bugün satmak, kurulumdan hemen sonra müşteri şikayetine yol açar**.

**Muhasebe/vergi uyumu arayan bir müşteriye satılırsa:** Fatura KDV'siz, gerçek bir P&L yok, dışa aktarım yok — bu müşteri profiline **bugün satılamaz**, önce Kritik/Yüksek öncelikli maddelerin bir kısmı kapatılmalı.

**Genel sonuç:** Ürün "satışa çıkarılabilir" ama **hedef müşteri segmentine göre bilinçli bir açıklama/kapsam beyanı ile** satılmalı — "küçük/orta ölçekli, tek şubeli, TL bazlı çalışan salonlar için hazır; çok şubeli/çok para birimli/dijital-öncelikli/muhasebe-entegrasyonu bekleyen müşteriler için henüz değil" şeklinde bir iç doğruluk çizgisi çekilmeli.

## Sonuç ve Öneriler

Bu denetim, SGMS'in mühendislik kalitesinin (kod organizasyonu, test kapsamı, güvenli ödeme/webhook desenleri, indeksleme, i18n) genel olarak yüksek olduğunu, ama **ürün olgunluğunun** operasyonel çekirdeğin ötesinde (finansal doğruluk, yetkilendirme tutarlılığı, self-servis akışları, işletme sahibi araçları) henüz aynı seviyede olmadığını gösteriyor. Önerilen yol haritası:

1. **Önce güven kırıcı bug'ları kapat** (Kritik liste 1-4): PT yetkilendirme sızıntısı, mağaza checkout bug'ı, çift-ücretlendirme riski, dondurma gün kaybı — bunlar zaten var olan özelliklerde para/veri kaybına yol açıyor, yeni özellik değil, düzeltme.
2. **Sonra "işletme sahibi güveni" katmanını inşa et** (Kritik 5-6, Yüksek 9-12): P&L, merkezi uyarı merkezi, multi-currency raporlama düzeltmesi, muhasebe/KDV — bunlar olmadan ürün "profesyonel" hissettirmiyor.
3. **Ardından self-servis/mobil katmanı tamamla** (Kritik 7-8, Yüksek 17): native push, sporcu self-signup, mobil borç ödeme — bu, mobil-öncelikli pazarlarda rekabet için şart.
4. **Son olarak ölçek/UX cilası** (Orta/Düşük liste): şube self-servis, aranabilir seçiciler, N+1 optimizasyonu — bunlar büyüme geldiğinde önemli hale gelecek, şimdiden planlanmalı ama aceleye getirilmemeli.

Bu rapordaki her bulgu ilgili persona bölümünde dosya:satır kanıtıyla belgelenmiştir; roadmap.md'ye yeni bir "Faz 44 — Finansal Doğruluk & Yetkilendirme Sağlamlaştırması" gibi bir faz olarak işlenmesi, Kritik/Yüksek maddelerin somut, tek-tek kapatılabilir görevlere dönüştürülmesi için doğal bir sonraki adımdır.
