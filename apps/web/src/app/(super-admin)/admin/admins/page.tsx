import { MasterAdminPanel } from '@/components/admin/master-admin-panel';
import { auth } from '@/lib/auth';
import { getMasterAdminStats, listMasterAdmins } from '@/lib/admin/master-admin-queries';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function AdminMasterAdminsPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const tAdmin = await getTranslations('admin');
  const [admins, stats] = await Promise.all([listMasterAdmins(), getMasterAdminStats()]);

  const rows = admins.map((admin) => ({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    status: admin.status,
    locale: admin.locale,
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    membershipCount: admin._count.memberships,
    activeTokens: admin._count.apiTokens,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('adminsTitle')}</h2>
        <p className="muted mt-2 max-w-3xl text-sm">{tAdmin('adminsSubtitle')}</p>
      </section>

      <MasterAdminPanel
        admins={rows}
        currentUserId={session.user.id}
        stats={stats}
      />
    </div>
  );
}
