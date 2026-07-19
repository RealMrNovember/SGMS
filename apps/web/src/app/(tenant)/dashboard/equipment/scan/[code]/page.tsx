import { resolveEquipmentByCode } from '@/actions/equipment';
import { auth } from '@/lib/auth';
import { MANAGER_ROLES } from '@/lib/billing/roles';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ code: string }>;
};

export default async function EquipmentScanPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !MANAGER_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const { code } = await params;
  const resolved = await resolveEquipmentByCode(decodeURIComponent(code), session.user.organizationId);

  if (!resolved) {
    notFound();
  }

  redirect(`/dashboard/equipment/${resolved.id}`);
}

export async function generateMetadata() {
  const t = await getTranslations('faz23');
  return { title: t('scanTitle') };
}
