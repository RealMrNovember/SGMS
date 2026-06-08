import { AddMeasurementForm } from '@/components/add-measurement-form';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

const MEASUREMENT_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF', 'TRAINER']);

function formatDecimal(value: { toString: () => string } | null | undefined) {
  return value != null ? value.toString() : '—';
}

export default async function MemberMeasurementsPage({
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
  const canManage = role ? MEASUREMENT_ROLES.has(role) : false;

  const member = await prisma.gymMember.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      email: true,
    },
  });

  if (!member) {
    notFound();
  }

  const measurements = await prisma.healthMeasurement.findMany({
    where: { organizationId, gymMemberId: id },
    orderBy: { measuredAt: 'desc' },
    take: 50,
  });

  const weightSeries = [...measurements]
    .filter((m) => m.weight != null)
    .reverse()
    .slice(-12);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/dashboard/members/${id}`} className="muted text-sm hover:text-white">
          ← Üye Profili
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">
          {member.firstName} {member.lastName} — Sağlık Ölçümleri
        </h2>
        <p className="muted mt-2 text-sm">
          {member.email ?? 'E-posta yok'} · {member.status}
        </p>
      </div>

      {weightSeries.length > 1 ? (
        <section className="card p-6">
          <h3 className="text-lg font-semibold">Kilo Trendi (son {weightSeries.length} ölçüm)</h3>
          <div className="mt-4 flex h-32 items-end gap-2">
            {weightSeries.map((m) => {
              const max = Math.max(...weightSeries.map((x) => Number(x.weight)));
              const min = Math.min(...weightSeries.map((x) => Number(x.weight)));
              const range = max - min || 1;
              const height = ((Number(m.weight) - min) / range) * 100;
              return (
                <div key={m.id} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-500/70"
                    style={{ height: `${Math.max(height, 8)}%` }}
                    title={`${m.weight} kg`}
                  />
                  <span className="muted text-[10px]">
                    {m.measuredAt.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <AddMeasurementForm gymMemberId={id} canManage={canManage} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">Ölçüm Geçmişi</h3>
          <p className="muted mt-1 text-sm">{measurements.length} kayıt</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">Tarih</th>
                <th className="px-6 py-3 font-medium">Kilo</th>
                <th className="px-6 py-3 font-medium">Yağ %</th>
                <th className="px-6 py-3 font-medium">Kas</th>
                <th className="px-6 py-3 font-medium">Boy</th>
                <th className="px-6 py-3 font-medium">Not</th>
              </tr>
            </thead>
            <tbody>
              {measurements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted px-6 py-8 text-center">
                    Henüz ölçüm yok.
                  </td>
                </tr>
              ) : (
                measurements.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">
                      {m.measuredAt.toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">{formatDecimal(m.weight)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.bodyFatPercentage)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.muscleMass)}</td>
                    <td className="px-6 py-4">{formatDecimal(m.height)}</td>
                    <td className="muted px-6 py-4">{m.notes ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
