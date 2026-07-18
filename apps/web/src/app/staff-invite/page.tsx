import { SgmsLogo } from '@/components/brand/sgms-logo';
import { StaffInviteForm } from '@/components/staff-invite-form';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StaffInvitePage({
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
          <h1 className="login-title">Ekibe hoş geldiniz</h1>
          <p className="muted mt-5 max-w-md text-sm leading-7">
            Hesabınız oluşturuldu — devam etmek için kendi parolanızı belirleyin.
          </p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="badge">Personel Daveti</span>
          <h2 className="mt-5 text-2xl font-medium tracking-tight">Parolanızı belirleyin</h2>

          {token ? (
            <>
              <p className="muted mt-2 mb-6 text-sm leading-6">
                Bu bağlantı 7 gün geçerlidir ve yalnızca bir kez kullanılabilir.
              </p>
              <StaffInviteForm token={token} />
            </>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-rose-400">
                Geçersiz davet bağlantısı. Lütfen yöneticinizden yeni bir davet isteyin.
              </p>
              <Link href="/login" className="button button-gold block w-full text-center">
                Giriş sayfasına dön
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
