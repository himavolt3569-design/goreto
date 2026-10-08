import { after, type NextRequest } from "next/server";
import { darazConfig } from "@/lib/courier/daraz/config";
import { verifyWebhookSignature } from "@/lib/courier/daraz/sign";
import { MAX_WEBHOOK_BYTES } from "@/lib/courier/daraz/webhook";
import { processInboxMessage, recordWebhook } from "@/lib/courier/provider-sync";

/*
 * Daraz push messages (docs/couriers/daraz.md §5). Public in proxy.ts; the
 * Authorization header (hex HMAC-SHA256 of app key + body, keyed with the
 * app secret) is the only authentication. Daraz wants a 200 within 500 ms,
 * so the reply goes out as soon as the signature checks out; storing and
 * syncing happen after it. A push is only a trigger: tracking comes from the
 * history API, so losing one is harmless (the scheduled sync catches up).
 */

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const config = darazConfig();
  if (!config) return new Response("Daraz is not configured", { status: 503 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_WEBHOOK_BYTES) return new Response("Too large", { status: 413 });
  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) return new Response("Too large", { status: 413 });

  if (!verifyWebhookSignature(config.appKey, rawBody, req.headers.get("authorization"), config.appSecret)) {
    console.warn("[daraz webhook] signature verification failed");
    return new Response("Verification failed", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  after(async () => {
    try {
      const id = await recordWebhook(rawBody, payload);
      if (id) await processInboxMessage(id);
    } catch (error) {
      console.error("[daraz webhook] processing failed:", error instanceof Error ? error.message : "unknown error");
    }
  });

  return new Response("OK", { status: 200 });
}
