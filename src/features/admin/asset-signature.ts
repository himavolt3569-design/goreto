import { detectImageFormat } from "./product-form/file-signature";

/*
 * AR asset type from a file's first bytes (AGENTS §18.4), used in the browser
 * as a pre-check and on the server against the stored object. Overlays are
 * PNG or WebP; models are binary glTF (GLB) or USDZ. Multi-file glTF isn't
 * uploadable.
 */

export type ArFormat = "png" | "webp" | "glb" | "usdz";

export const AR_CONTENT_TYPES: Record<ArFormat, string> = {
  png: "image/png",
  webp: "image/webp",
  glb: "model/gltf-binary",
  usdz: "model/vnd.usdz+zip",
};

/** Matches the ar-assets bucket limit. */
export const MAX_AR_BYTES = 25 * 1024 * 1024;

/** Bytes needed by `detectArFormat`: a ZIP header plus the first entry's name. */
export const AR_SIGNATURE_BYTES = 128;

export function arFormatForContentType(contentType: string): ArFormat | null {
  const entry = Object.entries(AR_CONTENT_TYPES).find(([, type]) => type === contentType.toLowerCase());
  return entry ? (entry[0] as ArFormat) : null;
}

const uint16 = (bytes: Uint8Array, at: number) => bytes[at]! | (bytes[at + 1]! << 8);
const uint32 = (bytes: Uint8Array, at: number) => (uint16(bytes, at) | (uint16(bytes, at + 2) << 16)) >>> 0;

/** GLB: "glTF" magic, then container version 2. */
function isGlb(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && String.fromCharCode(...bytes.subarray(0, 4)) === "glTF" && uint32(bytes, 4) === 2;
}

/** USDZ: a ZIP whose first entry is the USD layer (`.usda`, `.usdc` or `.usd`). */
function isUsdz(bytes: Uint8Array): boolean {
  if (bytes.length < 30 || uint32(bytes, 0) !== 0x04034b50) return false;
  const nameLength = uint16(bytes, 26);
  if (nameLength === 0 || 30 + nameLength > bytes.length) return false;
  const name = String.fromCharCode(...bytes.subarray(30, 30 + nameLength)).toLowerCase();
  return /\.usd[ac]?$/.test(name);
}

export function detectArFormat(bytes: Uint8Array): ArFormat | null {
  if (isGlb(bytes)) return "glb";
  if (isUsdz(bytes)) return "usdz";
  const image = detectImageFormat(bytes);
  return image === "png" || image === "webp" ? image : null;
}
