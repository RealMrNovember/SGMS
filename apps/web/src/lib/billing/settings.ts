import { randomUUID } from 'crypto';
import { parseOrganizationSettings, type OrganizationSettings } from '@/lib/admin/org-settings';

export type BillingRequestStatus = 'pending' | 'approved' | 'rejected' | 'paid_online';

export type BillingRequest = {
  id: string;
  planId: string;
  planCode: string;
  planName: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  status: BillingRequestStatus;
  notes?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type BillingSettings = OrganizationSettings & {
  billingRequests?: BillingRequest[];
};

export function parseBillingSettings(raw: unknown): BillingSettings {
  return parseOrganizationSettings(raw) as BillingSettings;
}

export function appendBillingRequest(
  settings: BillingSettings,
  request: Omit<BillingRequest, 'id' | 'createdAt' | 'status'>,
): BillingSettings {
  const existing = settings.billingRequests ?? [];
  return {
    ...settings,
    billingRequests: [
      {
        // Tire (-) kasıtlı olarak yok: bu id aynı zamanda GatewayCheckoutSession.id ve
        // PayTR'a giden orderId olarak kullanılıyor. `initiatePaytrCheckout` PayTR'a
        // göndermeden önce merchant_oid'den alfanümerik olmayan karakterleri (tire dahil)
        // siliyor — id baştan tiresiz üretilmezse PayTR'ın webhook'ta geri gönderdiği
        // merchant_oid, DB'de tireli saklanan id ile hiçbir zaman eşleşmiyordu ve
        // ödemesi başarılı PayTR checkout'ları abonelik aktivasyonunu hiç tetiklemiyordu.
        id: randomUUID().replace(/-/g, ''),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        ...request,
      },
      ...existing,
    ].slice(0, 20),
  };
}

export function updateBillingRequestStatus(
  settings: BillingSettings,
  requestId: string,
  status: BillingRequestStatus,
  resolvedBy: string,
): BillingSettings {
  const requests = (settings.billingRequests ?? []).map((item) =>
    item.id === requestId
      ? {
          ...item,
          status,
          resolvedAt: new Date().toISOString(),
          resolvedBy,
        }
      : item,
  );
  return { ...settings, billingRequests: requests };
}

export function getPendingBillingRequest(settings: BillingSettings): BillingRequest | null {
  return (settings.billingRequests ?? []).find((r) => r.status === 'pending') ?? null;
}
