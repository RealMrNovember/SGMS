import type { ProgramType } from '@sgms/database';
import { z } from 'zod';

const workoutExerciseSchema = z.object({
  name: z.string().min(1).max(120),
  sets: z.union([z.number().int().positive(), z.string().max(20)]).optional(),
  reps: z.union([z.number().int().positive(), z.string().max(20)]).optional(),
  rest: z.string().max(40).optional(),
  notes: z.string().max(500).optional(),
});

const workoutDaySchema = z.object({
  name: z.string().min(1).max(80),
  focus: z.string().max(120).optional(),
  exercises: z.array(workoutExerciseSchema).min(1),
});

const nutritionMealSchema = z.object({
  name: z.string().min(1).max(80),
  time: z.string().max(20).optional(),
  items: z.string().min(1).max(2000),
  calories: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const programContentSchema = z.object({
  version: z.literal(1).default(1),
  goal: z.string().max(2000).optional(),
  days: z.array(workoutDaySchema).optional(),
  meals: z.array(nutritionMealSchema).optional(),
});

export type ProgramContent = z.infer<typeof programContentSchema>;
export type WorkoutDay = z.infer<typeof workoutDaySchema>;
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;
export type NutritionMeal = z.infer<typeof nutritionMealSchema>;

export function emptyWorkoutDay(index = 0): WorkoutDay {
  const names = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  return {
    name: names[index] ?? `Gün ${index + 1}`,
    focus: '',
    exercises: [{ name: '', sets: 3, reps: 10, rest: '90 sn', notes: '' }],
  };
}

export function emptyNutritionMeal(index = 0): NutritionMeal {
  const names = ['Kahvaltı', 'Ara Öğün', 'Öğle Yemeği', 'İkindi', 'Akşam Yemeği', 'Gece'];
  return {
    name: names[index] ?? `Öğün ${index + 1}`,
    time: '',
    items: '',
    calories: undefined,
    notes: '',
  };
}

export function defaultProgramContent(type: ProgramType): ProgramContent {
  if (type === 'NUTRITION') {
    return { version: 1, goal: '', meals: [emptyNutritionMeal(0)] };
  }
  return { version: 1, goal: '', days: [emptyWorkoutDay(0)] };
}

function coerceExercise(raw: unknown): WorkoutExercise | null {
  if (typeof raw === 'string' && raw.trim()) {
    return { name: raw.trim() };
  }
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!name) {
    return null;
  }
  return {
    name,
    sets: typeof obj.sets === 'number' || typeof obj.sets === 'string' ? obj.sets : undefined,
    reps: typeof obj.reps === 'number' || typeof obj.reps === 'string' ? obj.reps : undefined,
    rest: typeof obj.rest === 'string' ? obj.rest : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
  };
}

/** DB / API JSON → normalized program content (legacy `{ notes }` and seed format supported). */
export function normalizeProgramContent(raw: unknown, type: ProgramType): ProgramContent {
  if (typeof raw !== 'object' || raw === null) {
    return defaultProgramContent(type);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.notes === 'string' && obj.notes.trim() && !obj.days && !obj.meals) {
    return { version: 1, goal: obj.notes.trim() };
  }

  const goal = typeof obj.goal === 'string' ? obj.goal : typeof obj.notes === 'string' ? obj.notes : '';

  if (Array.isArray(obj.days) && obj.days.length > 0) {
    const days: WorkoutDay[] = [];
    for (const dayRaw of obj.days) {
      if (typeof dayRaw !== 'object' || dayRaw === null) continue;
      const day = dayRaw as Record<string, unknown>;
      const name = typeof day.name === 'string' ? day.name.trim() : '';
      const exercises = Array.isArray(day.exercises)
        ? day.exercises.map(coerceExercise).filter((e): e is WorkoutExercise => e !== null)
        : [];
      if (name && exercises.length > 0) {
        days.push({
          name,
          focus: typeof day.focus === 'string' ? day.focus : undefined,
          exercises,
        });
      }
    }
    if (days.length > 0) {
      return { version: 1, goal: goal || undefined, days };
    }
  }

  if (Array.isArray(obj.meals) && obj.meals.length > 0) {
    const meals: NutritionMeal[] = [];
    for (const mealRaw of obj.meals) {
      if (typeof mealRaw !== 'object' || mealRaw === null) continue;
      const meal = mealRaw as Record<string, unknown>;
      const name = typeof meal.name === 'string' ? meal.name.trim() : '';
      const items = typeof meal.items === 'string' ? meal.items.trim() : '';
      if (name && items) {
        meals.push({
          name,
          time: typeof meal.time === 'string' ? meal.time : undefined,
          items,
          calories: typeof meal.calories === 'number' ? meal.calories : undefined,
          notes: typeof meal.notes === 'string' ? meal.notes : undefined,
        });
      }
    }
    if (meals.length > 0) {
      return { version: 1, goal: goal || undefined, meals };
    }
  }

  if (goal.trim()) {
    return { version: 1, goal: goal.trim() };
  }

  return defaultProgramContent(type);
}

export function parseProgramContentJson(raw: string | undefined, type: ProgramType): ProgramContent {
  if (!raw?.trim()) {
    return defaultProgramContent(type);
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeProgramContent(parsed, type);
  } catch {
    return { version: 1, goal: raw.trim() };
  }
}

export function validateProgramContent(content: ProgramContent, type: ProgramType): string | null {
  const hasGoal = Boolean(content.goal?.trim());

  if (type === 'WORKOUT') {
    const days = content.days ?? [];
    const hasExercises = days.some((d) => d.exercises.some((e) => e.name.trim()));
    if (!hasGoal && !hasExercises) {
      return 'En az bir gün ve egzersiz ekleyin veya program hedefi yazın.';
    }
    for (const day of days) {
      if (!day.name.trim()) return 'Her antrenman günü için bir ad girin.';
      for (const ex of day.exercises) {
        if (ex.name.trim() && !day.name.trim()) return 'Egzersiz için gün adı zorunludur.';
      }
    }
    return null;
  }

  const meals = content.meals ?? [];
  const hasMeals = meals.some((m) => m.name.trim() && m.items.trim());
  if (!hasGoal && !hasMeals) {
    return 'En az bir öğün ekleyin veya program hedefi yazın.';
  }
  for (const meal of meals) {
    if (meal.name.trim() && !meal.items.trim()) {
      return `"${meal.name}" öğünü için içerik girin.`;
    }
  }
  return null;
}

export function sanitizeProgramContent(content: ProgramContent, type: ProgramType): ProgramContent {
  const goal = content.goal?.trim() || undefined;

  if (type === 'WORKOUT') {
    const days = (content.days ?? [])
      .map((day) => ({
        name: day.name.trim(),
        focus: day.focus?.trim() || undefined,
        exercises: day.exercises
          .map((ex) => ({
            name: ex.name.trim(),
            sets: ex.sets === '' || ex.sets === undefined ? undefined : ex.sets,
            reps: ex.reps === '' || ex.reps === undefined ? undefined : ex.reps,
            rest: ex.rest?.trim() || undefined,
            notes: ex.notes?.trim() || undefined,
          }))
          .filter((ex) => ex.name),
      }))
      .filter((day) => day.name && day.exercises.length > 0);

    return { version: 1, goal, ...(days.length > 0 ? { days } : {}) };
  }

  const meals = (content.meals ?? [])
    .map((meal) => ({
      name: meal.name.trim(),
      time: meal.time?.trim() || undefined,
      items: meal.items.trim(),
      calories: meal.calories,
      notes: meal.notes?.trim() || undefined,
    }))
    .filter((meal) => meal.name && meal.items);

  return { version: 1, goal, ...(meals.length > 0 ? { meals } : {}) };
}

export function formatExercisePrescription(ex: WorkoutExercise): string {
  const parts: string[] = [];
  if (ex.sets !== undefined && ex.sets !== '' && ex.reps !== undefined && ex.reps !== '') {
    parts.push(`${ex.sets}×${ex.reps}`);
  } else {
    if (ex.sets !== undefined && ex.sets !== '') parts.push(String(ex.sets));
    if (ex.reps !== undefined && ex.reps !== '') parts.push(String(ex.reps));
  }
  if (ex.rest?.trim()) parts.push(ex.rest.trim());
  return parts.join(' · ');
}
