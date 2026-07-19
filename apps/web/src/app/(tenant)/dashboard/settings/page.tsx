import { SettingsWorkspace } from '@/components/settings/settings-workspace';
import { auth } from '@/lib/auth';
import { parseOrganizationSettings } from '@/lib/admin/org-settings';
import { prisma } from '@/lib/prisma';
import type { OrganizationRole } from '@sgms/database';
import { redirect } from 'next/navigation';

const SETTINGS_ROLES = new Set<OrganizationRole>([
  'OWNER',
  'ADMIN',
  'STAFF',
  'TRAINER',
  'VIEWER',
]);

export default async function DashboardSettingsPage() {
  const session = await auth();
  if (!session?.user?.organizationId || !session.user.role) {
    redirect('/login');
  }

  if (!SETTINGS_ROLES.has(session.user.role)) {
    redirect('/dashboard');
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true, name: true },
  });

  if (!org) {
    redirect('/dashboard');
  }

  const settings = parseOrganizationSettings(org.settings);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SettingsWorkspace role={session.user.role} orgName={org.name} settings={settings} />
    </div>
  );
}
