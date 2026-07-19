import appConfig from '../../app.json';
import type { UpdateInfo } from './types';

const REPO_OWNER = 'RealMrNovember';
const REPO_NAME = 'SGMS';
const TAG_PREFIX = 'mobile-v';

const CURRENT_VERSION: string = appConfig.expo.version;

type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  body: string | null;
  assets: Array<{ name: string; browser_download_url: string }>;
};

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewer(remote: string, local: string): boolean {
  const [rMajor, rMinor, rPatch] = parseVersion(remote);
  const [lMajor, lMinor, lPatch] = parseVersion(local);
  if (rMajor !== lMajor) return rMajor > lMajor;
  if (rMinor !== lMinor) return rMinor > lMinor;
  return rPatch > lPatch;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=20`,
    );
    if (!res.ok) return null;
    const releases = (await res.json()) as GithubRelease[];

    const mobileReleases = releases
      .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(TAG_PREFIX))
      .map((r) => ({
        version: r.tag_name.slice(TAG_PREFIX.length),
        apkAsset: r.assets.find((a) => a.name.endsWith('.apk')),
        notes: r.body ?? undefined,
      }))
      .filter((r) => r.apkAsset);

    if (mobileReleases.length === 0) return null;

    mobileReleases.sort((a, b) => (isNewer(a.version, b.version) ? 1 : -1));
    const latest = mobileReleases[mobileReleases.length - 1]!;

    if (!isNewer(latest.version, CURRENT_VERSION)) {
      return { available: false, version: CURRENT_VERSION, downloadUrl: '' };
    }

    return {
      available: true,
      version: latest.version,
      downloadUrl: latest.apkAsset!.browser_download_url,
      notes: latest.notes,
    };
  } catch {
    return null;
  }
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}
