import { AddMeasurementForm } from '@/components/add-measurement-form';
import { MemberHealthHistoryTable } from '@/components/member-health-history-table';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;
  const role = session.user.role;
  const canManageMeasurements = role ? MEASUREMENT_ROLES.has(role) : false;

  // Tenant izolasyonu: organizationId eşleşmesi zorunlu
  const member = await prisma.gymMember.findFirst({
    where: { id, organizationId },
    include: {
      plan: true,
      trainer: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, name: true, email: true } },
      healthMeasurements: {
        orderBy: { measuredAt: 'desc' },
      },
      trainingPrograms: {
        where: { isActive: true },
        orderBy: { startDate: 'desc' },
        include: {
          trainer: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!member) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/members" className="muted text-sm hover:text-white">
          ← Üyeler
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">
          {member.firstName} {member.lastName}
        </h2>
        <p className="muted mt-2 text-sm">
          <span className="badge">{member.status}</span>
          {member.gender !== 'UNSPECIFIED' ? ` · ${member.gender}` : ''}
          {role ? ` · görüntüleyen: ${role}` : ''}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h3 className="text-lg font-semibold">Profil</h3>
          <dl className="muted mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>E-posta</dt>
              <dd className="text-white">{member.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Telefon</dt>
              <dd className="text-white">{member.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>TC Kimlik</dt>
              <dd className="text-white">{member.nationalId ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Doğum Tarihi</dt>
              <dd className="text-white">
                {member.birthDate ? member.birthDate.toLocaleDateString('tr-TR') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Hesap</dt>
              <dd className="text-white">{member.user?.email ?? 'Bağlı değil'}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-6">
          <h3 className="text-lg font-semibold">Üyelik & PT</h3>
          <dl className="muted mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Salon Planı</dt>
              <dd className="text-white">{member.plan?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Üyelik Başlangıç</dt>
              <dd className="text-white">
                {member.membershipStartsAt
                  ? member.membershipStartsAt.toLocaleDateString('tr-TR')
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Üyelik Bitiş</dt>
              <dd className="text-white">
                {member.membershipEndsAt
                  ? member.membershipEndsAt.toLocaleDateString('tr-TR')
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Antrenör (PT)</dt>
              <dd className="text-white">
                {member.trainer?.name ?? member.trainer?.email ?? 'Atanmamış'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {member.notes ? (
        <section className="card p-6">
          <h3 className="text-lg font-semibold">Sporcu Notları</h3>
          <p className="muted mt-3 whitespace-pre-wrap text-sm">{member.notes}</p>
        </section>
      ) : null}

      <AddMeasurementForm gymMemberId={member.id} canManage={canManageMeasurements} />

      <MemberHealthHistoryTable measurements={member.healthMeasurements} />

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Aktif Antrenman Programları</h3>
            <p className="muted mt-1 text-sm">{member.trainingPrograms.length} program</p>
          </div>
          <Link
            href={`/dashboard/programs?member=${member.id}`}
            className="muted text-sm hover:text-white"
          >
            Tüm programlar →
          </Link>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {member.trainingPrograms.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">Aktif program atanmamış.</p>
          ) : (
            member.trainingPrograms.map((program) => (
              <article key={program.id} className="px-6 py-4">
                <p className="font-medium">{program.title}</p>
                <p className="muted text-sm">
                  {program.type} · {program.trainer.name ?? program.trainer.email ?? '—'} ·{' '}
                  {program.startDate.toLocaleDateString('tr-TR')}
                  {program.endDate
                    ? ` → ${program.endDate.toLocaleDateString('tr-TR')}`
                    : ''}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
