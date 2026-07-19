export const receptionDesktopRelease = {
  version: '0.6.0',
  fileName: 'SGMS-Resepsiyon-Setup.exe',
  sizeLabel: '80 MB',
  platforms: 'Windows 10/11',
} as const;

/** Sabit link — /dl/desktop her zaman GitHub Releases'teki en güncel `v*` sürümüne yönlendirir. */
export function getReceptionDesktopDownloadUrl(): string {
  return '/dl/desktop';
}
