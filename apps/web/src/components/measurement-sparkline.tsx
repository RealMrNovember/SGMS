'use client';

type SparklinePoint = { at: string; value: number };

export function MeasurementSparkline({
  label,
  points,
  unit = '',
}: {
  label: string;
  points: SparklinePoint[];
  unit?: string;
}) {
  const series = points.slice(-6);

  if (series.length === 0) {
    return null;
  }

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 200;
  const height = 48;
  const padding = 4;

  const coords = series.map((point, index) => {
    const x =
      series.length === 1
        ? width / 2
        : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
    return { x, y, point };
  });

  const polyline = coords.map(({ x, y }) => `${x},${y}`).join(' ');

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="muted text-xs">
          {min.toFixed(1)}–{max.toFixed(1)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-12 w-full text-emerald-400"
        role="img"
        aria-label={label}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {coords.map(({ x, y, point }) => (
          <circle key={point.at} cx={x} cy={y} r="2.5" fill="currentColor" />
        ))}
      </svg>
    </div>
  );
}
