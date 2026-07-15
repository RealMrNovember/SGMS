export type DailyVisitorPoint = { date: string; count: number };
export type HourPoint = { hour: number; count: number };
export type DayOfWeekPoint = { day: number; count: number };

export type CheckInBuckets = {
  dailyVisitors: DailyVisitorPoint[];
  busiestHours: HourPoint[];
  busiestDays: DayOfWeekPoint[];
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Bir zaman damgasını, salonun kendi saat diliminde (ör. Europe/Istanbul) güne, saate
 * ve haftanın gününe ayırır. "En yoğun saat 03:00" gibi anlamsız bir sonuç vermemesi için
 * UTC değil, salonun gerçek yerel saati kullanılır — `Intl.DateTimeFormat` ile, ek bir
 * paket gerektirmeden.
 */
function localParts(timestamp: Date, timeZone: string): { dateKey: string; hour: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(timestamp);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  // Bazı locale'lerde saat 24 olarak döner (gece yarısı) — 0'a normalize edilir.
  const hourRaw = Number(get('hour'));
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const weekday = WEEKDAY_INDEX[get('weekday')] ?? 0;

  return { dateKey: `${year}-${month}-${day}`, hour, day: weekday };
}

/** Zaman damgası listesini güne, saate ve haftanın gününe göre gruplar — en yoğun
 * saat/gün ve günlük ziyaretçi trendi raporları için saf (yan etkisiz) fonksiyon. */
export function bucketCheckIns(timestamps: Date[], timeZone = 'Europe/Istanbul'): CheckInBuckets {
  const byDate = new Map<string, number>();
  const byHour = new Array<number>(24).fill(0);
  const byDayOfWeek = new Array<number>(7).fill(0);

  for (const timestamp of timestamps) {
    const { dateKey, hour, day } = localParts(timestamp, timeZone);
    byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + 1);
    byHour[hour] += 1;
    byDayOfWeek[day] += 1;
  }

  const dailyVisitors = Array.from(byDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const busiestHours = byHour.map((count, hour) => ({ hour, count })).sort((a, b) => b.count - a.count);
  const busiestDays = byDayOfWeek.map((count, day) => ({ day, count })).sort((a, b) => b.count - a.count);

  return { dailyVisitors, busiestHours, busiestDays };
}
