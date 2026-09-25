import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { profileInputFromClerkUser } from "@/lib/auth/clerk-user";
import { markClerkProfileDeleted, syncClerkProfile } from "@/lib/auth/profile-sync";

/*
 * Clerk -> profiles sync (AGENTS §9.4, §18.6). Public in proxy.ts; the Svix
 * signature (CLERK_WEBHOOK_SIGNING_SECRET) is the only authentication.
 *
 * Idempotent by construction: the database applies user snapshots in Clerk
 * `updated_at` order and deletes are tombstones, so retries and out-of-order
 * deliveries are harmless. 4xx means "don't retry" (bad signature or shape);
 * 5xx asks Svix to retry.
 */

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    console.warn("[clerk webhook] signature verification failed");
    return new Response("Verification failed", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const parsed = profileInputFromClerkUser(evt.data);
        if (!parsed.ok) {
          console.warn(`[clerk webhook] ${evt.type}: unexpected payload (${parsed.error})`);
          return new Response("Unexpected payload", { status: 400 });
        }
        await syncClerkProfile(parsed.input);
        break;
      }
      case "user.deleted": {
        if (!evt.data.id) {
          console.warn("[clerk webhook] user.deleted without a user id");
          return new Response("Unexpected payload", { status: 400 });
        }
        await markClerkProfileDeleted(evt.data.id);
        break;
      }
      default:
        // Subscribed to more than we need; acknowledge so Svix doesn't retry.
        break;
    }
  } catch (error) {
    console.error(`[clerk webhook] ${evt.type} failed:`, error instanceof Error ? error.message : error);
    return new Response("Sync failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
