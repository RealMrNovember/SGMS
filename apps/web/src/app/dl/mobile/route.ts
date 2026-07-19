import { resolveLatestReleaseAsset } from '@/lib/github-releases';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = await resolveLatestReleaseAsset('mobile-v', '.apk');
  if (!url) {
    return NextResponse.redirect('https://github.com/RealMrNovember/SGMS/releases');
  }
  return NextResponse.redirect(url);
}
