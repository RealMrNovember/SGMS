import { LeaveList, LeaveRequestForm } from '@/components/hr/leave-forms';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const HR_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

export default async function HrLeavesPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !HR_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const userId = session.user.id;
  const isAdmin = ADMIN_ROLES.has(role);
  const t = await getTranslations('faz22.leaves');

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      organizationId,
      ...(isAdmin ? {} : { userId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/hr" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <LeaveRequestForm />

      <LeaveList
        isAdmin={isAdmin}
        showUser={isAdmin}
        leaves={leaves.map((leave) => ({
          id: leave.id,
          type: leave.type,
          startDate: leave.startDate.toLocaleDateString(),
          endDate: leave.endDate.toLocaleDateString(),
          status: leave.status,
          reason: leave.reason,
          userName: leave.user.name ?? leave.user.email,
          userEmail: leave.user.email,
        }))}
      />
    </div>
  );
}
