export const receptionDesktopRelease = {
  version: '0.4.0',
  fileName: 'SGMS-Resepsiyon-0.4.0-Setup.exe',
  sizeLabel: '79 MB',
  platforms: 'Windows 10/11',
  repoOwner: 'RealMrNovember',
  repoName: 'SGMS',
  repoPath: 'releases/sgms-reception/v0.4.0/SGMS-Resepsiyon-0.4.0-Setup.exe',
} as const;

export function getReceptionDesktopDownloadUrl(): string {
  const { repoOwner, repoName, repoPath } = receptionDesktopRelease;
  return `https://github.com/${repoOwner}/${repoName}/raw/main/${repoPath}`;
}
