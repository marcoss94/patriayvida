import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "bejdqkbnqzhjcngjzxir.supabase.co",
      },
      {
        protocol: "https",
        hostname: "dxyhbdrkbquwoijigvuv.supabase.co",
      },
    ],
  },
};

export default nextConfig;
