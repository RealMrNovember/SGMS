export type EmailTemplate = {
  id: string;
  category: 'onboarding' | 'billing' | 'support' | 'retention';
  title: string;
  subject: string;
  body: string;
};

export const adminEmailTemplates: EmailTemplate[] = [
  {
    id: 'welcome-trial',
    category: 'onboarding',
    title: 'Deneme hoş geldiniz',
    subject: 'SGMS deneme hesabınız hazır — {salonAdi}',
    body: `Merhaba {sahipAdi},

{salonAdi} için SGMS deneme hesabınız aktif. {denemeGun} günlük deneme süreniz {denemeBitis} tarihinde sona erecek.

Giriş: https://sgms.cicibyte.com/login
Destek: support@cicibyte.com

Kurulumda yardıma ihtiyacınız olursa yanıtlayın; ekibimiz sizi yönlendirecektir.

Saygılarımızla,
CiCiByte SGMS Ekibi`,
  },
  {
    id: 'trial-ending',
    category: 'retention',
    title: 'Deneme süresi bitiyor',
    subject: 'SGMS deneme süreniz {kalanGun} gün içinde bitiyor',
    body: `Merhaba {sahipAdi},

{salonAdi} hesabınızın deneme süresi {denemeBitis} tarihinde sona erecek.

Kesintisiz kullanım için paket seçimi veya fatura bilgilerinizi tamamlamanızı rica ederiz:
https://sgms.cicibyte.com/login

Sorularınız için bu e-postayı yanıtlayabilir veya support@cicibyte.com adresine yazabilirsiniz.

CiCiByte SGMS`,
  },
  {
    id: 'upgrade-offer',
    category: 'billing',
    title: 'Paket yükseltme teklifi',
    subject: 'SGMS {planAdi} paketine geçiş',
    body: `Merhaba {sahipAdi},

{salonAdi} için mevcut {mevcutPlan} paketiniz operasyon ihtiyaçlarınıza uygun görünüyor. Dilerseniz {planAdi} paketine geçerek daha yüksek üye/personel limitlerinden yararlanabilirsiniz.

Detaylı fiyatlandırma için yanıtlayın; size özel teklif hazırlayalım.

CiCiByte SGMS Satış`,
  },
  {
    id: 'payment-reminder',
    category: 'billing',
    title: 'Ödeme hatırlatması',
    subject: 'SGMS abonelik ödemesi — {salonAdi}',
    body: `Merhaba {sahipAdi},

{salonAdi} SGMS aboneliğiniz için ödeme bilgisi güncellenmesi gerekiyor. Gecikme durumunda panel erişiminiz kısıtlanabilir.

Lütfen fatura/ödeme durumunuzu kontrol edin veya muhasebe ekibimizle iletişime geçin: info@cicibyte.com

CiCiByte SGMS`,
  },
  {
    id: 'support-followup',
    category: 'support',
    title: 'Destek takibi',
    subject: 'SGMS destek talebiniz — {salonAdi}',
    body: `Merhaba {sahipAdi},

{salonAdi} hesabınızla ilgili destek talebinizi aldık. Ekibimiz inceleme yapıyor.

Talep özeti: {not}

Güncelleme için bu e-postayı yanıtlayabilirsiniz.

CiCiByte Destek`,
  },
  {
    id: 'account-suspended',
    category: 'support',
    title: 'Hesap askıya alındı',
    subject: 'SGMS hesap durumu — {salonAdi}',
    body: `Merhaba {sahipAdi},

{salonAdi} SGMS hesabınız geçici olarak askıya alındı. Sebep: {sebep}

Hesabınızı yeniden açmak için lütfen bizimle iletişime geçin: support@cicibyte.com

CiCiByte SGMS`,
  },
];

export function fillEmailTemplate(
  template: EmailTemplate,
  vars: Record<string, string>,
): { subject: string; body: string } {
  const replace = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);

  return {
    subject: replace(template.subject),
    body: replace(template.body),
  };
}

export function buildMailtoUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    subject,
    body,
  });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}
