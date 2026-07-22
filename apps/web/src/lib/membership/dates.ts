/**
 * Üyelik yenileme / süre uzatma tarih hesapları (Faz 36.1).
 *
 * - Süre hâlâ geçerliyse: yeni paket mevcut bitişin üzerine eklenir (stack).
 * - Süre dolmuşsa veya yoksa: bugünden başlar.
 * - Mevcut `addGymMember` ile aynı: base + durationDays.
 */

export type MembershipPeriodInput = {
  currentEndsAt: Date | null | undefined;
  durationDays: number;
  now?: Date;
};

export type MembershipPeriodResult = {
  /** Yeni dönem başlangıcı — stack ise mevcut startsAt korunmalı (null döner). */
  periodStartsAt: Date | null;
  membershipEndsAt: Date;
  /** true: mevcut bitişe eklendi; false: bugünden yeni dönem */
  stacked: boolean;
  baseDate: Date;
};

function addDays(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function computeRenewalPeriod(input: MembershipPeriodInput): MembershipPeriodResult {
  const now = input.now ?? new Date();
  const durationDays = Math.max(1, Math.floor(input.durationDays));
  const currentEnds = input.currentEndsAt ? new Date(input.currentEndsAt) : null;
  const stillActive = Boolean(currentEnds && currentEnds.getTime() > now.getTime());

  const baseDate = stillActive ? currentEnds! : now;
  const membershipEndsAt = addDays(baseDate, durationDays);

  return {
    periodStartsAt: stillActive ? null : now,
    membershipEndsAt,
    stacked: stillActive,
    baseDate,
  };
}

export function computeManualExtension(input: {
  currentEndsAt: Date | null | undefined;
  extraDays: number;
  now?: Date;
}): { membershipEndsAt: Date; stacked: boolean; baseDate: Date } {
  const now = input.now ?? new Date();
  const extraDays = Math.max(1, Math.floor(input.extraDays));
  const currentEnds = input.currentEndsAt ? new Date(input.currentEndsAt) : null;
  const stillActive = Boolean(currentEnds && currentEnds.getTime() > now.getTime());
  const baseDate = stillActive ? currentEnds! : now;
  return {
    membershipEndsAt: addDays(baseDate, extraDays),
    stacked: stillActive,
    baseDate,
  };
}

/** Oranlı iade önerisi: plan fiyatı × (kalan gün / paket süresi). */
export function suggestCancelRefund(params: {
  planPrice: number | null;
  durationDays: number | null;
  membershipEndsAt: Date | null;
  now?: Date;
}): number {
  const { planPrice, durationDays, membershipEndsAt, now = new Date() } = params;
  if (planPrice == null || !durationDays || durationDays <= 0 || !membershipEndsAt) {
    return 0;
  }
  if (membershipEndsAt.getTime() <= now.getTime()) {
    return 0;
  }
  const remaining = Math.ceil((membershipEndsAt.getTime() - now.getTime()) / 86_400_000);
  if (remaining <= 0) {
    return 0;
  }
  return Math.round(planPrice * (Math.min(remaining, durationDays) / durationDays) * 100) / 100;
}
