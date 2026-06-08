import { InviteTeamForm } from '@/components/invite-team-form';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const [organization, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { name: true, slug: true },
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId: session.user.organizationId,
        isActive: true,
      },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const canInvite = session.user.role ? MANAGER_ROLES.has(session.user.role) : false;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          ← Özet
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">Personel Yönetimi</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">
          {organization?.name} ({organization?.slug}) organizasyonundaki ekip üyelerini yönetin.
        </p>
      </div>

      <InviteTeamForm canInvite={canInvite} />

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="text-lg font-semibold">Ekip Listesi</h3>
          <p className="muted mt-1 text-sm">{members.length} aktif üye</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 font-medium">Ad</th>
                <th className="px-6 py-3 font-medium">E-posta</th>
                <th className="px-6 py-3 font-medium">Rol</th>
                <th className="px-6 py-3 font-medium">Katılım</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-[var(--border)] last:border-none">
                  <td className="px-6 py-4 font-medium">{member.user.name}</td>
                  <td className="px-6 py-4">{member.user.email}</td>
                  <td className="px-6 py-4">
                    <span className="badge">{member.role}</span>
                  </td>
                  <td className="muted px-6 py-4">
                    {(member.joinedAt ?? member.invitedAt ?? member.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
