import type { NextConfig } from "next";

/**
 * Catalog images live in the public `product-media` Supabase Storage bucket
 * (src/lib/media/storage.ts). Next loads .env files before this config, so the
 * project host comes from NEXT_PUBLIC_SUPABASE_URL.
 */
function supabaseStoragePattern(): URL[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  return [new URL("/storage/v1/object/public/product-media/**", url)];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...supabaseStoragePattern(),
      // Hero and "how it works" stand-in photography (src/lib/media/picsum.ts).
      // Picsum redirects to its CDN; Next follows up to `maximumRedirects` (default 3).
      { protocol: "https", hostname: "picsum.photos", pathname: "/id/**" },
    ],
  },
};

export default nextConfig;
