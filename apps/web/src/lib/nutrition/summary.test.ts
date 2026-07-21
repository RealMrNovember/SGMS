import { describe, expect, it } from 'vitest';
import { groupFoodLogEntriesByDay, sumPlannedCaloriesFromProgramContent, type FoodLogEntryLike } from './summary';

function entry(overrides: Partial<FoodLogEntryLike>): FoodLogEntryLike {
  return {
    id: 'entry-1',
    loggedAt: new Date('2026-07-20T12:00:00Z'),
    mealType: 'LUNCH',
    foodName: 'Tavuk göğsü',
    calories: 300,
    proteinG: 30,
    carbsG: 10,
    fatG: 8,
    notes: null,
    photoUrl: null,
    ...overrides,
  };
}

describe('groupFoodLogEntriesByDay', () => {
  it('boş listede boş dizi döner', () => {
    expect(groupFoodLogEntriesByDay([])).toEqual([]);
  });

  it('aynı güne ait kayıtları tek bir gün özetinde toplar', () => {
    const entries = [
      entry({ id: '1', loggedAt: new Date('2026-07-20T08:00:00Z'), calories: 200, mealType: 'BREAKFAST' }),
      entry({ id: '2', loggedAt: new Date('2026-07-20T12:00:00Z'), calories: 500, mealType: 'LUNCH' }),
    ];

    const days = groupFoodLogEntriesByDay(entries, 'UTC');

    expect(days).toHaveLength(1);
    expect(days[0].dateKey).toBe('2026-07-20');
    expect(days[0].totalCalories).toBe(700);
    expect(days[0].entryCount).toBe(2);
    expect(days[0].entries).toHaveLength(2);
  });

  it('farklı günleri ayrı gruplar ve en yeni gün önce gelir', () => {
    const entries = [
      entry({ id: '1', loggedAt: new Date('2026-07-18T08:00:00Z') }),
      entry({ id: '2', loggedAt: new Date('2026-07-20T08:00:00Z') }),
      entry({ id: '3', loggedAt: new Date('2026-07-19T08:00:00Z') }),
    ];

    const days = groupFoodLogEntriesByDay(entries, 'UTC');

    expect(days.map((d) => d.dateKey)).toEqual(['2026-07-20', '2026-07-19', '2026-07-18']);
  });

  it('opsiyonel makro alanları null olduğunda toplamı 0 olarak sayar', () => {
    const entries = [
      entry({ id: '1', calories: null, proteinG: null, carbsG: null, fatG: null }),
      entry({ id: '2', calories: 400, proteinG: 20, carbsG: 40, fatG: 10 }),
    ];

    const days = groupFoodLogEntriesByDay(entries, 'UTC');

    expect(days[0].totalCalories).toBe(400);
    expect(days[0].totalProteinG).toBe(20);
    expect(days[0].totalCarbsG).toBe(40);
    expect(days[0].totalFatG).toBe(10);
  });

  it('gece yarısını geçen zaman damgalarını salonun saat dilimine göre doğru güne atar', () => {
    // 2026-07-20 02:00 Europe/Istanbul (+03) = 2026-07-19 23:00 UTC
    const entries = [entry({ id: '1', loggedAt: new Date('2026-07-19T23:00:00Z') })];

    const daysIstanbul = groupFoodLogEntriesByDay(entries, 'Europe/Istanbul');
    const daysUtc = groupFoodLogEntriesByDay(entries, 'UTC');

    expect(daysIstanbul[0].dateKey).toBe('2026-07-20');
    expect(daysUtc[0].dateKey).toBe('2026-07-19');
  });
});

describe('sumPlannedCaloriesFromProgramContent', () => {
  it('geçersiz veya boş içerikte null döner', () => {
    expect(sumPlannedCaloriesFromProgramContent(null)).toBeNull();
    expect(sumPlannedCaloriesFromProgramContent(undefined)).toBeNull();
    expect(sumPlannedCaloriesFromProgramContent('string')).toBeNull();
    expect(sumPlannedCaloriesFromProgramContent({})).toBeNull();
    expect(sumPlannedCaloriesFromProgramContent({ meals: [] })).toBeNull();
  });

  it('hiçbir öğünde kalori girilmemişse null döner', () => {
    const content = { meals: [{ name: 'Kahvaltı', items: 'Yumurta' }] };
    expect(sumPlannedCaloriesFromProgramContent(content)).toBeNull();
  });

  it('öğünlerdeki kalorileri toplar, kalorisi olmayanları atlar', () => {
    const content = {
      meals: [
        { name: 'Kahvaltı', items: 'Yumurta', calories: 300 },
        { name: 'Ara Öğün', items: 'Meyve' },
        { name: 'Öğle', items: 'Tavuk', calories: 500 },
      ],
    };
    expect(sumPlannedCaloriesFromProgramContent(content)).toBe(800);
  });
});
