import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EquipmentCreateForm } from '@/components/equipment/equipment-forms';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMaintenanceBadge(
  schedules: { nextDueDate: Date; isActive: boolean }[],
): 'overdue' | 'dueToday' | null {
  const today = startOfDay(new Date());
  let overdue = false;
  let dueToday = false;

  for (const schedule of schedules) {
    if (!schedule.isActive) continue;
    const due = startOfDay(schedule.nextDueDate);
    if (due < today) overdue = true;
    if (due.getTime() === today.getTime()) dueToday = true;
  }

  if (overdue) return 'overdue';
  if (dueToday) return 'dueToday';
  return null;
}

export default async function EquipmentPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const t = await getTranslations('faz23');

  const equipment = await prisma.gymEquipment.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: {
      schedules: { where: { isActive: true }, select: { nextDueDate: true, isActive: true } },
      serviceLogs: { orderBy: { reportedAt: 'desc' }, take: 1, select: { reportedAt: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">{t('subtitle')}</p>
      </div>

      <EquipmentCreateForm />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">{t('listTitle')}</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {equipment.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">{t('empty')}</p>
          ) : (
            equipment.map((item) => {
              const badge = getMaintenanceBadge(item.schedules);
              const lastService = item.serviceLogs[0]?.reportedAt ?? null;

              return (
                <Link
                  key={item.id}
                  href={`/dashboard/equipment/${item.id}`}
                  className="flex flex-col gap-2 px-6 py-4 transition hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.name}</p>
                      <span className="badge text-[10px]">{t(`categories.${item.category}`)}</span>
                      <span className="badge text-[10px]">{t(`statuses.${item.status}`)}</span>
                      {badge === 'overdue' ? (
                        <span className="badge bg-rose-500/10 text-rose-300">{t('overdue')}</span>
                      ) : null}
                      {badge === 'dueToday' ? (
                        <span className="badge bg-amber-500/10 text-amber-300">{t('dueToday')}</span>
                      ) : null}
                    </div>
                    <p className="muted mt-1 text-sm">
                      {item.location ? `${item.location} · ` : ''}
                      {t('publicCodeLabel')}: {item.publicCode}
                      {lastService ? ` · ${t('lastService')}: ${lastService.toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span className="muted text-sm">→</span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
