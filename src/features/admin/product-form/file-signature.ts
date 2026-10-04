/*
 * Image type from a file's first bytes (AGENTS §18.4: never trust the
 * extension or the declared content type alone). Used in the browser as a
 * pre-check and on the server against the stored object.
 */

export type ImageFormat = "jpg" | "png" | "webp" | "avif";

export const IMAGE_CONTENT_TYPES: Record<ImageFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/** Photos only; the product-media bucket allows up to 50 MB for videos. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Per product, also enforced by the product_media_enforce_limits trigger. */
export const MAX_PHOTOS = 7;
export const MAX_VIDEOS = 3;

/** Photos an Add product form can stage before the product exists. */
export const MAX_STAGED_PHOTOS = MAX_PHOTOS;

/** Bytes needed by `detectImageFormat`. */
export const SIGNATURE_BYTES = 16;

export function formatForContentType(contentType: string): ImageFormat | null {
  const entry = Object.entries(IMAGE_CONTENT_TYPES).find(([, type]) => type === contentType.toLowerCase());
  return entry ? (entry[0] as ImageFormat) : null;
}

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12))) return "avif";
  return null;
}

/* ---------- Videos ---------- */

export type VideoFormat = "mp4" | "webm";

export const VIDEO_CONTENT_TYPES: Record<VideoFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

/** The product-media bucket's limit (and Supabase's default per-file upload limit). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type MediaFormat = ImageFormat | VideoFormat;
export type MediaKind = "image" | "video";

export const MEDIA_CONTENT_TYPES: Record<MediaFormat, string> = { ...IMAGE_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES };

/** Same box layout as MP4 but not a playable web video: QuickTime (.mov), HEIF/AVIF images, audio only. */
const MP4_REFUSED_BRANDS = new Set(["avif", "avis", "qt  ", "heic", "heix", "heim", "heis", "hevc", "mif1", "msf1", "M4A ", "M4B "]);

export function detectVideoFormat(bytes: Uint8Array): VideoFormat | null {
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && !MP4_REFUSED_BRANDS.has(ascii(bytes, 8, 12))) return "mp4";
  return null;
}

/** True for a QuickTime file, so the browser can suggest exporting as MP4. */
export function isQuickTime(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && ascii(bytes, 8, 12) === "qt  ";
}

/** A product photo or video, from its first `SIGNATURE_BYTES` bytes. */
export function detectMediaFormat(bytes: Uint8Array): MediaFormat | null {
  return detectImageFormat(bytes) ?? detectVideoFormat(bytes);
}

export function mediaKindOf(format: MediaFormat): MediaKind {
  return format === "mp4" || format === "webm" ? "video" : "image";
}

export function mediaFormatForContentType(contentType: string): MediaFormat | null {
  const entry = Object.entries(MEDIA_CONTENT_TYPES).find(([, type]) => type === contentType.toLowerCase());
  return entry ? (entry[0] as MediaFormat) : null;
}
