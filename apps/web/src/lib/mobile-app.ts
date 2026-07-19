export const mobileAthleteRelease = {
  version: '0.2.0',
  fileName: 'SGMS-Sporcu.apk',
  sizeLabel: '72 MB',
  platform: 'Android 8+',
} as const;

/** Sabit link — /dl/mobile her zaman GitHub Releases'teki en güncel `mobile-v*` sürümüne yönlendirir. */
export function getMobileAthleteDownloadUrl(): string {
  return '/dl/mobile';
}
