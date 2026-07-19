import { LeadCreateForm } from '@/components/leads/lead-create-form';
import { LeadsBoard } from '@/components/leads/leads-board';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// Aday takibi resepsiyon/satış görevi — TRAINER kapsam dışı (bkz. Faz 36.5 gerekçesi).
const LEAD_MANAGER_ROLES = new Set<OrganizationRole>(['OWNER', 'ADMIN', 'STAFF']);

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !LEAD_MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const t = await getTranslations('leads');
  const organizationId = session.user.organizationId;

  const leads = await prisma.lead.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      followUps: { orderBy: { scheduledAt: 'asc' } },
      assignedTo: { select: { name: true } },
    },
  });

  const serializedLeads = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    interestedPlan: lead.interestedPlan,
    notes: lead.notes,
    status: lead.status,
    assignedToName: lead.assignedTo?.name ?? null,
    convertedMemberId: lead.convertedMemberId,
    createdAt: lead.createdAt.toISOString(),
    followUps: lead.followUps.map((followUp) => ({
      id: followUp.id,
      scheduledAt: followUp.scheduledAt.toISOString(),
      method: followUp.method,
      notes: followUp.notes,
      completedAt: followUp.completedAt ? followUp.completedAt.toISOString() : null,
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <h2 className="mt-4 text-2xl font-semibold">{t('title')}</h2>
        <p className="muted mt-2 max-w-2xl text-sm leading-6">{t('subtitle')}</p>
      </div>

      <LeadCreateForm />

      <LeadsBoard leads={serializedLeads} />
    </div>
  );
}
