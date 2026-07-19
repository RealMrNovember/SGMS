import { ShiftAssignForm, ShiftCreateForm, ShiftWeeklyCalendar } from '@/components/hr/shift-forms';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const HR_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

export default async function HrShiftsPage() {
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
  const t = await getTranslations('faz22.shifts');

  const [shifts, staffMembers] = await Promise.all([
    prisma.shift.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(isAdmin ? {} : { assignments: { some: { userId } } }),
      },
      include: {
        assignments: {
          include: { user: { select: { name: true, email: true } } },
          ...(isAdmin ? {} : { where: { userId } }),
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    isAdmin
      ? prisma.organizationMember.findMany({
          where: {
            organizationId,
            isActive: true,
            role: { in: ['OWNER', 'ADMIN', 'STAFF', 'TRAINER'] },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const shiftsByDay: Record<
    number,
    {
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      assignments: { userName: string; notes: string | null }[];
    }[]
  > = {};

  for (const shift of shifts) {
    const bucket = shiftsByDay[shift.dayOfWeek] ?? [];
    bucket.push({
      id: shift.id,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      assignments: shift.assignments.map((a) => ({
        userName: a.user.name ?? a.user.email,
        notes: a.notes,
      })),
    });
    shiftsByDay[shift.dayOfWeek] = bucket;
  }

  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    label: `${s.name} (${s.startTime}–${s.endTime})`,
  }));

  const staffOptions = staffMembers.map((m) => ({
    id: m.user.id,
    label: m.user.name ?? m.user.email,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/hr" className="muted text-sm hover:text-white">
          {t('back')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm">{t('subtitle')}</p>
      </div>

      {isAdmin ? (
        <>
          <ShiftCreateForm />
          <ShiftAssignForm shifts={shiftOptions} staff={staffOptions} />
        </>
      ) : null}

      <ShiftWeeklyCalendar shiftsByDay={shiftsByDay} />
    </div>
  );
}
