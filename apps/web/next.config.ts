import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@sgms/database', '@sgms/license-client'],
  experimental: {
    externalDir: true,
  },
};

export default withNextIntl(nextConfig);
