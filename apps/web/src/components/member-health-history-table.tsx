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

export function MemberHealthHistoryTable({
  measurements,
}: {
  measurements: MeasurementRow[];
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-lg font-semibold">Sağlık Ölçüm Geçmişi</h3>
        <p className="muted mt-1 text-sm">
          {measurements.length} kayıt · en güncel üstte
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="muted border-b border-[var(--border)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-6 py-3 font-medium">Tarih</th>
              <th className="px-6 py-3 font-medium">Kilo (kg)</th>
              <th className="px-6 py-3 font-medium">Yağ %</th>
              <th className="px-6 py-3 font-medium">Kas (kg)</th>
              <th className="px-6 py-3 font-medium">Boy (cm)</th>
              <th className="px-6 py-3 font-medium">Not</th>
            </tr>
          </thead>
          <tbody>
            {measurements.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted px-6 py-8 text-center">
                  Henüz ölçüm kaydı yok. Yukarıdaki formdan ilk ölçümü ekleyin.
                </td>
              </tr>
            ) : (
              measurements.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border)] last:border-none">
                  <td className="px-6 py-4">{m.measuredAt.toLocaleString('tr-TR')}</td>
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
