import "server-only";
import { z } from "zod";
import { darazCall, type DarazResult } from "./client";
import type { DarazConfig } from "./config";
import type { ConsignmentParams, WarehouseParams } from "./payloads";
import { parseDarazFee } from "./status-map";

/*
 * The Daraz Logistics (EPIS) endpoints Goreto uses (docs/couriers/daraz.md
 * §4). They are signed with the app key and secret only: no seller
 * access_token (authType 0). Response fields arrive as strings or numbers,
 * so numbers and booleans are coerced.
 */

const optionalText = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => (value === null || value === undefined || value === "" || value === "null" ? null : String(value)));
const optionalNumber = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  });
const looseBoolean = z
  .union([z.boolean(), z.string()])
  .nullish()
  .transform((value) => value === true || value === "true");
const provider = z
  .union([z.string(), z.object({ tplName: optionalText, tplSlug: optionalText, tplCode: optionalText })])
  .nullish()
  .transform((value) => (typeof value === "string" ? value || null : (value?.tplName ?? value?.tplSlug ?? value?.tplCode ?? null)));

const consignmentSchema = z.object({
  packageCode: z.string().min(1),
  trackingNumber: z.string().min(1),
  minEta: optionalNumber,
  maxEta: optionalNumber,
  lastMileShippingProvider: provider,
});
export type Consignment = z.infer<typeof consignmentSchema>;

const timelineSchema = z.object({
  status: z.string().min(1),
  processTime: optionalNumber,
  shippingProvider: optionalText,
  reasonCode: optionalText,
  location: optionalText,
  // Proof of delivery: shown live to staff, never stored (AGENTS §26.3, privacy).
  epod: optionalText,
  photos: optionalText,
  driverName: optionalText,
  trackingUrl: optionalText,
});

const historySchema = z.object({
  packageCode: optionalText,
  trackingNumber: optionalText,
  status: optionalText,
  lastMileShippingProvider: provider,
  timeline: z
    .array(timelineSchema)
    .nullish()
    .transform((value) => value ?? []),
  shippingFee: z.unknown().optional(),
  notifyVasFdStorage: looseBoolean,
});
export type PackageHistory = z.infer<typeof historySchema>;
export type TimelineEntry = z.infer<typeof timelineSchema>;

const deliveryOptionsSchema = z
  .array(
    z.object({
      deliveryOption: optionalText,
      firstMileDeliveryType: optionalText,
      pickupTargetCutoffTime: optionalNumber,
      lastMileShippingProvider: optionalText,
    }),
  )
  .nullish()
  .transform((value) => value ?? []);
export type DeliveryOptionQuote = z.infer<typeof deliveryOptionsSchema>[number];

const feeLinesSchema = z
  .array(z.object({ transactionType: optionalText, transactionName: optionalText, amount: z.unknown(), taxAmount: z.unknown() }))
  .nullish()
  .transform((value) => value ?? []);

export type FeeEstimate = { totalPaisa: number; lines: { name: string; paisa: number }[] };

const caseSchema = z
  .object({
    caseId: optionalText,
    status: optionalText,
    subject: optionalText,
    description: optionalText,
    trackingNumber: optionalText,
    orderId: optionalText,
    gmtCreate: optionalNumber,
    gmtModified: optionalNumber,
    ratingStar: optionalNumber,
    mails: z.array(z.unknown()).nullish(),
    actions: z.array(z.unknown()).nullish(),
  })
  .passthrough();
export type SupportCase = z.infer<typeof caseSchema>;

const anyData = z.unknown();

export type BookingEndpoint = "create" | "consign";

/** DEX documents "create" (/packages) as "Create an Order"; "consign" is the alternative. */
export function bookPackage(config: DarazConfig, endpoint: BookingEndpoint, params: ConsignmentParams): Promise<DarazResult<Consignment>> {
  const path = endpoint === "consign" ? "/logistics/epis/packages/consign" : "/logistics/epis/packages";
  return darazCall(config, path, params, consignmentSchema);
}

export function markReadyToShip(config: DarazConfig, trackingNumber: string): Promise<DarazResult<unknown>> {
  return darazCall(config, "/logistics/epis/packages/rts", { trackingNumber }, anyData);
}

export function printAwb(config: DarazConfig, packageCode: string, type: "pdf" | "zpl" = "pdf"): Promise<DarazResult<{ url: string }>> {
  return darazCall(config, "/logistics/epis/packages/awb", { packageCode, type }, z.object({ url: z.url() }), { method: "GET" });
}

export function cancelPackage(config: DarazConfig, packageCode: string, reason: string): Promise<DarazResult<unknown>> {
  return darazCall(config, "/logistics/epis/packages/cancel", { packageCode, reason }, anyData);
}

export function updatePackage(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<unknown>> {
  return darazCall(config, "/logistics/epis/packages/update", params, anyData);
}

export function packageHistory(config: DarazConfig, trackingNumber: string): Promise<DarazResult<PackageHistory>> {
  return darazCall(
    config,
    "/logistics/epis/packages/history",
    { trackingNumber, includeTimeline: true, includeShippingFee: true },
    historySchema,
    { method: "GET" },
  );
}

export function reattemptPackage(
  config: DarazConfig,
  input: { packageCode: string; feedbackType: "REATTEMPT" | "RETURN"; reAttemptDateTime: number | null; sellerNote: string | null },
): Promise<DarazResult<unknown>> {
  return darazCall(config, "/logistics/epis/packages/reattempt", input, anyData);
}

export function deliveryOptions(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<DeliveryOptionQuote[]>> {
  return darazCall(config, "/logistics/epis/service/delivery_options", params, deliveryOptionsSchema, { method: "GET" });
}

export async function estimateShippingFee(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<FeeEstimate>> {
  const result = await darazCall(config, "/logistics/epis/estimate_shipping_fee", params, feeLinesSchema);
  if (!result.ok) return result;
  const lines = result.data.map((line) => ({
    name: line.transactionName ?? line.transactionType ?? "Fee",
    paisa: (parseDarazFee(line.amount) ?? 0) + (parseDarazFee(line.taxAmount) ?? 0),
  }));
  return { ...result, data: { totalPaisa: lines.reduce((sum, line) => sum + line.paisa, 0), lines } };
}

export function linkCustomerAccount(
  config: DarazConfig,
  input: { externalSellerId: string; platformName: string; otp: string },
): Promise<DarazResult<unknown>> {
  return darazCall(config, "/logistics/epis/customers/external_relationships_bundle", input, anyData);
}

export function saveWarehouse(config: DarazConfig, params: WarehouseParams): Promise<DarazResult<{ convertedAddressId: string | null }>> {
  const schema = z
    .object({ convertedAddress: z.object({ id: optionalText }).nullish() })
    .nullish()
    .transform((value) => ({ convertedAddressId: value?.convertedAddress?.id ?? null }));
  return darazCall(config, "/logistics/epis/customers/warehouses", params, schema);
}

/* ---------- Support cases (XSpace) ---------- */

export function createSupportCase(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<{ caseId: string }>> {
  const schema = z.object({ caseId: z.union([z.string(), z.number()]).transform(String) });
  return darazCall(config, "/logistics/epis/xspace/create", params, schema);
}

export function querySupportCases(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<SupportCase[]>> {
  const schema = z
    .object({ content: z.array(caseSchema).nullish() })
    .nullish()
    .transform((value) => value?.content ?? []);
  return darazCall(config, "/logistics/epis/xspace/query", params, schema);
}

export function supportCaseDetail(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<SupportCase>> {
  return darazCall(config, "/logistics/epis/xspace/detail", params, caseSchema);
}

export function rateSupportCase(config: DarazConfig, params: Record<string, unknown>): Promise<DarazResult<unknown>> {
  return darazCall(config, "/logistics/epis/xspace/rate", params, anyData);
}

/* ---------- Connection check ---------- */

/** Tracking number that exists nowhere: a signed lookup proves the keys work. */
export const CONNECTION_PROBE = "GORETO-CONNECTION-TEST";

export type ConnectionCheck = { ok: boolean; detail: string };

/**
 * Signature, network and HTTP errors mean the keys or URL are wrong. Daraz
 * answering "not found" (or another business error) means the request was
 * authenticated.
 */
export async function checkConnection(config: DarazConfig): Promise<ConnectionCheck> {
  const result = await packageHistory(config, CONNECTION_PROBE);
  if (result.ok) return { ok: true, detail: "Daraz accepted the signed request." };
  const { code, message, traceId } = result.error;
  if (code === "UNEXPECTED_DATA") return { ok: true, detail: "Keys accepted (Daraz answered the test lookup)." };
  if (code === "SIGNATURE" || code === "NETWORK" || code.startsWith("HTTP_") || code === "UNEXPECTED_RESPONSE") {
    return { ok: false, detail: `${message}${traceId ? ` (trace ${traceId})` : ""}` };
  }
  return { ok: true, detail: `Keys accepted. Daraz answered: ${code}${message ? ` (${message})` : ""}.` };
}
