import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { autoBookPending, processPendingInbox, syncDueShipments, syncOpenSupportCases } from "@/lib/courier/provider-sync";

/*
 * Scheduled courier sync (docs/couriers/daraz.md §7): Daraz tracking for
 * booked, unfinished parcels, unprocessed webhook messages, open support
 * cases, and automatic booking when the store turned it on. Called by
 * Vercel Cron (vercel.json) and, optionally, Supabase pg_cron
 * (docs/releasing.md), both with `Authorization: Bearer $CRON_SECRET`.
 */

export const maxDuration = 60;

function authorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(header ?? "", "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return new Response("CRON_SECRET is not configured", { status: 503 });
  if (!authorised(req.headers.get("authorization"), secret)) return new Response("Unauthorized", { status: 401 });

  try {
    const inbox = await processPendingInbox();
    const shipments = await syncDueShipments({ limit: 25, staleMinutes: 10 });
    const cases = await syncOpenSupportCases();
    const autoBooked = await autoBookPending();
    return Response.json({
      inboxProcessed: inbox,
      shipmentsSynced: shipments.filter((outcome) => outcome.ok).length,
      shipmentsFailed: shipments.filter((outcome) => !outcome.ok).length,
      supportCasesUpdated: cases,
      autoBooked: autoBooked.booked,
      autoBookFailed: autoBooked.failed,
    });
  } catch (error) {
    console.error("[courier sync] failed:", error instanceof Error ? error.message : "unknown error");
    return new Response("Sync failed", { status: 500 });
  }
}
