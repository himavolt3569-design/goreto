import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/*
 * Guest access to an order (AGENTS §9.1, §16). Each order gets a random
 * tracking secret; the database stores only its sha256. The shopper holds the
 * secret in an httpOnly cookie (set right after ordering, or by opening their
 * tracking link) and get_order_tracking checks it. Signed-in owners don't
 * need it: the database recognises them from the session.
 */

const ORDER_NUMBER = /^[A-Z]{2,4}[0-9]{6,14}$/;
const SECRET = /^[A-Za-z0-9_-]{16,128}$/;
const COOKIE_PREFIX = "goreto_order_";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export function isOrderNumber(value: string): boolean {
  return ORDER_NUMBER.test(value);
}

export function isTrackingSecret(value: string): boolean {
  return SECRET.test(value);
}

/** 192 random bits, URL-safe. */
export function createTrackingSecret(): string {
  return randomBytes(24).toString("base64url");
}

/** Matches encode(sha256(convert_to(secret, 'UTF8')), 'hex') in SQL. */
export function hashTrackingSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function cookieName(orderNumber: string): string {
  return `${COOKIE_PREFIX}${orderNumber}`;
}

/** For Server Actions and Route Handlers only (cookies can't be set while rendering). */
export async function rememberTrackingSecret(orderNumber: string, secret: string): Promise<void> {
  (await cookies()).set(cookieName(orderNumber), secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function readTrackingSecret(orderNumber: string): Promise<string | null> {
  const value = (await cookies()).get(cookieName(orderNumber))?.value;
  return value && isTrackingSecret(value) ? value : null;
}

/** Path of the shareable tracking link; opening it stores the secret and redirects. */
export function trackingLinkPath(orderNumber: string, secret: string): string {
  return `/track/${orderNumber}/access?code=${encodeURIComponent(secret)}`;
}
