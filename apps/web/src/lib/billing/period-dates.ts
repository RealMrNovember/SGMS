/** HTML date input (YYYY-MM-DD) → local end-of-day for subscription/license expiry. */
export function parsePeriodEndInput(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return new Date(value);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

export function isPeriodStillValid(end: Date | null | undefined): boolean {
  if (!end) return true;
  return end.getTime() > Date.now();
}
