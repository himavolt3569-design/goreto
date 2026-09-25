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

/**
 * A local Supabase stack (`supabase start`) serves storage from a loopback
 * address, which the image optimizer blocks by default (SSRF guard). Allow it
 * only outside production and only when Supabase itself is local.
 */
function allowLocalSupabaseImages(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}

const nextConfig: NextConfig = {
  experimental: {
    // Admin nav links prefetch whole dynamic pages (prefetch={true}), which the
    // client reuses for `static` seconds. 30s instead of the 5-minute default
    // keeps order counts and stock from going stale.
    staleTimes: { static: 30 },
  },
  images: {
    dangerouslyAllowLocalIP: allowLocalSupabaseImages(),
    remotePatterns: [
      ...supabaseStoragePattern(),
      // Hero and "how it works" stand-in photography (src/lib/media/picsum.ts).
      // Picsum redirects to its CDN; Next follows up to `maximumRedirects` (default 3).
      { protocol: "https", hostname: "picsum.photos", pathname: "/id/**" },
      // Clerk profile photos in the admin header (User.imageUrl).
      { protocol: "https", hostname: "img.clerk.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
