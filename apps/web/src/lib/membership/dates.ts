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
