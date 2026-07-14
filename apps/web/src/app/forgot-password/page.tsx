import { SgmsLogo } from '@/components/brand/sgms-logo';
import { ForgotPasswordForm } from '@/components/forgot-password-form';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <SgmsLogo size="sm" href={null} showWordmark />
          </Link>
        </div>

        <div className="relative z-10 mt-auto pt-16">
          <h1 className="login-title">Şifrenizi mi unuttunuz?</h1>
          <p className="muted mt-5 max-w-md text-sm leading-7">
            E-posta adresinizi girin, size bir şifre sıfırlama bağlantısı gönderelim.
          </p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="badge">Şifremi Unuttum</span>
          <h2 className="mt-5 text-2xl font-medium tracking-tight">Parolanızı sıfırlayın</h2>
          <p className="muted mt-2 mb-6 text-sm leading-6">
            Hesabınıza kayıtlı e-posta adresini girin — bir sıfırlama bağlantısı gönderelim.
          </p>

          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
