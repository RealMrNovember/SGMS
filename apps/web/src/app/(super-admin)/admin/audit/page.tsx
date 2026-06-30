import { auth } from '@/lib/auth';
import { formatDateTimeTr } from '@/lib/admin/format';
import { listPlatformAuditLogs } from '@/lib/admin/queries';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const tAdmin = await getTranslations('admin');
  const logs = await listPlatformAuditLogs(60);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('auditTitle')}</h2>
        <p className="muted mt-2 text-sm">{tAdmin('auditSubtitle')}</p>
      </section>

      <section className="card overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">
          {logs.map((log) => (
            <li key={log.id} className="px-6 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="muted text-xs">{formatDateTimeTr(log.createdAt)}</span>
              </div>
              <p className="muted mt-1 text-xs">
                {log.organization ? (
                  <>
                    <Link href={`/admin/organizations/${log.organizationId}`} className="hover:underline">
                      {log.organization.name}
                    </Link>
                    {' · '}
                  </>
                ) : null}
                {log.actor?.name ?? 'Sistem'}
                {log.actor?.isSuperAdmin ? ' (Master Admin)' : ''}
                {log.actor?.email ? ` · ${log.actor.email}` : ''}
              </p>
              {log.entityType ? (
                <p className="muted mt-1 text-xs">
                  {log.entityType}
                  {log.entityId ? ` · ${log.entityId.slice(0, 12)}…` : ''}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
