export const mobileAthleteRelease = {
  version: '0.2.0',
  fileName: 'SGMS-Sporcu-0.2.0.apk',
  sizeLabel: '72 MB',
  platform: 'Android 8+',
  repoOwner: 'RealMrNovember',
  repoName: 'SGMS',
  tag: 'mobile-v0.2.0',
} as const;

export function getMobileAthleteDownloadUrl(): string {
  const { repoOwner, repoName, tag, fileName } = mobileAthleteRelease;
  return `https://github.com/${repoOwner}/${repoName}/releases/download/${tag}/${fileName}`;
}
