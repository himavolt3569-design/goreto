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

/** Matches the product-media bucket limit. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Photos an Add product form can stage before the product exists. */
export const MAX_STAGED_PHOTOS = 30;

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
