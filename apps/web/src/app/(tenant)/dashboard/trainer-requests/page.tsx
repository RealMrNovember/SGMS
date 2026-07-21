import { TrainerRequestQueue } from '@/components/trainers/trainer-request-queue';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

export default async function TrainerRequestsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !ADMIN_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz42');

  const [pendingRequests, trainers] = await Promise.all([
    prisma.trainerRequest.findMany({
      where: { organizationId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        gymMember: {
          select: {
            firstName: true,
            lastName: true,
            trainer: { select: { name: true, email: true } },
          },
        },
        preferredTrainer: { select: { id: true, name: true } },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId, role: 'TRAINER', isActive: true },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/trainers" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      <TrainerRequestQueue
        requests={pendingRequests.map((req) => ({
          id: req.id,
          requestType: req.requestType,
          status: req.status,
          reason: req.reason,
          createdAt: req.createdAt.toISOString(),
          memberName: `${req.gymMember.firstName} ${req.gymMember.lastName}`,
          currentTrainerName: req.gymMember.trainer?.name ?? req.gymMember.trainer?.email ?? null,
          preferredTrainerName: req.preferredTrainer?.name ?? null,
          preferredTrainerId: req.preferredTrainerId,
        }))}
        trainerOptions={trainers.map((row) => ({
          id: row.user.id,
          name: row.user.name,
        }))}
      />
    </div>
  );
}
