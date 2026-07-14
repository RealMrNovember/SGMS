import { siteConfig } from '@/lib/site-config';
import Link from 'next/link';

export const metadata = {
  title: `Gizlilik Politikası — ${siteConfig.name}`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="muted text-sm hover:text-white">
        ← Ana sayfa
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Gizlilik Politikası ve KVKK Aydınlatma Metni</h1>
      <p className="muted mt-3 text-sm">Son güncelleme: 15 Temmuz 2026</p>

      <div className="prose-legal mt-10 space-y-8 text-sm leading-7">
        <section>
          <h2 className="text-lg font-semibold text-white">1. Veri Sorumlusu</h2>
          <p className="muted mt-2">
            İşbu Gizlilik Politikası, 6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında
            veri sorumlusu sıfatıyla <strong className="text-white">{siteConfig.company}</strong> ({siteConfig.contact.address})
            tarafından, {siteConfig.name} (&quot;SGMS&quot;, &quot;Hizmet&quot;) kullanıcılarının kişisel
            verilerinin işlenmesine ilişkin olarak hazırlanmıştır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">2. İşlenen Kişisel Veriler</h2>
          <p className="muted mt-2">Hizmet kapsamında aşağıdaki kategorilerde kişisel veri işlenmektedir:</p>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li><strong className="text-white">Kimlik bilgileri:</strong> ad-soyad, T.C. kimlik numarası veya pasaport numarası, doğum tarihi, uyruk</li>
            <li><strong className="text-white">İletişim bilgileri:</strong> e-posta, telefon, adres</li>
            <li><strong className="text-white">Sağlık verileri (özel nitelikli):</strong> boy, kilo, vücut ölçümleri ve antrenman/beslenme programları — yalnızca üyenin kendi salonundaki yetkili personel (OWNER/ADMIN/STAFF/TRAINER) tarafından görüntülenebilir</li>
            <li><strong className="text-white">Biyometrik/erişim verileri:</strong> RFID kart kimliği, QR check-in kayıtları, giriş-çıkış zaman damgaları</li>
            <li><strong className="text-white">Finansal veriler:</strong> cari hesap/borç kayıtları, ödeme yöntemi, işlem tutarları</li>
            <li><strong className="text-white">İşlem güvenliği verileri:</strong> IP adresi, oturum/giriş kayıtları, denetim (audit) logları</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">3. İşleme Amaçları ve Hukuki Sebep</h2>
          <p className="muted mt-2">
            Verileriniz; salon üyelik ve antrenman takibi, check-in/erişim kontrolü, cari hesap ve
            faturalandırma, hesap güvenliği, yasal yükümlülüklerin yerine getirilmesi ve hizmet kalitesinin
            artırılması amacıyla, KVKK md. 5/2 kapsamında bir sözleşmenin kurulması/ifası ve meşru menfaat
            hukuki sebeplerine dayanılarak işlenir. Sağlık verileri gibi özel nitelikli kişisel veriler,
            açık rızanız alınmak suretiyle işlenir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">4. Verilerin Aktarıldığı Taraflar</h2>
          <p className="muted mt-2">Kişisel verileriniz aşağıdaki durumlarda, sınırlı ve amaçla bağlantılı şekilde aktarılabilir:</p>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-white">cloud.cicibyte.com (CiciByte Cloud):</strong> merkezi abonelik/lisans
              takibi ve — kartla ödeme tercih ettiğinizde — ödeme işleminin gerçekleştirilmesi amacıyla salon adı,
              e-posta ve ödeme tutarı bilgileri aktarılır.
            </li>
            <li>
              <strong className="text-white">iyzico:</strong> kartla ödeme işlemleri, cloud.cicibyte.com üzerinden
              iyzico&apos;nun güvenli ödeme altyapısı ile gerçekleştirilir; kart bilgileriniz SGMS veya CiciByte Cloud
              sunucularında hiçbir zaman saklanmaz.
            </li>
            <li>
              <strong className="text-white">Yetkili kamu kurumları:</strong> yasal bir talep halinde, mevzuatın
              öngördüğü ölçüde.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">5. Veri Saklama Süresi</h2>
          <p className="muted mt-2">
            Kişisel verileriniz, işleme amacının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen
            zamanaşımı süreleri (örn. finansal kayıtlar için 10 yıl) saklanır; bu sürenin sonunda silinir,
            yok edilir veya anonim hale getirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">6. KVKK Madde 11 Kapsamındaki Haklarınız</h2>
          <p className="muted mt-2">Kişisel verisi işlenen ilgili kişi olarak KVKK md. 11 uyarınca:</p>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme,</li>
            <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
            <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
            <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
            <li>Silinmesini veya yok edilmesini isteme,</li>
            <li>İşlenen verilerin münhasıran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
            <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
          </ul>
          <p className="muted mt-2">
            haklarına sahipsiniz. Taleplerinizi{' '}
            <a href={`mailto:${siteConfig.contact.support}`} className="text-white hover:underline">
              {siteConfig.contact.support}
            </a>{' '}
            adresine iletebilirsiniz. Kendi salonunuzun yönetim panelinden de veri indirme/hesap silme talebi
            oluşturabilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">7. Çerezler</h2>
          <p className="muted mt-2">
            SGMS yalnızca oturum yönetimi ve dil tercihi için zorunlu çerezler kullanır; reklam/izleme amaçlı
            üçüncü taraf çerezi kullanılmaz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">8. İletişim</h2>
          <p className="muted mt-2">
            Sorularınız için{' '}
            <a href={`mailto:${siteConfig.contact.support}`} className="text-white hover:underline">
              {siteConfig.contact.support}
            </a>{' '}
            adresinden bize ulaşabilirsiniz.
          </p>
        </section>
      </div>
    </div>
  );
}
