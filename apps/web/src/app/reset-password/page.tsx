import { SgmsLogo } from '@/components/brand/sgms-logo';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <SgmsLogo size="sm" href={null} showWordmark />
          </Link>
        </div>

        <div className="relative z-10 mt-auto pt-16">
          <h1 className="login-title">Yeni parolanızı belirleyin</h1>
          <p className="muted mt-5 max-w-md text-sm leading-7">
            Bu bağlantı 60 dakika geçerlidir ve yalnızca bir kez kullanılabilir.
          </p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="badge">Parola Sıfırlama</span>
          <h2 className="mt-5 text-2xl font-medium tracking-tight">Yeni parola belirleyin</h2>

          {token ? (
            <>
              <p className="muted mt-2 mb-6 text-sm leading-6">
                Hesabınız için yeni bir parola girin.
              </p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-rose-400">
                Geçersiz bağlantı. Lütfen şifremi unuttum sayfasından yeni bir talep oluşturun.
              </p>
              <Link href="/forgot-password" className="button button-gold block w-full text-center">
                {t('forgotPassword')}
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
