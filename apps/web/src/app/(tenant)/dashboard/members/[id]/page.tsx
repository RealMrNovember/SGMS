import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

function formatDecimal(value: { toString: () => string } | null | undefined) {
  return value != null ? value.toString() : '—';
}

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

  const member = await prisma.gymMember.findFirst({
    where: { id, organizationId },
    include: {
      plan: true,
      trainer: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!member) {
    notFound();
  }

  const [recentMeasurements, activePrograms] = await Promise.all([
    prisma.healthMeasurement.findMany({
      where: { organizationId, gymMemberId: id },
      orderBy: { measuredAt: 'desc' },
      take: 5,
    }),
    prisma.trainingProgram.findMany({
      where: { organizationId, gymMemberId: id, isActive: true },
      include: { trainer: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
      take: 5,
    }),
  ]);

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
          <h3 className="text-lg font-semibold">Notlar</h3>
          <p className="muted mt-3 whitespace-pre-wrap text-sm">{member.notes}</p>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Son Ölçümler</h3>
            <p className="muted mt-1 text-sm">{recentMeasurements.length} kayıt</p>
          </div>
          <Link
            href={`/dashboard/members/${id}/measurements`}
            className="muted text-sm hover:text-white"
          >
            Tümünü gör →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Tarih</th>
                <th className="px-6 py-3">Kilo</th>
                <th className="px-6 py-3">Yağ %</th>
              </tr>
            </thead>
            <tbody>
              {recentMeasurements.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted px-6 py-6 text-center">
                    Henüz ölçüm yok.
                  </td>
                </tr>
              ) : (
                recentMeasurements.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-3">{m.measuredAt.toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-3">{formatDecimal(m.weight)}</td>
                    <td className="px-6 py-3">{formatDecimal(m.bodyFatPercentage)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">Aktif Programlar</h3>
            <p className="muted mt-1 text-sm">{activePrograms.length} program</p>
          </div>
          <Link
            href={`/dashboard/programs?member=${id}`}
            className="muted text-sm hover:text-white"
          >
            Programlara git →
          </Link>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {activePrograms.length === 0 ? (
            <p className="muted px-6 py-6 text-center text-sm">Aktif program yok.</p>
          ) : (
            activePrograms.map((p) => (
              <article key={p.id} className="px-6 py-4">
                <p className="font-medium">{p.title}</p>
                <p className="muted text-sm">
                  {p.type} · {p.trainer.name ?? '—'} ·{' '}
                  {p.startDate.toLocaleDateString('tr-TR')}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
