export const mobileAthleteRelease = {
  version: '0.4.3',
  fileName: 'SGMS-Sporcu.apk',
  sizeLabel: '~60 MB',
  platform: 'Android 8+',
  packageId: 'com.cicibyte.sgms.athlete',
} as const;

/** Sabit link — /dl/mobile her zaman GitHub Releases'teki en güncel `mobile-v*` sürümüne yönlendirir. */
export function getMobileAthleteDownloadUrl(): string {
  return '/dl/mobile';
}

/** Google Play listing (kapalı testte yalnızca test kullanıcılarına açılır). */
export function getMobilePlayStoreUrl(): string {
  return `https://play.google.com/store/apps/details?id=${mobileAthleteRelease.packageId}`;
}
