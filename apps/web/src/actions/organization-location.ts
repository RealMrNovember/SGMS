'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function requireOrgAdmin() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    throw new Error('Aktif salon oturumu gerekir.');
  }
  if (!session.user.role || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    throw new Error('Bu ayar için OWNER veya ADMIN yetkisi gerekir.');
  }
  return session;
}

export async function fetchOrganizationLocation() {
  const session = await requireOrgAdmin();
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId! },
    select: {
      locationCountry: { select: { isoCode: true, translations: { where: { locale: session.user.locale ?? 'tr' } } } },
      locationCity: { select: { id: true, name: true } },
      locationDistrict: { select: { id: true, name: true } },
    },
  });

  return {
    countryCode: org?.locationCountry?.isoCode ?? '',
    countryLabel: org?.locationCountry?.translations[0]?.name ?? org?.locationCountry?.isoCode ?? '',
    cityId: org?.locationCity?.id ?? '',
    cityLabel: org?.locationCity?.name ?? '',
    districtId: org?.locationDistrict?.id ?? '',
    districtLabel: org?.locationDistrict?.name ?? '',
  };
}

export type OrganizationLocationState = {
  error?: string;
  success?: string;
};

const schema = z.object({
  locationCountryCode: z.string().length(2).optional().or(z.literal('')),
  locationCityId: z.string().optional().or(z.literal('')),
  locationDistrictId: z.string().optional().or(z.literal('')),
});

/**
 * Faz 6.4 — organizasyonun yapılandırılmış lokasyonu. Mevcut serbest-metin
 * `Organization.country`/`city` alanlarına da eşzamanlı yazılır (geriye dönük
 * uyumluluk — bu alanları okuyan mevcut ekranlar kırılmaz).
 */
export async function updateOrganizationLocation(
  _prev: OrganizationLocationState,
  formData: FormData,
): Promise<OrganizationLocationState> {
  const parsed = schema.safeParse({
    locationCountryCode: formData.get('locationCountryCode') ?? '',
    locationCityId: formData.get('locationCityId') ?? '',
    locationDistrictId: formData.get('locationDistrictId') ?? '',
  });

  if (!parsed.success) {
    return { error: 'Geçersiz lokasyon seçimi.' };
  }

  try {
    const session = await requireOrgAdmin();
    const organizationId = session.user.organizationId!;
    const { locationCountryCode, locationCityId, locationDistrictId } = parsed.data;

    const country = locationCountryCode
      ? await prisma.country.findUnique({ where: { isoCode: locationCountryCode } })
      : null;
    const city = locationCityId ? await prisma.city.findFirst({ where: { id: locationCityId } }) : null;
    const district = locationDistrictId
      ? await prisma.district.findFirst({ where: { id: locationDistrictId } })
      : null;

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        locationCountryId: country?.id ?? null,
        locationCityId: city?.id ?? null,
        locationDistrictId: district?.id ?? null,
        ...(country ? { country: country.isoCode } : {}),
        ...(city ? { city: city.name } : {}),
      },
    });

    revalidatePath('/dashboard/settings');
    return { success: 'Lokasyon bilgisi kaydedildi.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Kaydedilemedi.' };
  }
}
