import type { PtCommissionModel } from '@sgms/database';

export type CommissionInput = {
  model: PtCommissionModel;
  /** FIXED_PER_SESSION için TRY tutar, PERCENTAGE_OF_REVENUE/TIERED için yüzde (0-100). */
  baseRate: number;
  revenueAmount: number;
  /** TIERED modelinde ayın o ana kadarki tamamlanmış seans sayısı — kademe eşiği için. */
  sessionCountThisMonth?: number;
};

/**
 * Bir tamamlanmış PT seansı için hak edilen komisyon/prim tutarını hesaplar.
 *
 * TIERED model v1: ayda 20. seansa kadar temel oran, 20. seanstan sonra +%5 —
 * gerçek hayatta salonların yaygın kullandığı "performans arttıkça daha yüksek pay"
 * mantığının basitleştirilmiş ilk sürümü. Daha esnek çok kademeli yapı ileride eklenebilir.
 */
export function calculateSessionCommission(input: CommissionInput): number {
  const { model, baseRate, revenueAmount, sessionCountThisMonth = 0 } = input;

  if (model === 'FIXED_PER_SESSION') {
    return round2(baseRate);
  }

  if (model === 'PERCENTAGE_OF_REVENUE') {
    return round2((revenueAmount * baseRate) / 100);
  }

  // TIERED
  const tierBonus = sessionCountThisMonth >= 20 ? 5 : 0;
  const effectiveRate = Math.min(baseRate + tierBonus, 100);
  return round2((revenueAmount * effectiveRate) / 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
