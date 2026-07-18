import { TwoFactorSetupPanel } from '@/components/two-factor-setup-panel';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardAccountSecurityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const mandatory = session.user.role === 'OWNER' || session.user.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Hesap Güvenliği</h2>
        <p className="muted mt-2 text-sm">
          İki faktörlü doğrulama (2FA) ve yedek kodlarınızı buradan yönetin.
        </p>
      </section>

      <TwoFactorSetupPanel twoFactorEnabled={session.user.twoFactorEnabled} mandatory={mandatory} />
    </div>
  );
}
