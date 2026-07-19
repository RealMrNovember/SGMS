export const receptionDesktopRelease = {
  version: '0.6.0',
  fileName: 'SGMS-Resepsiyon-0.6.0-Setup.exe',
  sizeLabel: '80 MB',
  platforms: 'Windows 10/11',
  repoOwner: 'RealMrNovember',
  repoName: 'SGMS',
} as const;

export function getReceptionDesktopDownloadUrl(): string {
  const { repoOwner, repoName, version, fileName } = receptionDesktopRelease;
  return `https://github.com/${repoOwner}/${repoName}/releases/download/v${version}/${fileName}`;
}
