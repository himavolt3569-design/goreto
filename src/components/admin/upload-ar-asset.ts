import { createArAssetUploadAction } from "@/features/admin/actions/ar";
import { AR_CONTENT_TYPES, AR_SIGNATURE_BYTES, detectArFormat, MAX_AR_BYTES, type ArFormat } from "@/features/admin/asset-signature";

/*
 * Browser half of an AR file upload (AGENTS §18.3–18.4): pre-check the
 * file's bytes, size and fit with the try-on mode, ask the server for a
 * signed URL on a path it chooses, and PUT the file straight to Storage. The
 * save action verifies the stored bytes again.
 */

export type UploadedArFile = { ok: true; path: string; format: ArFormat } | { ok: false; message: string };

const FORMAT_NAMES: Record<ArFormat, string> = { png: "PNG", webp: "WebP", glb: "GLB", usdz: "USDZ" };

export function formatList(formats: readonly ArFormat[]): string {
  const names = formats.map((format) => FORMAT_NAMES[format]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : (names[0] ?? "");
}

/** The file input's `accept` for these formats (extensions help USDZ, which browsers rarely type). */
export function acceptFor(formats: readonly ArFormat[]): string {
  return formats.flatMap((format) => [AR_CONTENT_TYPES[format], `.${format}`]).join(",");
}

export async function uploadArFile(productId: string, file: File, allowed: readonly ArFormat[]): Promise<UploadedArFile> {
  const format = detectArFormat(new Uint8Array(await file.slice(0, AR_SIGNATURE_BYTES).arrayBuffer()));
  if (!format || !allowed.includes(format)) return { ok: false, message: `Not a ${formatList(allowed)} file.` };
  if (file.size > MAX_AR_BYTES) return { ok: false, message: "Larger than 25 MB." };

  const contentType = AR_CONTENT_TYPES[format];
  const ticket = await createArAssetUploadAction({ productId, contentType, size: file.size });
  if (!ticket.ok) return { ok: false, message: ticket.message };

  const body = new FormData();
  body.append("cacheControl", "31536000");
  body.append("", new Blob([file], { type: contentType }));
  const upload = await fetch(ticket.signedUrl, { method: "PUT", body, headers: { "x-upsert": "false" } }).catch(() => null);
  if (!upload?.ok) return { ok: false, message: "The upload failed. Check your connection and try again." };
  return { ok: true, path: ticket.path, format };
}
