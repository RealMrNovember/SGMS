import { prisma } from '@/lib/prisma';

export type DashboardAlert = {
  id: string;
  severity: 'amber' | 'rose' | 'sky';
  title: string;
  subtitle: string;
  href: string;
  cta: string;
  count: number;
};

/** OWNER/ADMIN (ve STAFF) için dashboard "Bugün Dikkat Et" paneli verisi. */
export async function getDashboardAlerts(
  organizationId: string,
  role: string | null | undefined,
  now = new Date(),
): Promise<DashboardAlert[]> {
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [
    overdueInstallmentCount,
    membershipsExpiringSoonCount,
    lowStockCategories,
    pendingFreezes,
    pendingTrainerRequests,
    failedCheckouts,
  ] = await Promise.all([
    prisma.expense.count({
      where: {
        organizationId,
        status: 'OPEN',
        paymentPlanId: { not: null },
        dueDate: { lt: now },
      },
    }),
    prisma.gymMember.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        membershipEndsAt: { gte: now, lte: soon },
      },
    }),
    prisma.expenseCategory.findMany({
      where: { organizationId, isActive: true, stockQuantity: { not: null } },
      select: { stockQuantity: true, lowStockThreshold: true },
    }),
    prisma.membershipFreeze.count({
      where: { organizationId, status: 'PENDING' },
    }),
    isAdmin
      ? prisma.trainerRequest.count({
          where: { organizationId, status: 'PENDING' },
        })
      : Promise.resolve(0),
    prisma.tenantCheckoutSession.count({
      where: {
        organizationId,
        status: 'failed',
        createdAt: { gte: dayAgo },
      },
    }),
  ]);

  const lowStockCount = lowStockCategories.filter((c) => {
    const qty = c.stockQuantity ?? 0;
    const threshold = c.lowStockThreshold ?? 5;
    return qty <= threshold;
  }).length;

  const alerts: DashboardAlert[] = [];

  if (overdueInstallmentCount > 0) {
    alerts.push({
      id: 'overdue',
      severity: 'rose',
      title: `${overdueInstallmentCount} gecikmiş taksit`,
      subtitle: 'Tahsil edilmemiş vadesi geçmiş taksitler var.',
      href: '/dashboard/payment-plans',
      cta: 'Taksitleri gör',
      count: overdueInstallmentCount,
    });
  }
  if (membershipsExpiringSoonCount > 0) {
    alerts.push({
      id: 'expiring',
      severity: 'amber',
      title: `${membershipsExpiringSoonCount} üyelik 7 gün içinde bitiyor`,
      subtitle: 'Yenileme için üyelerle iletişime geçin.',
      href: '/dashboard/members',
      cta: 'Üyeleri gör',
      count: membershipsExpiringSoonCount,
    });
  }
  if (lowStockCount > 0) {
    alerts.push({
      id: 'stock',
      severity: 'amber',
      title: `${lowStockCount} ürün düşük stokta`,
      subtitle: 'POS / mağaza stoğunu kontrol edin.',
      href: '/dashboard/pos',
      cta: 'POS’a git',
      count: lowStockCount,
    });
  }
  if (pendingFreezes > 0) {
    alerts.push({
      id: 'freezes',
      severity: 'sky',
      title: `${pendingFreezes} bekleyen dondurma talebi`,
      subtitle: 'Onay veya red için üye profillerine bakın.',
      href: '/dashboard/members',
      cta: 'Üyeleri gör',
      count: pendingFreezes,
    });
  }
  if (pendingTrainerRequests > 0) {
    alerts.push({
      id: 'trainer-requests',
      severity: 'sky',
      title: `${pendingTrainerRequests} bekleyen antrenör talebi`,
      subtitle: 'PT atama / değişiklik talepleri bekliyor.',
      href: '/dashboard/trainer-requests',
      cta: 'Talepleri gör',
      count: pendingTrainerRequests,
    });
  }
  if (failedCheckouts > 0) {
    alerts.push({
      id: 'failed-checkout',
      severity: 'rose',
      title: `${failedCheckouts} başarısız online ödeme (24s)`,
      subtitle: 'Kartla ödeme denemeleri başarısız olmuş olabilir.',
      href: '/dashboard/settings',
      cta: 'Ödeme ayarları',
      count: failedCheckouts,
    });
  }

  return alerts;
}
