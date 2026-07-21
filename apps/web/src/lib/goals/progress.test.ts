import { describe, expect, it } from 'vitest';
import { computeGoalProgress, isValidMeasurementField } from './progress';

describe('computeGoalProgress', () => {
  it('WEIGHT_LOSS: ilerlemeyi başlangıç/hedef/şu anki kiloya göre hesaplar', () => {
    const result = computeGoalProgress(
      { targetType: 'WEIGHT_LOSS', targetValue: 5, startValue: 80, direction: null },
      77,
    );
    expect(result.currentValue).toBe(77);
    expect(result.progressPercent).toBe(60);
    expect(result.isAchieved).toBe(false);
  });

  it('WEIGHT_LOSS: hedefe ulaşılınca isAchieved true olur ve yüzde 100de clamplanır', () => {
    const result = computeGoalProgress(
      { targetType: 'WEIGHT_LOSS', targetValue: 5, startValue: 80, direction: null },
      74,
    );
    expect(result.progressPercent).toBe(100);
    expect(result.isAchieved).toBe(true);
  });

  it('WEIGHT_GAIN: yön her zaman INCREASE kabul edilir', () => {
    const result = computeGoalProgress(
      { targetType: 'WEIGHT_GAIN', targetValue: 4, startValue: 60, direction: null },
      62,
    );
    expect(result.progressPercent).toBe(50);
    expect(result.isAchieved).toBe(false);
  });

  it('BODY_FAT_REDUCTION: yön her zaman DECREASE kabul edilir', () => {
    const result = computeGoalProgress(
      { targetType: 'BODY_FAT_REDUCTION', targetValue: 4, startValue: 20, direction: null },
      18,
    );
    expect(result.progressPercent).toBe(50);
  });

  it('MEASUREMENT_CHANGE: direction alanına göre azaltma yönünde hesaplar', () => {
    const result = computeGoalProgress(
      { targetType: 'MEASUREMENT_CHANGE', targetValue: 10, startValue: 90, direction: 'DECREASE' },
      85,
    );
    expect(result.progressPercent).toBe(50);
  });

  it('MEASUREMENT_CHANGE: direction alanına göre büyütme yönünde hesaplar', () => {
    const result = computeGoalProgress(
      { targetType: 'MEASUREMENT_CHANGE', targetValue: 10, startValue: 30, direction: 'INCREASE' },
      35,
    );
    expect(result.progressPercent).toBe(50);
  });

  it('MEASUREMENT_CHANGE: direction eksikse hesaplanamaz (null)', () => {
    const result = computeGoalProgress(
      { targetType: 'MEASUREMENT_CHANGE', targetValue: 10, startValue: 90, direction: null },
      85,
    );
    expect(result.progressPercent).toBeNull();
    expect(result.isAchieved).toBe(false);
  });

  it('WORKOUT_FREQUENCY: haftalık antrenman sayısına göre hesaplar', () => {
    const result = computeGoalProgress(
      { targetType: 'WORKOUT_FREQUENCY', targetValue: 4, startValue: null, direction: null },
      3,
    );
    expect(result.progressPercent).toBe(75);
    expect(result.isAchieved).toBe(false);
  });

  it('WORKOUT_FREQUENCY: hedefe ulaşınca/geçince isAchieved true olur', () => {
    const result = computeGoalProgress(
      { targetType: 'WORKOUT_FREQUENCY', targetValue: 4, startValue: null, direction: null },
      5,
    );
    expect(result.isAchieved).toBe(true);
    expect(result.progressPercent).toBe(100);
  });

  it('CUSTOM: her zaman progressPercent null döner, currentValue geçirilir', () => {
    const result = computeGoalProgress({ targetType: 'CUSTOM', targetValue: null, startValue: null, direction: null }, 42);
    expect(result.progressPercent).toBeNull();
    expect(result.isAchieved).toBe(false);
    expect(result.currentValue).toBe(42);
  });

  it('currentValue null ise hesaplanamaz', () => {
    const result = computeGoalProgress(
      { targetType: 'WEIGHT_LOSS', targetValue: 5, startValue: 80, direction: null },
      null,
    );
    expect(result.progressPercent).toBeNull();
  });

  it('targetValue <= 0 ise hesaplanamaz (bölme hatasını önler)', () => {
    const result = computeGoalProgress(
      { targetType: 'WEIGHT_LOSS', targetValue: 0, startValue: 80, direction: null },
      77,
    );
    expect(result.progressPercent).toBeNull();
  });
});

describe('isValidMeasurementField', () => {
  it('bilinen ölçüm alanlarını kabul eder', () => {
    expect(isValidMeasurementField('waistCm')).toBe(true);
    expect(isValidMeasurementField('armCm')).toBe(true);
  });

  it('bilinmeyen alanları reddeder', () => {
    expect(isValidMeasurementField('weight')).toBe(false);
    expect(isValidMeasurementField('unknownField')).toBe(false);
  });
});
