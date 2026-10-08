import "server-only";
import { createHash } from "node:crypto";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { bookWithDaraz, defaultParcel, loadBookingContext, loadDarazSettings, MISSING_WEIGHT_MESSAGE, type BookingOps } from "./daraz/booking";
import { describeDarazError, type DarazResult } from "./daraz/client";
import { darazConfig, type DarazConfig } from "./daraz/config";
import { packageHistory, querySupportCases } from "./daraz/epis";
import { toProviderHistory } from "./daraz/status-map";
import { extractIdentifiers } from "./daraz/webhook";

/*
 * Courier sync without a user session: Daraz webhooks and the scheduled job
 * (docs/couriers/daraz.md §5, §7). This is the only courier module that uses
 * the service role (boundaries.test.ts); it reads Daraz package history and
 * applies it through courier_apply_provider_history, the same SQL the staff
 * "Refresh tracking" uses. Staff actions never come through here.
 */

const PROVIDER = "daraz";
const FINAL_STATUSES = "(delivered,returned)";

type ShipmentRef = { id: string; order_id: string; tracking_number: string | null };

export type SyncOutcome = { shipmentId: string; ok: boolean; status?: string; inserted?: number; error?: string };

async function logCall(action: string, orderId: string | null, result: DarazResult<unknown>): Promise<void> {
  const { error } = await getAdminSupabase()
    .from("courier_api_log")
    .insert({
      provider: PROVIDER,
      action,
      order_id: orderId,
      success: result.ok,
      error_code: result.ok ? null : result.error.code.slice(0, 100),
      error_message: result.ok ? null : describeDarazError(result.error).slice(0, 500),
      trace_id: result.ok ? result.traceId : result.error.traceId,
      duration_ms: Math.round(result.durationMs),
    });
  if (error) console.warn(`[courier sync] couldn't write the API log: ${error.code ?? ""}`);
}

/** Fetches one shipment's Daraz history and applies it. */
export async function syncShipment(config: DarazConfig, shipment: ShipmentRef): Promise<SyncOutcome> {
  if (!shipment.tracking_number) return { shipmentId: shipment.id, ok: false, error: "no tracking number" };
  const result = await packageHistory(config, shipment.tracking_number);
  await logCall("history_sync", shipment.order_id, result);
  if (!result.ok) return { shipmentId: shipment.id, ok: false, error: result.error.code };

  const { data, error } = await getAdminSupabase().rpc("courier_apply_provider_history", {
    p_shipment_id: shipment.id,
    p_history: toProviderHistory(result.data) as unknown as Json,
  });
  if (error) return { shipmentId: shipment.id, ok: false, error: error.code ?? "database" };
  const applied = (data ?? {}) as { status?: string; inserted?: number };
  return { shipmentId: shipment.id, ok: true, status: applied.status, inserted: applied.inserted };
}

/** Booked, unfinished Daraz shipments, least recently synced first. */
export async function syncDueShipments(options: { limit?: number; staleMinutes?: number } = {}): Promise<SyncOutcome[]> {
  const config = darazConfig();
  if (!config) return [];
  const staleBefore = new Date(Date.now() - (options.staleMinutes ?? 30) * 60_000).toISOString();
  const { data, error } = await getAdminSupabase()
    .from("shipments")
    .select("id, order_id, tracking_number")
    .eq("provider", PROVIDER)
    .not("provider_package_code", "is", null)
    .not("status", "in", FINAL_STATUSES)
    .or(`provider_synced_at.is.null,provider_synced_at.lt.${staleBefore}`)
    .order("provider_synced_at", { ascending: true, nullsFirst: true })
    .limit(options.limit ?? 25);
  if (error) throw new Error(`courier sync: couldn't list shipments (${error.code ?? ""})`);

  const outcomes: SyncOutcome[] = [];
  for (const shipment of data) outcomes.push(await syncShipment(config, shipment));
  return outcomes;
}

/** Syncs the Daraz shipments a pushed message names (by tracking number or package code). */
export async function syncByIdentifiers(identifiers: readonly string[]): Promise<SyncOutcome[]> {
  const config = darazConfig();
  if (!config || identifiers.length === 0) return [];
  const list = identifiers.filter((id) => /^[A-Za-z0-9_-]{3,100}$/.test(id)).join(",");
  if (!list) return [];
  const { data, error } = await getAdminSupabase()
    .from("shipments")
    .select("id, order_id, tracking_number")
    .eq("provider", PROVIDER)
    .not("provider_package_code", "is", null)
    .or(`tracking_number.in.(${list}),provider_package_code.in.(${list})`)
    .limit(20);
  if (error) throw new Error(`courier sync: couldn't find shipments (${error.code ?? ""})`);

  const outcomes: SyncOutcome[] = [];
  for (const shipment of data) outcomes.push(await syncShipment(config, shipment));
  return outcomes;
}

/** Stores a verified push once (deduplicated by body hash). Returns its id, or null for a repeat. */
export async function recordWebhook(rawBody: string, payload: unknown): Promise<string | null> {
  const sha = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const { data, error } = await getAdminSupabase()
    .from("courier_webhook_inbox")
    .upsert({ provider: PROVIDER, body_sha256: sha, payload: payload as Json }, { onConflict: "provider,body_sha256", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`courier webhook: couldn't store the message (${error.code ?? ""})`);
  return data[0]?.id ?? null;
}

/** Processes one stored push: sync what it names, then mark it done or record why not. */
export async function processInboxMessage(id: string): Promise<void> {
  const db = getAdminSupabase();
  const { data: row, error } = await db.from("courier_webhook_inbox").select("id, payload, attempts").eq("id", id).maybeSingle();
  if (error || !row) return;

  let failure: string | null = null;
  try {
    const outcomes = await syncByIdentifiers(extractIdentifiers(row.payload));
    const failed = outcomes.filter((outcome) => !outcome.ok);
    if (failed.length > 0) failure = `sync failed: ${failed.map((outcome) => outcome.error).join(", ")}`.slice(0, 500);
  } catch (caught) {
    failure = (caught instanceof Error ? caught.message : "sync failed").slice(0, 500);
  }

  await db
    .from("courier_webhook_inbox")
    .update({ attempts: row.attempts + 1, processed_at: failure ? null : new Date().toISOString(), error: failure })
    .eq("id", id);
}

/** Retries stored pushes that haven't been processed (at most five attempts each). */
export async function processPendingInbox(limit = 20): Promise<number> {
  const { data, error } = await getAdminSupabase()
    .from("courier_webhook_inbox")
    .select("id")
    .eq("provider", PROVIDER)
    .is("processed_at", null)
    .lt("attempts", 5)
    .order("received_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`courier webhook: couldn't list the inbox (${error.code ?? ""})`);
  for (const row of data) await processInboxMessage(row.id);
  return data.length;
}

/** Refreshes the status of open Daraz support cases. */
export async function syncOpenSupportCases(): Promise<number> {
  const config = darazConfig();
  if (!config) return 0;
  const db = getAdminSupabase();
  const { data: open, error } = await db
    .from("courier_support_cases")
    .select("case_id")
    .eq("provider", PROVIDER)
    .or("status.is.null,status.not.in.(closed,resolved,solved)")
    .limit(50);
  if (error || open.length === 0) return 0;

  const { data: account } = await db.from("courier_provider_accounts").select("platform_name, external_seller_id").eq("provider", PROVIDER).maybeSingle();
  const result = await querySupportCases(config, {
    caseIds: open.map((row) => row.case_id),
    pageNo: 1,
    pageSize: 50,
    platformName: account?.platform_name ?? undefined,
    externalSellerId: account?.external_seller_id ?? undefined,
  });
  await logCall("support_sync", null, result);
  if (!result.ok) return 0;

  let updated = 0;
  for (const item of result.data) {
    if (!item.caseId) continue;
    const { error: updateError } = await db
      .from("courier_support_cases")
      .update({ status: item.status?.slice(0, 60) ?? null, synced_at: new Date().toISOString() })
      .eq("provider", PROVIDER)
      .eq("case_id", item.caseId);
    if (!updateError) updated += 1;
  }
  return updated;
}

/* ---------- Automatic booking ---------- */

const SERVICE_OPS: BookingOps = {
  async reference(orderId) {
    const { data, error } = await getAdminSupabase().rpc("courier_provider_booking_reference", { p_order_id: orderId, p_provider: PROVIDER });
    return error || !data ? { ok: false, message: error?.message ?? "no booking reference" } : { ok: true, value: data };
  },
  async record(orderId, booking) {
    const { error } = await getAdminSupabase().rpc("courier_record_provider_booking", { p_order_id: orderId, p_provider: PROVIDER, p_booking: booking });
    return error ? { ok: false, message: error.message } : { ok: true };
  },
  log: logCall,
};

/**
 * Books accepted Daraz orders when the store turned auto-book on (Setup).
 * Each order is tried once; a failure notifies order staff, who book it
 * from the order page.
 */
export async function autoBookPending(limit = 10): Promise<{ booked: number; failed: number }> {
  const config = darazConfig();
  if (!config) return { booked: 0, failed: 0 };
  const db = getAdminSupabase();
  const settings = await loadDarazSettings(db);
  if (!settings?.auto_book) return { booked: 0, failed: 0 };

  const { data: candidates, error } = await db.rpc("courier_auto_book_candidates", { p_provider: PROVIDER, p_limit: limit });
  if (error) throw new Error(`courier auto-book: couldn't list orders (${error.code ?? ""})`);

  let booked = 0;
  let failed = 0;
  for (const { order_id: orderId } of candidates) {
    const context = await loadBookingContext(db, orderId);
    if (!context) continue;
    const parcel = defaultParcel(settings, context);
    const outcome = parcel
      ? await bookWithDaraz(config, settings, context, parcel, SERVICE_OPS)
      : { ok: false as const, message: MISSING_WEIGHT_MESSAGE };
    if (outcome.ok) {
      booked += 1;
    } else {
      failed += 1;
      await db.rpc("courier_auto_book_failed", { p_order_id: orderId, p_reason: outcome.message.slice(0, 480) });
    }
  }
  return { booked, failed };
}
