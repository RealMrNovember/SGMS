import { resolveLatestReleaseAsset } from '@/lib/github-releases';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = await resolveLatestReleaseAsset('v', '.exe');
  if (!url) {
    return NextResponse.redirect('https://github.com/RealMrNovember/SGMS/releases');
  }
  return NextResponse.redirect(url);
}
