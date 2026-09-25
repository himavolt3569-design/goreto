import { createHash } from "node:crypto";

/**
 * Deterministic UUIDv5 ids from a natural key, e.g. `seedId("product", slug)`.
 * The same key always yields the same id, so loading the seed twice upserts
 * rather than duplicating rows.
 */

const GORETO_SEED_NAMESPACE = Buffer.from("6f1c2e8a3b1d4c559a3e2f0b7d9c4e11", "hex");

export function uuidV5(name: string): string {
  const bytes = createHash("sha1").update(GORETO_SEED_NAMESPACE).update(name).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function seedId(kind: string, ...keyParts: (string | number)[]): string {
  return uuidV5(`${kind}:${keyParts.join(":")}`);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
