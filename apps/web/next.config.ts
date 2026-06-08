import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sgms/database', '@sgms/license-client'],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
