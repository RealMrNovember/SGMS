import { siteConfig } from '@/lib/site-config';
import Link from 'next/link';

export const metadata = {
  title: `Hesap ve Veri Silme — ${siteConfig.name}`,
  description:
    'SGMS Sporcu (CiCiByte SGMS) hesap silme ve kişisel veri silme talebi adımları.',
};

export default function AccountDeletionPage() {
  const support = siteConfig.contact.support;
  const mailHref = `mailto:${support}?subject=${encodeURIComponent(
    'SGMS Sporcu — Hesap / veri silme talebi',
  )}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="muted text-sm hover:text-white">
        ← Ana sayfa
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Hesap ve veri silme talebi — SGMS Sporcu
      </h1>
      <p className="muted mt-3 text-sm">
        Geliştirici: {siteConfig.company} · Uygulama: SGMS Sporcu (CiCiByte SGMS) · Son güncelleme: 22
        Temmuz 2026
      </p>

      <div className="prose-legal mt-10 space-y-8 text-sm leading-7">
        <section>
          <h2 className="text-lg font-semibold text-white">1. Hesabınızı nasıl silersiniz?</h2>
          <ol className="muted mt-2 list-decimal space-y-2 pl-5">
            <li>
              Aşağıdaki e-posta adresine yazın:{' '}
              <a href={mailHref} className="text-white hover:underline">
                {support}
              </a>
            </li>
            <li>
              Konu satırında <strong className="text-white">“Hesap silme talebi”</strong> yazın.
            </li>
            <li>
              Mesajınızda şunları belirtin: uygulamada kullandığınız{' '}
              <strong className="text-white">e-posta adresi</strong>, bağlı olduğunuz{' '}
              <strong className="text-white">spor salonu adı</strong> (varsa), ve talebinizin{' '}
              <strong className="text-white">hesap silme</strong> mi yoksa yalnızca{' '}
              <strong className="text-white">belirli verilerin silinmesi</strong> mi olduğu.
            </li>
            <li>
              Kimliğinizi doğruladıktan sonra talebinizi işleme alırız. Talebin alındığını e-posta ile
              teyit ederiz.
            </li>
          </ol>
          <p className="muted mt-3">
            Alternatif: Salonunuz SGMS web panelini kullanıyorsa, salon yöneticiniz (OWNER/ADMIN)
            üzerinden de silme / düzeltme talebi iletebilirsiniz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">2. Silinen veriler</h2>
          <p className="muted mt-2">
            Hesap silme talebi onaylandığında, makul süre içinde (hedef: talep tarihinden itibaren en
            geç 30 gün) aşağıdaki veriler silinir veya kimliği belirlenemez hale getirilir:
          </p>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li>Giriş hesabı (e-posta, ad, profil bilgileri)</li>
            <li>Uygulama oturum / cihaz bildirim (push) tokenları</li>
            <li>Mesajlaşma içerikleri (sporcu hesabına bağlı)</li>
            <li>Beslenme günlüğü, hedefler ve sporcuya özel uygulama tercihleri</li>
            <li>
              İlerleme fotoğrafları ve sağlık/fitness ölçümleri (üyelik kaydı ile bağlıysa, yasal
              saklama zorunluluğu yoksa)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">3. Saklanan / gecikmeli silinen veriler</h2>
          <p className="muted mt-2">
            Yasal yükümlülükler ve muhasebe kayıtları nedeniyle bazı veriler geçici veya zorunlu süreyle
            saklanabilir:
          </p>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-white">Finansal / cari kayıtlar</strong> (ödeme, borç, fatura
              ilişkili işlemler): ilgili mevzuat uyarınca genellikle en fazla{' '}
              <strong className="text-white">10 yıl</strong>
            </li>
            <li>
              <strong className="text-white">Check-in / erişim güvenlik logları</strong>: işletme ve
              güvenlik ihtiyaçları ölçüsünde sınırlı süre
            </li>
            <li>
              <strong className="text-white">Denetim (audit) kayıtları</strong>: güvenlik ve uyumluluk
              amacıyla gerekli olduğu sürece
            </li>
          </ul>
          <p className="muted mt-2">
            Bu kayıtlar hesap erişimini sürdürmek için kullanılmaz; yalnızca yasal / muhasebe /
            güvenlik amaçlıdır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">
            4. Hesabı silmeden veri silme (kısmi silme)
          </h2>
          <p className="muted mt-2">
            Hesabınızı kapatmadan da belirli verilerin (ör. ölçümler, ilerleme fotoğrafları, mesajlar)
            silinmesini talep edebilirsiniz. Aynı e-posta adresine (
            <a href={mailHref} className="text-white hover:underline">
              {support}
            </a>
            ) yazmanız yeterlidir; hangi veri kategorisinin silinmesini istediğinizi belirtin.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">5. English summary (for Google Play)</h2>
          <p className="muted mt-2">
            To delete your <strong className="text-white">SGMS Sporcu</strong> account (developer:{' '}
            <strong className="text-white">{siteConfig.company}</strong>), email{' '}
            <a href={mailHref} className="text-white hover:underline">
              {support}
            </a>{' '}
            with subject “Account deletion request”, your app email, and gym name. We process verified
            requests within 30 days. Account profile, messages, push tokens, nutrition logs, and
            fitness data are deleted or anonymized. Financial/ledger records may be retained up to 10
            years where required by law. You may also request deletion of specific data without closing
            your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">6. İlgili belgeler</h2>
          <ul className="muted mt-2 list-disc space-y-1 pl-5">
            <li>
              <Link href="/privacy" className="text-white hover:underline">
                Gizlilik Politikası / KVKK
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-white hover:underline">
                Kullanım Koşulları
              </Link>
            </li>
            <li>
              Web: {siteConfig.url}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
