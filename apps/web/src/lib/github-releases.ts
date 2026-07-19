const REPO_OWNER = 'RealMrNovember';
const REPO_NAME = 'SGMS';

type GithubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{ name: string; browser_download_url: string }>;
};

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseVersion(a);
  const [bMajor, bMinor, bPatch] = parseVersion(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

async function fetchReleases(): Promise<GithubRelease[] | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return null;
  return (await res.json()) as GithubRelease[];
}

function latestMatching(releases: GithubRelease[], tagPrefix: string, assetSuffix: string) {
  const candidates = releases
    .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(tagPrefix))
    .map((r) => ({
      version: r.tag_name.slice(tagPrefix.length),
      asset: r.assets.find((a) => a.name.endsWith(assetSuffix)),
    }))
    .filter((r): r is { version: string; asset: NonNullable<typeof r.asset> } => r.asset !== undefined);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => compareVersions(a.version, b.version));
  return candidates[candidates.length - 1]!;
}

/**
 * Bu repo'da masaüstü (v*) ve mobil (mobile-v*) release'leri aynı GitHub deposunu paylaşıyor,
 * bu yüzden GitHub'ın tekil "latest release" bayrağı iki uygulama arasında güvenilir şekilde
 * ayrıştırılamıyor — bunun yerine tüm release'ler çekilip etiket önekine göre filtrelenip en
 * yüksek sürüm elle seçiliyor.
 */
export async function resolveLatestReleaseAsset(
  tagPrefix: string,
  assetSuffix: string,
): Promise<string | null> {
  const releases = await fetchReleases();
  if (!releases) return null;
  return latestMatching(releases, tagPrefix, assetSuffix)?.asset.browser_download_url ?? null;
}

/** Gösterim amaçlı: en güncel yayınlanan sürüm numarasını döndürür (indirme linkinden bağımsız). */
export async function resolveLatestReleaseVersion(
  tagPrefix: string,
  assetSuffix: string,
): Promise<string | null> {
  const releases = await fetchReleases();
  if (!releases) return null;
  return latestMatching(releases, tagPrefix, assetSuffix)?.version ?? null;
}
