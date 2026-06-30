import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function buildAvatarRemotePatterns() {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    return [];
  }
  try {
    const url = new URL(base);
    return [
      {
        protocol: url.protocol.replace(':', '') as 'https' | 'http',
        hostname: url.hostname,
        pathname: '/**',
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ['@sgms/database', '@sgms/license-client'],
  images: {
    remotePatterns: buildAvatarRemotePatterns(),
  },
  experimental: {
    externalDir: true,
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  async headers() {
    return [
      {
        source: '/login',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
