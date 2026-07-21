'use server';

import { isAthleteContext, resolveApiContext } from '@/lib/api/auth-context';
import { prisma } from '@/lib/prisma';
import { getTenantWriteBlockReason } from '@/lib/tenant-access';
import type { MealType } from '@sgms/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
const MAX_CALORIES = 20000;

export type NutritionActionState = { error?: string; success?: string };

const foodLogSchema = z.object({
  mealType: z.enum(MEAL_TYPES),
  foodName: z.string().trim().min(1).max(120),
  loggedAt: z.string().optional().or(z.literal('')),
  calories: z.string().optional().or(z.literal('')),
  proteinG: z.string().optional().or(z.literal('')),
  carbsG: z.string().optional().or(z.literal('')),
  fatG: z.string().optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

function parseOptionalNumber(value: string | undefined): number | null | 'invalid' {
  if (!value) return null;
  const num = Number(value.replace(',', '.'));
  return Number.isFinite(num) && num >= 0 ? num : 'invalid';
}

/**
 * Sporcu kendi öğününü kaydeder — roadmap.md Faz 41'e göre bu **yalnızca sporcunun
 * kendisi** yapabilir (PT/salon tarafı salt-okunur, bkz. `lib/nutrition/list.ts`).
 * Web sporcu portalı ve mobil `/api/v1/nutrition` POST aynı fonksiyonu kullanır
 * (`request` verilirse Bearer token da kabul edilir, bkz. `actions/goals.ts`).
 */
export async function createFoodLogEntry(
  _prevState: NutritionActionState,
  formData: FormData,
  request?: Request,
): Promise<NutritionActionState> {
  const result = await resolveApiContext(request);
  if ('response' in result || !isAthleteContext(result.context)) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }
  const { organizationId, gymMemberId, userId } = result.context;

  const writeBlock = await getTenantWriteBlockReason(organizationId);
  if (writeBlock) {
    return { error: writeBlock };
  }

  const parsed = foodLogSchema.safeParse({
    mealType: formData.get('mealType'),
    foodName: formData.get('foodName'),
    loggedAt: formData.get('loggedAt') ?? '',
    calories: formData.get('calories') ?? '',
    proteinG: formData.get('proteinG') ?? '',
    carbsG: formData.get('carbsG') ?? '',
    fatG: formData.get('fatG') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Lütfen form alanlarını kontrol edin.' };
  }

  const calories = parseOptionalNumber(parsed.data.calories);
  const proteinG = parseOptionalNumber(parsed.data.proteinG);
  const carbsG = parseOptionalNumber(parsed.data.carbsG);
  const fatG = parseOptionalNumber(parsed.data.fatG);

  if (calories === 'invalid' || proteinG === 'invalid' || carbsG === 'invalid' || fatG === 'invalid') {
    return { error: 'Kalori/makro değerleri geçerli, sıfır veya üzeri sayılar olmalı.' };
  }
  if (calories !== null && calories > MAX_CALORIES) {
    return { error: 'Kalori değeri gerçekçi bir aralıkta olmalı.' };
  }

  let loggedAt = new Date();
  if (parsed.data.loggedAt) {
    const candidate = new Date(parsed.data.loggedAt);
    if (Number.isNaN(candidate.getTime())) {
      return { error: 'Geçersiz tarih/saat.' };
    }
    loggedAt = candidate;
  }

  await prisma.foodLogEntry.create({
    data: {
      organizationId,
      gymMemberId,
      loggedAt,
      mealType: parsed.data.mealType as MealType,
      foodName: parsed.data.foodName,
      calories: calories !== null ? Math.round(calories) : null,
      proteinG,
      carbsG,
      fatG,
      notes: parsed.data.notes || null,
      createdById: userId,
    },
  });

  revalidatePath('/athlete/nutrition');
  revalidatePath('/athlete');
  return { success: 'Öğün kaydedildi.' };
}

/** Sporcu kendi kaydını siler (yanlış girilen bir öğünü düzeltmek için). */
export async function deleteFoodLogEntry(entryId: string, request?: Request): Promise<NutritionActionState> {
  const result = await resolveApiContext(request);
  if ('response' in result || !isAthleteContext(result.context)) {
    return { error: 'Bu işlem için sporcu oturumu gerekir.' };
  }
  const { organizationId, gymMemberId } = result.context;

  const entry = await prisma.foodLogEntry.findFirst({
    where: { id: entryId, organizationId, gymMemberId },
  });
  if (!entry) {
    return { error: 'Kayıt bulunamadı.' };
  }

  await prisma.foodLogEntry.delete({ where: { id: entry.id } });

  revalidatePath('/athlete/nutrition');
  revalidatePath('/athlete');
  return { success: 'Kayıt silindi.' };
}
