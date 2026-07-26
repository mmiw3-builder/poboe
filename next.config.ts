import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.irys.xyz", pathname: "/**" },
      { protocol: "https", hostname: "devnet.irys.xyz", pathname: "/**" },
    ],
  },
};

export default nextConfig;
