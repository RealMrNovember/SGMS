import { SgmsLogo } from '@/components/brand/sgms-logo';
import { ResetTwoFactorForm } from '@/components/reset-two-factor-form';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ResetTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <SgmsLogo size="sm" href={null} showWordmark />
          </Link>
        </div>

        <div className="relative z-10 mt-auto pt-16">
          <h1 className="login-title">2FA&apos;nızı sıfırlayın</h1>
          <p className="muted mt-5 max-w-md text-sm leading-7">
            Bu bağlantı 60 dakika geçerlidir ve yalnızca bir kez kullanılabilir.
          </p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="badge">2FA Kurtarma</span>
          <h2 className="mt-5 text-2xl font-medium tracking-tight">2FA sıfırlama onayı</h2>

          {token ? (
            <div className="mt-6">
              <ResetTwoFactorForm token={token} />
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-rose-400">
                Geçersiz bağlantı. Lütfen 2FA kurtarma sayfasından yeni bir talep oluşturun.
              </p>
              <Link href="/forgot-2fa" className="button button-gold block w-full text-center">
                2FA Kurtarma
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
