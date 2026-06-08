import { AddMemberForm } from '@/components/add-member-form';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const MEMBER_MANAGER_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF']);

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const organizationId = session.user.organizationId;

  const [organization, plans, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    }),
    prisma.gymMembershipPlan.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        durationDays: true,
        price: true,
      },
    }),
    prisma.gymMember.findMany({
      where: { organizationId },
      include: { plan: true },
      orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      take: 50,
    }),
  ]);

  const canManage = session.user.role ? MEMBER_MANAGER_ROLES.has(session.user.role) : false;

  const planOptions = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    durationDays: plan.durationDays,
    price: plan.price.toString(),
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          ← Özet
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">Üye Yönetimi</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          {organization?.name} salonundaki sporcu ve üye kayıtları.
        </p>
      </div>

      <AddMemberForm canManage={canManage} plans={planOptions} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">Üye Listesi</h3>
          <p className="muted mt-1 text-sm">{members.length} kayıt gösteriliyor</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">Ad Soyad</th>
                <th className="px-6 py-3 font-medium">TC / Tel</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Durum</th>
                <th className="px-6 py-3 font-medium">Üyelik Bitiş</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted px-6 py-8 text-center">
                    Henüz kayıtlı üye yok.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="px-6 py-4">
                      <p className="font-medium">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="muted text-xs">{member.email ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p>{member.nationalId ?? '—'}</p>
                      <p className="muted text-xs">{member.phone ?? '—'}</p>
                    </td>
                    <td className="px-6 py-4">{member.plan?.name ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="badge">{member.status}</span>
                    </td>
                    <td className="muted px-6 py-4">
                      {member.membershipEndsAt
                        ? member.membershipEndsAt.toLocaleDateString('tr-TR')
                        : '—'}
                    </td>
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
