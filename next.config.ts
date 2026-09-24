import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Development seed photography (src/lib/media/picsum.ts). Picsum redirects
    // to its CDN; Next follows up to `maximumRedirects` (default 3).
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos", pathname: "/id/**" },
    ],
  },
};

export default nextConfig;
