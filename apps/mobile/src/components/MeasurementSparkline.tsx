import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { colors, typography } from '../lib/theme';

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
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.range}>
          {min.toFixed(1)}–{max.toFixed(1)}
          {unit ? ` ${unit}` : ''}
        </Text>
      </View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={polyline}
          fill="none"
          stroke={colors.gold}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map(({ x, y, point }) => (
          <Circle key={point.at} cx={x} cy={y} r={2.5} fill={colors.gold} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { ...typography.caption, color: colors.text, fontWeight: '600' },
  range: { ...typography.caption, color: colors.faint, fontSize: 11 },
});
