import { PrismaClient, type HelpAudience, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type SeedArticle = {
  slug: string;
  audiences: HelpAudience[];
  category: string;
  sortOrder: number;
  isOnboardingGuide?: boolean;
  onboardingKey?: string;
  relatedFeatureFlag?: string;
  translations: Array<{ locale: string; title: string; bodyMarkdown: string }>;
};

const ARTICLES: SeedArticle[] = [
  {
    slug: 'guide-owner-onboarding',
    audiences: ['OWNER', 'ADMIN'],
    category: 'onboarding',
    sortOrder: 1,
    isOnboardingGuide: true,
    onboardingKey: 'owner',
    translations: [
      {
        locale: 'tr',
        title: 'Salon Sahibi Başlangıç Rehberi',
        bodyMarkdown: `## Hoş geldiniz

Bu kontrol listesi salonunuzu ilk günde hazır hale getirir.

### 1. Ekibi davet edin
- **Ayarlar → Ekip & Roller** veya **Personel** menüsünden OWNER/ADMIN/STAFF/TRAINER davet edin.
- RFID kartı olan personelde kart numarasını hemen tanımlayın.

### 2. Üyelik planlarını kurun
- **Planlar** ekranından aylık/yıllık paketleri oluşturun (TRY/USD).
- Fiyat ve süre alanlarını gerçek satış fiyatınızla doldurun.

### 3. Turnike / cihaz
- Cihaz kaydını tamamlayın; deneme süresi bitince turnike nezaket penceresini billing ekranından izleyin.

### 4. İlk üyeyi kaydedin
- **Üyeler → Yeni üye** ile sporcu oluşturun, plan bağlayın, check-in deneyin.

### 5. Faturalandırma
- **Fatura / Abonelik** ekranından SGMS aboneliğinizi takip edin.`,
      },
      {
        locale: 'en',
        title: 'Gym Owner Getting Started Guide',
        bodyMarkdown: `## Welcome

Use this checklist to get your gym ready on day one.

### 1. Invite your team
- From **Settings → Team & Roles** or **Team**, invite OWNER/ADMIN/STAFF/TRAINER users.
- Assign RFID cards for staff who use turnstiles.

### 2. Configure membership plans
- Create monthly/yearly plans under **Plans** (TRY/USD).
- Fill prices and durations with your real sell prices.

### 3. Devices / turnstiles
- Register devices; watch the billing grace window when a trial ends.

### 4. Register the first member
- Create a member, attach a plan, and test check-in.

### 5. Billing
- Track your SGMS subscription under **Billing**.`,
      },
    ],
  },
  {
    slug: 'guide-reception-onboarding',
    audiences: ['STAFF', 'RECEPTION', 'ADMIN'],
    category: 'onboarding',
    sortOrder: 2,
    isOnboardingGuide: true,
    onboardingKey: 'reception',
    translations: [
      {
        locale: 'tr',
        title: 'Resepsiyon Başlangıç Rehberi',
        bodyMarkdown: `## Günlük resepsiyon rutini

### Check-in
- **Check-in** ekranından QR veya RFID ile giriş alın.
- Aynı kişi için peş peşe aynı yönlü check-in engellenir (debounce).

### Üye kaydı
- Yeni sporcuyu **Üyeler** ekranından ekleyin; plan ve bitiş tarihini doğrulayın.

### POS / kasa
- **POS** ile hızlı borç ve tahsilat alın.
- Çoklu para birimli borçlarda tahsilatın para birimini seçmeyi unutmayın.

### Ödeme planları
- Taksitli üyelerde vadesi geçen taksitleri **Ödeme Planları**ndan takip edin.`,
      },
      {
        locale: 'en',
        title: 'Reception Getting Started Guide',
        bodyMarkdown: `## Daily reception routine

### Check-in
- Use **Check-in** for QR or RFID entry.
- Rapid same-direction repeats are blocked.

### Member registration
- Add athletes under **Members** and verify plan end dates.

### POS
- Use **POS** for quick charges and collections.
- When debts use multiple currencies, pick the payment currency.

### Payment plans
- Track overdue installments under **Payment Plans**.`,
      },
    ],
  },
  {
    slug: 'guide-trainer-onboarding',
    audiences: ['TRAINER', 'ADMIN'],
    category: 'onboarding',
    sortOrder: 3,
    isOnboardingGuide: true,
    onboardingKey: 'trainer',
    translations: [
      {
        locale: 'tr',
        title: 'PT Başlangıç Rehberi',
        bodyMarkdown: `## Antrenör olarak ilk adımlar

### Program atama
- **Programlar** ekranından sporcuya antrenman/beslenme programı oluşturun.

### Ölçüm
- Üye detayından ölçü kaydı girin; sporcu kendi portalında da görebilir.

### Mesajlaşma
- Sporcuyla **Mesajlar** üzerinden iletişim kurun.

### Finansal veri
- Ödeme/cari bilgileri PT rolünde görünmez — bu resepsiyon ve yönetimin işidir.`,
      },
      {
        locale: 'en',
        title: 'Trainer Getting Started Guide',
        bodyMarkdown: `## First steps as a PT

### Programs
- Create workout/nutrition programs under **Programs**.

### Measurements
- Log measurements from the member profile.

### Messaging
- Chat with athletes under **Messages**.

### Finance
- Payment ledgers are hidden from TRAINER — reception/owners handle money.`,
      },
    ],
  },
  {
    slug: 'guide-athlete-onboarding',
    audiences: ['ATHLETE'],
    category: 'onboarding',
    sortOrder: 4,
    isOnboardingGuide: true,
    onboardingKey: 'athlete',
    translations: [
      {
        locale: 'tr',
        title: 'Sporcu Başlangıç Rehberi',
        bodyMarkdown: `## Sporcu portalı

### Check-in
- Ana ekrandaki QR ile turnikeden geçebilirsiniz (tek kullanımlık).

### Programlar
- PT'nizin atadığı programı set/tekrar işaretleyerek takip edin.

### Ölçümler & mesajlar
- Ölçüm geçmişinizi görün; PT'nize mesaj gönderin.

### Hesap
- Profil fotoğrafı, iletişim bilgisi ve parolanızı **Hesabım**dan güncelleyin.
- Açık bakiyeniz varsa ödemeyi resepsiyondan yapın.`,
      },
      {
        locale: 'en',
        title: 'Athlete Getting Started Guide',
        bodyMarkdown: `## Athlete portal

### Check-in
- Use the home QR at the turnstile (single-use).

### Programs
- Follow your PT program and mark sets as done.

### Measurements & messages
- Review measurements and message your PT.

### Account
- Update avatar, contact info, and password under **Account**.
- Pay open balances at reception.`,
      },
    ],
  },
  {
    slug: 'topic-pos',
    audiences: ['OWNER', 'ADMIN', 'STAFF', 'RECEPTION'],
    category: 'pos',
    sortOrder: 10,
    translations: [
      {
        locale: 'tr',
        title: 'POS / Kasa kullanımı',
        bodyMarkdown: `## Mini POS

1. Sporcuyu seçin.
2. Hızlı kalem veya özel borç ekleyin.
3. Tahsilat alın (nakit/kart/havale).
4. Birden fazla para biriminde açık borç varsa **para birimini seçin** — USD tahsilatı TRY borcuna uygulanmaz.
5. Yanlış tahsilatta üye cari panelinden **İade** kaydedin.`,
      },
      {
        locale: 'en',
        title: 'Using POS / Cash desk',
        bodyMarkdown: `## Mini POS

1. Select a member.
2. Add a quick item or custom charge.
3. Collect payment (cash/card/transfer).
4. If open debts use multiple currencies, **choose the currency**.
5. Use **Refund** on the member ledger for mistaken payments.`,
      },
    ],
  },
  {
    slug: 'topic-checkin',
    audiences: ['OWNER', 'ADMIN', 'STAFF', 'RECEPTION', 'TRAINER'],
    category: 'checkin',
    sortOrder: 11,
    translations: [
      {
        locale: 'tr',
        title: 'Check-in ve turnike',
        bodyMarkdown: `## Check-in

- QR, RFID veya manuel arama ile giriş/çıkış alın.
- Offline turnike kayıtlarında yön (ENTRY/EXIT) cihazda tutulur.
- Abonelik kilidinde turnike kısa bir nezaket penceresiyle çalışmaya devam edebilir; süre billing ekranında görünür.`,
      },
      {
        locale: 'en',
        title: 'Check-in and turnstiles',
        bodyMarkdown: `## Check-in

- Use QR, RFID, or manual search for entry/exit.
- Offline turnstile pushes keep ENTRY/EXIT direction.
- During billing lock, devices may stay open for a short grace window shown on Billing.`,
      },
    ],
  },
  {
    slug: 'topic-members',
    audiences: ['OWNER', 'ADMIN', 'STAFF', 'RECEPTION', 'TRAINER'],
    category: 'members',
    sortOrder: 12,
    translations: [
      {
        locale: 'tr',
        title: 'Üye yönetimi',
        bodyMarkdown: `## Üyeler

- Yeni üye kaydı, plan bağlama ve yenileme üye detayından yapılır.
- Cari hesap (borç/tahsilat/iade) OWNER/ADMIN/STAFF içindir; TRAINER görmez.
- Üye limiti dolunca yeni kayıt ve pasiften aktife alma engellenir.`,
      },
      {
        locale: 'en',
        title: 'Member management',
        bodyMarkdown: `## Members

- Register members, attach plans, and renew from the member profile.
- Ledgers are for OWNER/ADMIN/STAFF only; TRAINER cannot see payments.
- Member capacity blocks new registrations and reactivation when full.`,
      },
    ],
  },
  {
    slug: 'topic-programs',
    audiences: ['OWNER', 'ADMIN', 'TRAINER', 'ATHLETE'],
    category: 'programs',
    sortOrder: 13,
    translations: [
      {
        locale: 'tr',
        title: 'Antrenman programları',
        bodyMarkdown: `## Programlar

- PT program oluşturur ve sporcuya atar.
- Sporcu setleri işaretler, opsiyonel ağırlık girer, dinlenme sayacı çalışır.`,
      },
      {
        locale: 'en',
        title: 'Training programs',
        bodyMarkdown: `## Programs

- Trainers create and assign programs.
- Athletes mark sets, optionally log weight, and use the rest timer.`,
      },
    ],
  },
  {
    slug: 'topic-settings',
    audiences: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'],
    category: 'settings',
    sortOrder: 14,
    translations: [
      {
        locale: 'tr',
        title: 'Ayarlar ekranı',
        bodyMarkdown: `## Ayarlar

Sekmeler role göre filtrelenir:

- **Genel / Bildirimler / Entegrasyonlar / Fatura** — OWNER & ADMIN
- **Ekip & Roller** — OWNER & ADMIN (Personel sayfasına gider)
- **Güvenlik** — tüm personel (2FA)`,
      },
      {
        locale: 'en',
        title: 'Settings screen',
        bodyMarkdown: `## Settings

Tabs are role-filtered:

- **General / Notifications / Integrations / Billing** — OWNER & ADMIN
- **Team & Roles** — OWNER & ADMIN
- **Security** — all staff (2FA)`,
      },
    ],
  },
  {
    slug: 'topic-billing',
    audiences: ['OWNER', 'ADMIN'],
    category: 'billing',
    sortOrder: 15,
    translations: [
      {
        locale: 'tr',
        title: 'Abonelik ve faturalandırma',
        bodyMarkdown: `## Faturalandırma

- SGMS aboneliğinizi **Fatura** ekranından yönetin.
- Panel kilitlendiğinde turnike için nezaket süresi uygulanabilir.
- Proforma e-postaları Master Admin üzerinden yeniden gönderilebilir.`,
      },
      {
        locale: 'en',
        title: 'Subscription and billing',
        bodyMarkdown: `## Billing

- Manage your SGMS subscription under **Billing**.
- When the panel locks, turnstiles may keep a short grace window.
- Proforma emails can be resent by Master Admin.`,
      },
    ],
  },
  {
    slug: 'topic-team',
    audiences: ['OWNER', 'ADMIN'],
    category: 'settings',
    sortOrder: 16,
    translations: [
      {
        locale: 'tr',
        title: 'Ekip ve roller',
        bodyMarkdown: `## Personel

- Davet gönderin, bekleyen davetleri iptal/yeniden gönderin.
- İşten çıkan personeli **Çıkar** ile pasifleştirin — oturum kısa sürede düşer, RFID boşalır.`,
      },
      {
        locale: 'en',
        title: 'Team and roles',
        bodyMarkdown: `## Team

- Invite staff; cancel or resend pending invites.
- Remove departing staff — sessions revoke quickly and RFID is cleared.`,
      },
    ],
  },
  {
    slug: 'topic-security',
    audiences: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'],
    category: 'security',
    sortOrder: 17,
    translations: [
      {
        locale: 'tr',
        title: 'Hesap güvenliği (2FA)',
        bodyMarkdown: `## 2FA

- Authenticator uygulamasıyla 2FA açın, yedek kodları saklayın.
- Telefon kaybında e-posta kurtarma veya Master Admin sıfırlaması kullanılabilir.`,
      },
      {
        locale: 'en',
        title: 'Account security (2FA)',
        bodyMarkdown: `## 2FA

- Enable authenticator 2FA and store backup codes.
- If you lose your phone, use email recovery or Master Admin reset.`,
      },
    ],
  },
  {
    slug: 'topic-integrations',
    audiences: ['OWNER', 'ADMIN'],
    category: 'integrations',
    sortOrder: 18,
    relatedFeatureFlag: 'integrations',
    translations: [
      {
        locale: 'tr',
        title: 'Entegrasyonlar (yakında / hazırlık)',
        bodyMarkdown: `## Entegrasyonlar

- Salon ödeme sağlayıcıları (Iyzico/PayTR) ve donanım/RFID anahtarları bu sekmede toplanacak.
- API anahtarları yalnızca sunucuda saklanır; tarayıcıya gönderilmez.`,
      },
      {
        locale: 'en',
        title: 'Integrations (coming soon / prep)',
        bodyMarkdown: `## Integrations

- Tenant payment providers (Iyzico/PayTR) and hardware/RFID keys will live here.
- API keys stay server-side and are never sent to the browser.`,
      },
    ],
  },
];

async function upsertArticle(article: SeedArticle) {
  const existing = await prisma.helpArticle.findUnique({ where: { slug: article.slug } });
  const data = {
    audiences: article.audiences,
    category: article.category,
    sortOrder: article.sortOrder,
    isPublished: true,
    relatedFeatureFlag: article.relatedFeatureFlag ?? null,
    isOnboardingGuide: article.isOnboardingGuide ?? false,
    onboardingKey: article.onboardingKey ?? null,
  };

  if (existing) {
    await prisma.helpArticle.update({
      where: { id: existing.id },
      data,
    });
    for (const tr of article.translations) {
      await prisma.helpArticleTranslation.upsert({
        where: {
          articleId_locale: { articleId: existing.id, locale: tr.locale },
        },
        create: {
          articleId: existing.id,
          locale: tr.locale,
          title: tr.title,
          bodyMarkdown: tr.bodyMarkdown,
        },
        update: {
          title: tr.title,
          bodyMarkdown: tr.bodyMarkdown,
        },
      });
    }
    return;
  }

  await prisma.helpArticle.create({
    data: {
      slug: article.slug,
      ...data,
      translations: {
        create: article.translations.map((tr) => ({
          locale: tr.locale,
          title: tr.title,
          bodyMarkdown: tr.bodyMarkdown,
        })),
      },
    },
  });
}

async function main() {
  for (const article of ARTICLES) {
    await upsertArticle(article);
  }
  console.log(`Seeded ${ARTICLES.length} help articles.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
