import type { MediaImage } from "@/components/ui/media-frame";

/** Public bucket for product, category and collection imagery (AGENTS §10.4). */
export const PRODUCT_MEDIA_BUCKET = "product-media";

/**
 * Public URL for an object key in the product-media bucket. The database
 * stores keys (`products/<slug>/01.jpg`), never URLs, so the URL is built here
 * at the boundary. next/image resizes it (see next.config.ts).
 */
export function productMediaUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (path === "" || /^[a-z]+:\/\//i.test(path) || path.split("/").includes("..")) {
    throw new TypeError(`Invalid storage path: ${path}`);
  }
  const key = path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${key}`;
}

/** A MediaImage for a stored key, or null when there is no image yet. */
export function productMediaImage(path: string | null | undefined, alt: string): MediaImage | null {
  return path ? { src: productMediaUrl(path), alt } : null;
}
