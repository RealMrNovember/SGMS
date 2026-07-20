import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DATA_DIR = join(__dirname, 'seed-data', 'geo');

type SeedCountry = {
  isoCode: string;
  callingCode: string | null;
  hasDistricts: boolean;
  names: Record<string, string>;
};

type SeedCityRow = [name: string, asciiName: string, countryCode: string, population: number];

type SeedTrProvince = {
  name: string;
  plaka: number;
  population: number;
  districts: string[];
};

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}

const TR_ASCII_MAP: Record<string, string> = {
  ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', I: 'I', İ: 'I', ö: 'o', Ö: 'O',
  ş: 's', Ş: 'S', ü: 'u', Ü: 'U',
};

function toAsciiTr(name: string): string {
  return name.replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TR_ASCII_MAP[ch] ?? ch);
}

async function seedCountries(countries: SeedCountry[]) {
  const idByIso = new Map<string, string>();

  const rows = countries.map((c) => {
    const id = randomUUID();
    idByIso.set(c.isoCode, id);
    return {
      id,
      isoCode: c.isoCode,
      callingCode: c.callingCode,
      hasDistricts: c.hasDistricts,
    };
  });

  await prisma.country.createMany({ data: rows, skipDuplicates: true });
  console.log(`✔ ${rows.length} ülke eklendi`);

  const translationRows = countries.flatMap((c) =>
    Object.entries(c.names).map(([locale, name]) => ({
      id: randomUUID(),
      countryId: idByIso.get(c.isoCode)!,
      locale,
      name,
    })),
  );
  await prisma.countryTranslation.createMany({ data: translationRows, skipDuplicates: true });
  console.log(`✔ ${translationRows.length} ülke çevirisi eklendi`);

  return idByIso;
}

async function createManyInChunks<T>(
  label: string,
  rows: T[],
  chunkSize: number,
  insert: (chunk: T[]) => Promise<unknown>,
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await insert(chunk);
  }
  console.log(`✔ ${rows.length} ${label} eklendi`);
}

async function seedGlobalCities(cityRows: SeedCityRow[], idByIso: Map<string, string>) {
  const rows = cityRows
    .map(([name, asciiName, countryCode, population]) => {
      const countryId = idByIso.get(countryCode);
      if (!countryId) return null;
      return { id: randomUUID(), countryId, name, asciiName, population };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  await createManyInChunks('şehir (küresel)', rows, 5000, (chunk) =>
    prisma.city.createMany({ data: chunk, skipDuplicates: true }),
  );
}

async function seedTurkey(provinces: SeedTrProvince[], idByIso: Map<string, string>) {
  const countryId = idByIso.get('TR');
  if (!countryId) throw new Error('Türkiye (TR) ülke kaydı bulunamadı — önce seedCountries çalışmalı.');

  const cityRows = provinces.map((p) => ({
    id: randomUUID(),
    countryId,
    name: p.name,
    asciiName: toAsciiTr(p.name),
    population: p.population,
  }));
  await prisma.city.createMany({ data: cityRows, skipDuplicates: true });
  console.log(`✔ ${cityRows.length} il eklendi`);

  const districtRows = provinces.flatMap((p, idx) =>
    p.districts.map((name) => ({
      id: randomUUID(),
      cityId: cityRows[idx]!.id,
      name,
    })),
  );
  await prisma.district.createMany({ data: districtRows, skipDuplicates: true });
  console.log(`✔ ${districtRows.length} ilçe eklendi`);
}

async function main() {
  const existing = await prisma.country.count();
  if (existing > 0) {
    console.log(`Zaten ${existing} ülke kayıtlı — geo:seed atlanıyor (idempotent, tekrar çalıştırmak için countries tablosunu boşaltın).`);
    return;
  }

  const countries = readJson<SeedCountry[]>('countries.json');
  const cities = readJson<SeedCityRow[]>('cities.json');
  const trProvinces = readJson<SeedTrProvince[]>('tr-provinces.json');

  const idByIso = await seedCountries(countries);
  await seedTurkey(trProvinces, idByIso);
  await seedGlobalCities(cities, idByIso);

  console.log('Faz 6.4 lokasyon veritabanı seed tamamlandı.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
