/**
 * Sync marketing feature + roadmap (coming soon) copy across locales.
 * TR is source of truth in this script; other langs get professional translations.
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('messages');

const featureItemsTr = {
  crm: {
    icon: '👥',
    title: 'Üye CRM & Yaşam Döngüsü',
    description:
      'Profil, avatar, sağlık rızası, dondurma/aktarım/iptal, üyelik grupları ve konuk geçişleri — resepsiyon ile PT aynı üyeyi görür.',
  },
  membership: {
    icon: '🪪',
    title: 'Plan, Ders & Paket Satışı',
    description:
      'Salon üyelik planları, sınıf/ders rezervasyonu, indirim kodları, taksitli tahsilat ve sporcunun kendi kartıyla yenilemesi.',
  },
  programs: {
    icon: '🏋',
    title: 'Program, Hedef & Beslenme',
    description:
      'Antrenman/beslenme programları, interaktif set-tekrar, hedef takibi ve kalori günlüğü — web ve mobilde.',
  },
  measurements: {
    icon: '📏',
    title: 'Gelişmiş Ölçüm & İlerleme',
    description:
      'Çevre ölçüleri, BMI, yağ/kas, sparkline trendler ve ilerleme fotoğrafları — PT ve sporcu aynı geçmişi izler.',
  },
  pt: {
    icon: '🥇',
    title: 'PT Performans & Prim',
    description:
      'Seans planlama, komisyon modelleri, no-show oranı, PT atama/değişiklik talepleri ve aylık performans karnesi.',
  },
  pos: {
    icon: '💳',
    title: 'POS, Cari & Online Ödeme',
    description:
      'Market/kafe borçları, FIFO tahsilat, ödeme planları; Iyzico/PayTR hosted checkout ile üyelik ve mağaza ödemesi.',
  },
  cash: {
    icon: '💵',
    title: 'Kasa Vardiyası (X/Z)',
    description:
      'Vardiya aç/kapa, nakit sayımı, açık-fazla tespiti ve X/Z raporları — mesaideki resepsiyon sporcuya görünür.',
  },
  checkin: {
    icon: '🚪',
    title: 'Turnike, QR & RFID',
    description:
      'Cihaz yönetimi, QR/RFID check-in, canlı giriş akışı, offline senkron ve SGMS Resepsiyon masaüstü uygulaması.',
  },
  hr: {
    icon: '🗂️',
    title: 'Personel / HR',
    description:
      'İzin talepleri, vardiya çizelgesi, performans ve disiplin kayıtları, maaş özeti CSV — ekibi panelden yönetin.',
  },
  equipment: {
    icon: '🛠️',
    title: 'Ekipman & Bakım',
    description:
      'Envanter, garanti, servis geçmişi, bakım takvimi ve ekipman QR’si ile arıza bildirimi.',
  },
  reports: {
    icon: '📊',
    title: 'Raporlama, P&L & Uyarılar',
    description:
      'Ciro, MRR/LTV, yoğunluk, Excel/PDF; işletme giderleri ile net kâr ve “bugün dikkat et” uyarı merkezi.',
  },
  realtime: {
    icon: '⚡',
    title: 'Mesajlaşma & Bildirim',
    description:
      'PT ↔ sporcu ve mesaideki resepsiyon sohbeti (Soketi); tarayıcı Web Push ve sporcu uygulamasında native push.',
  },
  mobile: {
    icon: '📱',
    title: 'SGMS Sporcu (Android)',
    description:
      'Google Play kapalı test + APK: üyelik, program, ölçüm, mağaza, mesajlaşma, self-signup ve güvenli ödeme.',
  },
  security: {
    icon: '🔐',
    title: 'Güvenlik & Uyum',
    description:
      'RBAC, 2FA, denetim (audit) kayıtları, KVKK gizlilik/hesap silme sayfaları ve demo hesap koruması.',
  },
  i18n: {
    icon: '🌍',
    title: '6 Dil & Küresel Lokasyon',
    description:
      'TR, EN, RU, FR, ES, AZ arayüz; ülke → şehir → ilçe veritabanı ile uluslararası salonlar için hazır.',
  },
  enterprise: {
    icon: '🏢',
    title: 'Çoklu Şube & Partner',
    description:
      'Kurumsal hiyerarşi, şube konsolidasyonu ve temsilci (partner) portalı ile zincir/franchise büyütme.',
  },
};

const comingSoonTr = {
  cleaning: {
    title: 'Temizlik Yönetimi',
    description: 'Vardiya bazlı temizlik kontrol listeleri, fotoğraflı kayıt ve dijital onay.',
  },
  digitalCard: {
    title: 'Dijital Üyelik Kartı',
    description: 'Apple Wallet, Google Wallet ve NFC ile telefondan tek dokunuşla salona giriş.',
  },
  notifications: {
    title: 'SMS / WhatsApp Bildirimleri',
    description:
      'Web ve native push hazır; sırada SMS, WhatsApp Business ve şablonlı kampanya kanalları.',
  },
  insights: {
    title: 'Yapay Zeka Öngörüleri',
    description: 'Churn riski, geri kazanma önerileri ve otomatik memnuniyet (NPS) anketleri.',
  },
  integrations: {
    title: 'Entegrasyon Pazaryeri',
    description: 'Apple Health, Google Fit, muhasebe yazılımları ve üçüncü taraf SMS sağlayıcıları.',
  },
  ticketing: {
    title: 'SaaS Destek Bileti',
    description: 'Salonların platform desteğine ticket açması — Help Center üzerine ticketing.',
  },
};

const locales = {
  tr: {
    featuresSubtitle:
      'CRM’den turnikeye, kasadan PT primine, sporcu uygulamasından çoklu şubeye — bugün canlıda olan yetenekler.',
    featuresTitle: 'Salon işletim sisteminin tamamı',
    roadmapTitle: 'Sırada ne var?',
    roadmapSubtitle:
      'Aşağıdakiler henüz geliştirme / plan aşamasında. Canlıdaki özellikler üstteki grid’de — “çok yakında” sandığınız birçok modül (HR, ekipman, kasa, PT) zaten yayında.',
    heroSubtitle:
      'CiCiByte SGMS; üye CRM, üyelik yaşam döngüsü, PT & prim, POS/kasa, turnike, HR, ekipman, raporlama, gerçek zamanlı mesajlaşma ve SGMS Sporcu mobil uygulamasını tek SaaS çatısında birleştirir.',
    stats: {
      members: { value: '360°', label: 'Üye → kasa → turnike' },
      languages: { value: '6 Dil', label: 'Global salon deneyimi' },
      uptime: { value: 'Play+', label: 'Mobil kapalı testte' },
      trial: { value: '14 Gün', label: 'Kredi kartı gerekmez' },
    },
    featureItems: featureItemsTr,
    comingSoon: comingSoonTr,
    showcaseHighlights: {
      membership: 'Üyelik, ekstre, self-signup ve kartla yenileme',
      programs: 'Program, hedef, beslenme ve ölçüm geçmişi',
      checkin: 'Talebe bağlı QR check-in',
      store: 'Mağaza, mesajlaşma ve isteğe bağlı push',
    },
  },
  en: {
    featuresSubtitle:
      'From CRM to turnstiles, cash drawer to PT commissions, athlete app to multi-branch — capabilities live today.',
    featuresTitle: 'The full gym operating system',
    roadmapTitle: 'What’s next?',
    roadmapSubtitle:
      'Items below are still planned or in progress. Many modules once labeled “coming soon” (HR, equipment, cash shifts, PT) are already live in the grid above.',
    heroSubtitle:
      'CiCiByte SGMS unifies member CRM, membership lifecycle, PT & commissions, POS/cash, turnstiles, HR, equipment, reporting, realtime messaging, and the SGMS Sporcu mobile app in one premium SaaS.',
    stats: {
      members: { value: '360°', label: 'Member → cash → door' },
      languages: { value: '6 Lang', label: 'Global gym experience' },
      uptime: { value: 'Play+', label: 'Mobile in closed testing' },
      trial: { value: '14 Days', label: 'No credit card' },
    },
    featureItems: {
      crm: {
        icon: '👥',
        title: 'Member CRM & Lifecycle',
        description:
          'Profiles, health consent, freeze/transfer/cancel, groups and guest passes — front desk and PT share one member record.',
      },
      membership: {
        icon: '🪪',
        title: 'Plans, Classes & Sales',
        description:
          'Membership plans, class booking, discount codes, installments, and athlete self-renewal with card checkout.',
      },
      programs: {
        icon: '🏋',
        title: 'Programs, Goals & Nutrition',
        description:
          'Workout/nutrition plans, interactive sets, goal tracking and calorie logs — on web and mobile.',
      },
      measurements: {
        icon: '📏',
        title: 'Advanced Metrics & Progress',
        description:
          'Circumference, BMI, body composition, sparklines and progress photos shared with the trainer.',
      },
      pt: {
        icon: '🥇',
        title: 'PT Performance & Pay',
        description:
          'Session scheduling, commission models, no-shows, trainer change requests and monthly scorecards.',
      },
      pos: {
        icon: '💳',
        title: 'POS, Ledger & Online Pay',
        description:
          'Store/café charges, FIFO collections, payment plans; Iyzico/PayTR hosted checkout for renewals and shop.',
      },
      cash: {
        icon: '💵',
        title: 'Cash Shifts (X/Z)',
        description:
          'Open/close shifts, cash counts, over/short and X/Z reports — on-duty reception visible to athletes.',
      },
      checkin: {
        icon: '🚪',
        title: 'Turnstile, QR & RFID',
        description:
          'Device management, QR/RFID check-in, live feed, offline sync and the SGMS Reception desktop app.',
      },
      hr: {
        icon: '🗂️',
        title: 'Staff / HR',
        description:
          'Leave requests, shift schedules, reviews, discipline records and salary CSV exports.',
      },
      equipment: {
        icon: '🛠️',
        title: 'Equipment & Maintenance',
        description:
          'Inventory, warranty, service history, schedules and QR-based fault reporting.',
      },
      reports: {
        icon: '📊',
        title: 'Reporting, P&L & Alerts',
        description:
          'Revenue, MRR/LTV, occupancy, Excel/PDF; business expenses for net profit and a “watch today” alert center.',
      },
      realtime: {
        icon: '⚡',
        title: 'Messaging & Notifications',
        description:
          'PT ↔ athlete and on-duty reception chat (Soketi); browser Web Push and native mobile push.',
      },
      mobile: {
        icon: '📱',
        title: 'SGMS Sporcu (Android)',
        description:
          'Google Play closed testing + APK: membership, programs, metrics, store, messaging, signup and secure pay.',
      },
      security: {
        icon: '🔐',
        title: 'Security & Compliance',
        description:
          'RBAC, 2FA, audit logs, privacy/account-deletion pages and locked demo accounts.',
      },
      i18n: {
        icon: '🌍',
        title: '6 Languages & Locations',
        description:
          'TR, EN, RU, FR, ES, AZ UI plus country → city → district data for international gyms.',
      },
      enterprise: {
        icon: '🏢',
        title: 'Multi-branch & Partners',
        description:
          'Org hierarchy, consolidated branch views and a partner portal for referral growth.',
      },
    },
    comingSoon: {
      cleaning: {
        title: 'Cleaning Management',
        description: 'Shift checklists, photo proof and digital sign-off.',
      },
      digitalCard: {
        title: 'Digital Membership Card',
        description: 'Apple Wallet, Google Wallet and NFC tap-to-enter.',
      },
      notifications: {
        title: 'SMS / WhatsApp Channels',
        description: 'Web & native push are live; SMS, WhatsApp Business and campaign templates are next.',
      },
      insights: {
        title: 'AI Insights',
        description: 'Churn risk, win-back suggestions and automated NPS surveys.',
      },
      integrations: {
        title: 'Integrations Marketplace',
        description: 'Apple Health, Google Fit, accounting tools and SMS providers.',
      },
      ticketing: {
        title: 'SaaS Support Tickets',
        description: 'Gyms open tickets to platform support on top of the Help Center.',
      },
    },
    showcaseHighlights: {
      membership: 'Membership, statement, self-signup and card renewal',
      programs: 'Programs, goals, nutrition and measurement history',
      checkin: 'On-demand QR check-in',
      store: 'Store, messaging and optional push',
    },
  },
};

// Reuse EN for az/es/fr/ru with light localization where critical; full pass for readability.
locales.az = structuredClone(locales.en);
locales.es = structuredClone(locales.en);
locales.fr = structuredClone(locales.en);
locales.ru = structuredClone(locales.en);

Object.assign(locales.az, {
  featuresTitle: 'Tam zal əməliyyat sistemi',
  featuresSubtitle:
    'CRM-dən turniketə, kassadan PT komissiyasına, idmançı tətbiqinə qədər — bu gün canlı olan imkanlar.',
  roadmapTitle: 'Növbəti nədir?',
  roadmapSubtitle:
    'Aşağıdakılar hələ plan/inkişaf mərhələsindədir. Bir çox “tezliklə” görünən modul (HR, avadanlıq, kassa, PT) artıq yuxarıdakı grid-də canlıdır.',
  heroSubtitle:
    'CiCiByte SGMS üzv CRM, üzvlük həyat dövrü, PT & komissiya, POS/kassa, turniket, HR, avadanlıq, hesabat, real-vaxt mesajlaşma və SGMS Sporcu mobil tətbiqini bir SaaS-da birləşdirir.',
});
Object.assign(locales.es, {
  featuresTitle: 'El sistema operativo completo del gimnasio',
  featuresSubtitle:
    'Del CRM al torniquete, de la caja a las comisiones PT y la app del atleta — capacidades ya en producción.',
  roadmapTitle: '¿Qué sigue?',
  roadmapSubtitle:
    'Lo de abajo sigue en plan o desarrollo. Muchos módulos que parecían “próximamente” (HR, equipo, caja, PT) ya están en la cuadrícula superior.',
  heroSubtitle:
    'CiCiByte SGMS unifica CRM, ciclo de membresía, PT y comisiones, POS/caja, torniquetes, RR. HH., equipo, reportes, mensajería en tiempo real y la app SGMS Sporcu en un SaaS premium.',
});
Object.assign(locales.fr, {
  featuresTitle: 'Le système d’exploitation complet de la salle',
  featuresSubtitle:
    'Du CRM au tourniquet, de la caisse aux commissions PT et à l’app sportif — capacités déjà en production.',
  roadmapTitle: 'Et ensuite ?',
  roadmapSubtitle:
    'Les éléments ci-dessous sont encore planifiés. Beaucoup de modules autrefois “bientôt” (RH, équipements, caisse, PT) sont déjà dans la grille ci-dessus.',
  heroSubtitle:
    'CiCiByte SGMS unifie CRM, cycle d’abonnement, PT & commissions, POS/caisse, tourniquets, RH, équipements, reporting, messagerie temps réel et l’app SGMS Sporcu dans un SaaS premium.',
});
Object.assign(locales.ru, {
  featuresTitle: 'Полная ОС спортивного зала',
  featuresSubtitle:
    'От CRM до турникета, от кассы до комиссий PT и приложения спортсмена — возможности уже в проде.',
  roadmapTitle: 'Что дальше?',
  roadmapSubtitle:
    'Ниже — ещё в плане/разработке. Многие модули, которые казались «скоро» (HR, оборудование, касса, PT), уже в сетке выше.',
  heroSubtitle:
    'CiCiByte SGMS объединяет CRM, жизненный цикл членства, PT и комиссии, POS/кассу, турникеты, HR, оборудование, отчёты, realtime-чат и мобильное приложение SGMS Sporcu в одном SaaS.',
});

for (const [lang, pack] of Object.entries(locales)) {
  const file = path.join(dir, `${lang}.json`);
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  j.marketing.features.title = pack.featuresTitle;
  j.marketing.features.subtitle = pack.featuresSubtitle;
  j.marketing.features.items = pack.featureItems;
  j.marketing.roadmap.title = pack.roadmapTitle;
  j.marketing.roadmap.subtitle = pack.roadmapSubtitle;
  j.marketing.hero.subtitle = pack.heroSubtitle;
  j.marketing.stats = pack.stats;
  j.comingSoon.features = {
    ...j.comingSoon.features,
    ...pack.comingSoon,
  };
  // Keep legacy keys used by dashboard placeholders if any, but marketing roadmap only shows new set
  if (j.mobileAthlete?.showcase?.highlights) {
    j.mobileAthlete.showcase.highlights = pack.showcaseHighlights;
  }
  fs.writeFileSync(file, `${JSON.stringify(j, null, 2)}\n`);
  console.log('patched', lang);
}
