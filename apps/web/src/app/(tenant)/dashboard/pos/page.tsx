import { CashShiftPanel } from '@/components/cash-shift-panel';
import { ExpenseCategoryManager } from '@/components/expense-category-manager';
import { PendingStoreDeliveries } from '@/components/pending-store-deliveries';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';
import { PosTerminal } from '@/components/pos-terminal';
import { getOpenCashShift } from '@/actions/cash-register';
import { auth } from '@/lib/auth';
import { intlLocaleFor } from '@/lib/format-locale';
import { getDailyPosSummary } from '@/lib/pos-summary';
import { prisma } from '@/lib/prisma';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const POS_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF']);
const SUMMARY_ROLES = new Set(['OWNER', 'ADMIN']);
const CATEGORY_ROLES = new Set(['OWNER', 'ADMIN']);
// Teslimat işaretleme fiziksel bir POS işlemidir (kategori fiyatlama/mağaza
// görünürlüğü gibi idari bir karar değil) — resepsiyondaki STAFF de görüp
// teslim edebilmeli, aksi halde bir üye "su siparişim var" dediğinde
// resepsiyonist bunu bulamaz, yönetici çağırmak zorunda kalır.
const DELIVERY_ROLES = new Set(['OWNER', 'ADMIN', 'STAFF']);

export default async function PosPage() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect('/login');
  }

  const role = session.user.role;
  if (!role || !POS_ROLES.has(role)) {
    redirect('/dashboard');
  }

  const organizationId = session.user.organizationId;
  const canViewSummary = SUMMARY_ROLES.has(role);
  const canManageCategories = CATEGORY_ROLES.has(role);
  const canDeliverOrders = DELIVERY_ROLES.has(role);

  const t = await getTranslations('pos');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  const [members, categories, allCategories, summary, openShift, pendingDeliveries] = await Promise.all([
    prisma.gymMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 200,
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.expenseCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, defaultAmount: true },
    }),
    canManageCategories
      ? prisma.expenseCategory.findMany({
          where: { organizationId },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            defaultAmount: true,
            sortOrder: true,
            isActive: true,
            stockQuantity: true,
            lowStockThreshold: true,
            isStoreVisible: true,
            imageUrl: true,
          },
        })
      : Promise.resolve([]),
    canViewSummary ? getDailyPosSummary(organizationId) : Promise.resolve(null),
    getOpenCashShift(organizationId),
    // Faz 40 — mobil mağazadan alınmış, resepsiyonda henüz elden teslim
    // edilmemiş siparişler ("Bekleyen Teslimatlar"). POS'tan yapılan satışlar
    // anında teslim edilmiş sayıldığı için (`deliveredAt` hemen doldurulur) bu
    // listede asla görünmezler.
    prisma.expense.findMany({
      where: { organizationId, status: { not: 'VOID' }, deliveredAt: null, categoryId: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        createdAt: true,
        gymMember: { select: { firstName: true, lastName: true } },
        category: { select: { name: true, imageUrl: true } },
      },
    }),
  ]);

  const currency = 'TRY';
  const formatter = new Intl.NumberFormat(dateLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="muted text-sm hover:text-white">
          {t('backToOverview')}
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <h2 className="text-2xl font-semibold">{t('title')}</h2>
          <ContextualHelpButton topic="topic-pos" />
        </div>
        <p className="muted mt-2 text-sm">{t('subtitle')}</p>
      </div>

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="card p-5">
            <p className="muted text-xs">{t('summary.chargesToday')}</p>
            <p className="mt-2 text-xl font-semibold">{formatter.format(summary.chargesTotal)}</p>
            <p className="muted mt-1 text-xs">{t('summary.count', { count: summary.chargesCount })}</p>
          </article>
          <article className="card p-5">
            <p className="muted text-xs">{t('summary.paymentsToday')}</p>
            <p className="mt-2 text-xl font-semibold text-emerald-200">
              {formatter.format(summary.paymentsTotal)}
            </p>
            <p className="muted mt-1 text-xs">{t('summary.count', { count: summary.paymentsCount })}</p>
          </article>
          <article className="card p-5">
            <p className="muted text-xs">{t('summary.openBalance')}</p>
            <p className="mt-2 text-xl font-semibold text-amber-200">
              {formatter.format(summary.openBalanceTotal)}
            </p>
            <p className="muted mt-1 text-xs">
              {t('summary.openCount', { count: summary.openChargesCount })}
            </p>
          </article>
          <article className="card p-5">
            <p className="muted text-xs">{t('summary.byMethod')}</p>
            <ul className="muted mt-2 space-y-1 text-xs">
              {summary.paymentsByMethod.length === 0 ? (
                <li>{t('summary.noPayments')}</li>
              ) : (
                summary.paymentsByMethod.map((row) => (
                  <li key={row.method} className="flex justify-between gap-2">
                    <span>{row.method}</span>
                    <span className="text-white">{formatter.format(row.total)}</span>
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>
      ) : null}

      <CashShiftPanel
        currency={currency}
        openShift={
          openShift
            ? {
                id: openShift.id,
                openedAt: openShift.openedAt.toISOString(),
                openingBalance: openShift.openingBalance.toString(),
                openedByName: openShift.openedBy.name ?? '—',
              }
            : null
        }
      />

      <PosTerminal
        members={members.map((m) => ({
          id: m.id,
          label: `${m.firstName} ${m.lastName}`,
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          defaultAmount: c.defaultAmount?.toString() ?? null,
        }))}
        currency={currency}
      />

      {canDeliverOrders ? (
        <PendingStoreDeliveries
          currency={currency}
          orders={pendingDeliveries.map((e) => ({
            id: e.id,
            description: e.description,
            categoryName: e.category?.name ?? null,
            categoryImageUrl: e.category?.imageUrl ?? null,
            amount: e.amount.toString(),
            status: e.status,
            createdAt: e.createdAt.toISOString(),
            memberName: `${e.gymMember.firstName} ${e.gymMember.lastName}`,
          }))}
        />
      ) : null}

      {canManageCategories ? (
        <ExpenseCategoryManager
          currency={currency}
          categories={allCategories.map((c) => ({
            id: c.id,
            name: c.name,
            defaultAmount: c.defaultAmount?.toString() ?? null,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
            stockQuantity: c.stockQuantity,
            lowStockThreshold: c.lowStockThreshold,
            isStoreVisible: c.isStoreVisible,
            imageUrl: c.imageUrl,
          }))}
        />
      ) : null}
    </div>
  );
}
