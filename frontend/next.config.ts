import type { NextConfig } from "next";
import packageJson from './package.json';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb', // Melonggarkan batas upload menjadi 50 Megabytes
    },
  },
};

export default nextConfig;