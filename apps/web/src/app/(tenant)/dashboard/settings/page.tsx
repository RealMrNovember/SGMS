import { OrganizationSettingsPanel } from '@/components/organization-settings-panel';
import { auth } from '@/lib/auth';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export default async function DashboardSettingsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  if (!session.user.role || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    redirect('/dashboard');
  }

  const t = await getTranslations('settings');

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true, name: true },
  });

  if (!org) {
    redirect('/dashboard');
  }

  const settings = parseOrganizationSettings(org.settings);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
        <p className="muted mt-2 text-sm">{t('subtitle', { name: org.name })}</p>
      </section>

      <OrganizationSettingsPanel settings={settings} />
    </div>
  );
}
