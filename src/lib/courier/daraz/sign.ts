import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Daraz Open Platform signatures (docs/couriers/daraz.md).
 *
 * API requests: sort every parameter except `sign` by name (ASCII), join as
 * name+value with no separators, prefix the API path, HMAC-SHA256 with the
 * app secret, upper-case hex.
 *
 * Webhook pushes: the `Authorization` header is hex HMAC-SHA256 of
 * app key + raw body, keyed with the app secret.
 */

export function signRequest(apiPath: string, params: Readonly<Record<string, string>>, appSecret: string): string {
  const base =
    apiPath +
    Object.keys(params)
      .filter((key) => key !== "sign" && params[key] !== "")
      .sort()
      .map((key) => key + params[key])
      .join("");
  return createHmac("sha256", appSecret).update(base, "utf8").digest("hex").toUpperCase();
}

export function webhookSignature(appKey: string, rawBody: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(appKey + rawBody, "utf8").digest("hex");
}

/** Constant-time check of a pushed `Authorization` header (hex, any case). */
export function verifyWebhookSignature(appKey: string, rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header) return false;
  const received = header.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(received)) return false;
  const expected = webhookSignature(appKey, rawBody, appSecret);
  return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
}
