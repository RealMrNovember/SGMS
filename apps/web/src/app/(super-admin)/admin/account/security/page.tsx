import { TwoFactorSetupPanel } from '@/components/two-factor-setup-panel';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminAccountSecurityPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Hesap Güvenliği</h2>
        <p className="muted mt-2 text-sm">
          Master Admin hesabınız için iki faktörlü doğrulama (2FA) zorunludur.
        </p>
      </section>

      <TwoFactorSetupPanel twoFactorEnabled={session.user.twoFactorEnabled} mandatory />
    </div>
  );
}
