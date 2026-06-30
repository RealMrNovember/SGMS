import { intlLocaleFor } from '@/lib/format-locale';
import { getLocale, getTranslations } from 'next-intl/server';

type MeasurementRow = {
  id: string;
  measuredAt: Date;
  weight: { toString: () => string } | null;
  bodyFatPercentage: { toString: () => string } | null;
  muscleMass: { toString: () => string } | null;
  height: { toString: () => string } | null;
  notes: string | null;
};

function formatDecimal(value: { toString: () => string } | null | undefined) {
  return value != null ? value.toString() : '—';
}

export async function MemberHealthHistoryTable({
  measurements,
}: {
  measurements: MeasurementRow[];
}) {
  const t = await getTranslations('measurements');
  const locale = await getLocale();
  const dateLocale = intlLocaleFor(locale);

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-lg font-semibold">{t('historyTitle')}</h3>
        <p className="muted mt-1 text-sm">
          {t('historyCount', { count: measurements.length })}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-6 py-3 font-medium">{t('columns.date')}</th>
              <th className="px-6 py-3 font-medium">{t('columns.weight')}</th>
              <th className="px-6 py-3 font-medium">{t('columns.bodyFat')}</th>
              <th className="px-6 py-3 font-medium">{t('columns.muscle')}</th>
              <th className="px-6 py-3 font-medium">{t('columns.height')}</th>
              <th className="px-6 py-3 font-medium">{t('columns.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {measurements.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted px-6 py-8 text-center">
                  {t('historyEmpty')}
                </td>
              </tr>
            ) : (
              measurements.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-none">
                  <td className="px-6 py-4">{m.measuredAt.toLocaleString(dateLocale)}</td>
                  <td className="px-6 py-4">{formatDecimal(m.weight)}</td>
                  <td className="px-6 py-4">{formatDecimal(m.bodyFatPercentage)}</td>
                  <td className="px-6 py-4">{formatDecimal(m.muscleMass)}</td>
                  <td className="px-6 py-4">{formatDecimal(m.height)}</td>
                  <td className="muted px-6 py-4">{m.notes ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
