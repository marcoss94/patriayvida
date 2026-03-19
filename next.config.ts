import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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
