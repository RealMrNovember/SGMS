import { reviewMessageReport } from '@/actions/message-reports';
import { AdminBadge } from '@/components/admin/admin-badge';
import { auth } from '@/lib/auth';
import { formatDateTimeTr } from '@/lib/admin/format';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function AdminModerationPage() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    redirect('/dashboard');
  }

  const tAdmin = await getTranslations('admin');

  const reports = await prisma.messageReport.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      organization: { select: { id: true, name: true } },
      reporter: { select: { name: true, email: true } },
      message: {
        select: {
          content: true,
          createdAt: true,
          sender: { select: { name: true, email: true } },
          receiver: { select: { name: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">{tAdmin('moderationTitle')}</h2>
        <p className="muted mt-2 text-sm">{tAdmin('moderationSubtitle')}</p>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <p className="text-sm font-medium">{tAdmin('moderationReportCount', { count: reports.length })}</p>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {reports.length ? (
            reports.map((report) => (
              <li key={report.id} className="space-y-4 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/admin/organizations/${report.organization.id}`}
                      className="font-medium hover:text-white"
                    >
                      {report.organization.name}
                    </Link>
                    <p className="muted mt-1 text-xs">
                      {formatDateTimeTr(report.createdAt)} · {report.reporter.name} (
                      {report.reporter.email})
                    </p>
                  </div>
                  <AdminBadge
                    label={report.status}
                    tone={
                      report.status === 'OPEN'
                        ? 'warning'
                        : report.status === 'REVIEWED'
                          ? 'success'
                          : 'muted'
                    }
                  />
                </div>

                <blockquote className="rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-sm">
                  {report.message.content}
                </blockquote>

                <p className="text-sm">
                  <span className="muted">{tAdmin('moderationReason')}</span> {report.reason}
                </p>
                <p className="muted text-xs">
                  {tAdmin('moderationParties', {
                    sender: report.message.sender.name ?? report.message.sender.email,
                    receiver: report.message.receiver.name ?? report.message.receiver.email,
                  })}
                </p>

                {report.status === 'OPEN' ? (
                  <div className="flex flex-wrap gap-2">
                    <form
                      action={async () => {
                        'use server';
                        await reviewMessageReport({
                          reportId: report.id,
                          status: 'REVIEWED',
                        });
                      }}
                    >
                      <button type="submit" className="button button-gold px-3 py-1.5 text-xs">
                        {tAdmin('moderationMarkReviewed')}
                      </button>
                    </form>
                    <form
                      action={async () => {
                        'use server';
                        await reviewMessageReport({
                          reportId: report.id,
                          status: 'DISMISSED',
                        });
                      }}
                    >
                      <button type="submit" className="button px-3 py-1.5 text-xs">
                        {tAdmin('moderationDismiss')}
                      </button>
                    </form>
                  </div>
                ) : report.reviewNotes ? (
                  <p className="muted text-xs">{tAdmin('moderationNote', { note: report.reviewNotes })}</p>
                ) : null}
              </li>
            ))
          ) : (
            <li className="px-6 py-12 text-center">
              <p className="muted text-sm">{tAdmin('moderationEmpty')}</p>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
