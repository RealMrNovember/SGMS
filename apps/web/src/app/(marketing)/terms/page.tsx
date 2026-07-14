import { siteConfig } from '@/lib/site-config';
import Link from 'next/link';

export const metadata = {
  title: `Kullanım Şartları — ${siteConfig.name}`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="muted text-sm hover:text-white">
        ← Ana sayfa
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Kullanım Şartları</h1>
      <p className="muted mt-3 text-sm">Son güncelleme: 15 Temmuz 2026</p>

      <div className="prose-legal mt-10 space-y-8 text-sm leading-7">
        <section>
          <h2 className="text-lg font-semibold text-white">1. Taraflar ve Kabul</h2>
          <p className="muted mt-2">
            {siteConfig.name} (&quot;Hizmet&quot;), <strong className="text-white">{siteConfig.company}</strong>{' '}
            tarafından işletilen bir spor salonu yönetim yazılımıdır. Hizmete kayıt olarak veya kullanarak
            işbu Kullanım Şartları&apos;nı kabul etmiş sayılırsınız.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">2. Hizmetin Kapsamı</h2>
          <p className="muted mt-2">
            SGMS; üye/CRM yönetimi, sağlık ölçümü ve antrenman programı takibi, mesajlaşma, kasa/cari hesap
            (POS), turnike/check-in entegrasyonu ve ilgili raporlama araçlarını içeren bir SaaS (Hizmet
            Olarak Yazılım) ürünüdür. Hizmet, sürüm güncellemeleri ile zaman içinde değişiklik gösterebilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">3. Hesap ve Deneme Süresi</h2>
          <p className="muted mt-2">
            Yeni kayıtlar, {siteConfig.trialDays} günlük ücretsiz deneme süresiyle başlar. Deneme süresi
            sonunda aboneliğinizi aktifleştirmezseniz, hesabınız salt okunur moda geçer; verileriniz
            silinmez, yalnızca yazma işlemleri kısıtlanır.
          </p>
          <p className="muted mt-2">
            Hesap bilgilerinizin gizliliğinden ve hesabınız altında gerçekleştirilen tüm işlemlerden siz
            sorumlusunuz. Şüpheli bir erişim fark ederseniz derhal{' '}
            <a href={`mailto:${siteConfig.contact.support}`} className="text-white hover:underline">
              {siteConfig.contact.support}
            </a>{' '}
            adresine bildiriniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">4. Ücretlendirme ve Ödeme</h2>
          <p className="muted mt-2">
            Ücretli paketler aylık veya yıllık faturalandırılır. Kartla ödemeler, iş ortağımız{' '}
            <strong className="text-white">cloud.cicibyte.com</strong> üzerinden iyzico&apos;nun güvenli ödeme
            altyapısı ile işlenir; SGMS veya CiciByte Cloud sunucularında kart bilgileriniz saklanmaz. Banka
            havalesi ile ödeme de desteklenir. Ödeme onayı sonrası aboneliğiniz otomatik veya destek ekibimiz
            tarafından manuel olarak aktifleştirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">5. Kullanıcı Yükümlülükleri</h2>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li>Hizmeti yalnızca yasal amaçlarla ve yürürlükteki mevzuata (özellikle KVKK) uygun şekilde kullanmayı,</li>
            <li>Salonunuza kayıtlı üyelerin kişisel/sağlık verilerini işlerken gerekli açık rızayı temin etmeyi,</li>
            <li>Hesap erişim bilgilerinizi üçüncü kişilerle paylaşmamayı,</li>
            <li>Sistemin güvenliğini tehdit edecek (tersine mühendislik, aşırı yük bindirme, yetkisiz erişim denemesi vb.) faaliyetlerde bulunmamayı</li>
          </ul>
          <p className="muted mt-2">kabul edersiniz.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">6. Fikri Mülkiyet</h2>
          <p className="muted mt-2">
            SGMS yazılımı, tasarımı ve markası {siteConfig.company}&apos;a aittir. Salonunuza ait üye verileri
            ve içerikler size aittir; hesabınızı kapattığınızda verilerinizi dışa aktarma hakkına sahipsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">7. Sorumluluğun Sınırlandırılması</h2>
          <p className="muted mt-2">
            Hizmet &quot;olduğu gibi&quot; sunulur. {siteConfig.company}, mücbir sebepler, üçüncü taraf hizmet
            kesintileri (ödeme sağlayıcısı, sunucu barındırma vb.) veya kullanıcı hatasından kaynaklanan
            dolaylı zararlardan sorumlu tutulamaz. Sorumluluğumuz, yürürlükteki mevzuatın izin verdiği azami
            ölçüde, son 12 ayda ödenen abonelik bedeli ile sınırlıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">8. Fesih</h2>
          <p className="muted mt-2">
            Hesabınızı istediğiniz zaman kapatabilirsiniz. Kullanım Şartları&apos;nın ihlali halinde{' '}
            {siteConfig.company}, hesabınızı askıya alma veya sonlandırma hakkını saklı tutar; bu durumda
            önceden makul bir bildirim yapılır (yasa dışı kullanım hariç).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">9. Uygulanacak Hukuk</h2>
          <p className="muted mt-2">
            İşbu Kullanım Şartları Türkiye Cumhuriyeti kanunlarına tabidir; doğabilecek uyuşmazlıklarda
            İstanbul (Türkiye) mahkemeleri ve icra daireleri yetkilidir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">10. İletişim</h2>
          <p className="muted mt-2">
            Sorularınız için{' '}
            <a href={`mailto:${siteConfig.contact.support}`} className="text-white hover:underline">
              {siteConfig.contact.support}
            </a>{' '}
            adresinden bize ulaşabilirsiniz. Ayrıca bkz.{' '}
            <Link href="/privacy" className="text-white hover:underline">
              Gizlilik Politikası
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
