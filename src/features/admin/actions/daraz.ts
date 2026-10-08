"use server";

import { refresh } from "next/cache";
import { defaultParcel, MISSING_WEIGHT_MESSAGE } from "@/lib/courier/daraz/booking";
import { describeDarazError } from "@/lib/courier/daraz/client";
import { darazConfig, type DarazConfig } from "@/lib/courier/daraz/config";
import {
  cancelPackage,
  checkConnection,
  createSupportCase,
  deliveryOptions,
  estimateShippingFee,
  linkCustomerAccount,
  packageHistory,
  rateSupportCase,
  reattemptPackage,
  saveWarehouse,
  supportCaseDetail,
  updatePackage,
  type SupportCase,
} from "@/lib/courier/daraz/epis";
import { buildDeliveryOptionsQuery, buildFeeEstimate, buildPackageUpdate, buildWarehouse, goodsValuePaisa, type DeliveryOption } from "@/lib/courier/daraz/payloads";
import { toMilliseconds } from "@/lib/courier/daraz/status-map";
import { formatNpr } from "@/lib/money/format";
import { authorizeAdmin, databaseErrorResult, deniedResult, type ActionResult } from "../auth";
import { bookedPackage, bookOrder, darazFailure, NOT_BOOKED, NOT_CONFIGURED, prepare, readyOrder, refreshOrder } from "../daraz-staff";
import {
  darazBookingSchema,
  darazBulkSchema,
  darazCancelSchema,
  darazFeedbackSchema,
  darazLinkSchema,
  darazOrderSchema,
  darazReceiverSchema,
  darazSettingsSchema,
  darazWarehouseSchema,
  remittanceIdSchema,
  remittanceSchema,
  supportCaseSchema,
  supportRatingSchema,
} from "../daraz-forms";
import { bookingAccount, fetchBookingContext, fetchDarazSettings, PROVIDER, type DarazSettings } from "../queries/daraz";
import { adminDb } from "../queries/shared";
import { logDarazCall } from "../daraz-log";
import { authorizeAndParse, saveErrorResult } from "./helpers";

/*
 * Daraz Express actions (prompts/goreto-daraz-courier.md, docs/couriers/daraz.md).
 * Each one authorizes, re-reads the order on the server (prices, COD and
 * addresses never come from the browser), calls Daraz, logs the call with
 * its trace id (courier_api_log, no payloads), then records the outcome
 * through a permission-checked RPC. Daraz's own error text is shown to staff.
 */

/* ---------- Booking ---------- */

export type DarazQuote = {
  feePaisa: number | null;
  feeLines: { name: string; paisa: number }[];
  options: { deliveryOption: string; firstMileType: string | null; pickupCutoffAt: string | null }[];
  notes: string[];
};

/** Fee estimate and delivery options for the Book dialog. Nothing is booked. */
export async function quoteDarazAction(orderId: string, weightGrams: number, option: DeliveryOption): Promise<{ ok: true; quote: DarazQuote } | { ok: false; message: string }> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };
  if (!darazOrderSchema.safeParse({ orderId }).success || !Number.isInteger(weightGrams) || weightGrams < 1 || weightGrams > 100_000) {
    return { ok: false, message: "Enter the parcel weight first." };
  }
  const prepared = await prepare(orderId);
  if (!prepared.ok) return { ok: false, message: prepared.result.ok ? "" : prepared.result.message };
  const { config, settings, context } = prepared.value;
  const account = bookingAccount(settings);
  if (!account.ok) return { ok: false, message: `Finish Daraz setup first: ${account.missing.join(", ")}.` };

  const notes: string[] = [];
  const [fee, options] = await Promise.all([
    estimateShippingFee(
      config,
      buildFeeEstimate({
        account: account.account,
        destinationAddressId: context.order.darazAddressId,
        destinationLatitude: context.order.address.latitude,
        destinationLongitude: context.order.address.longitude,
        weightGrams,
        deliveryOption: option,
        goodsValuePaisa: goodsValuePaisa(context.order),
      }),
    ),
    (() => {
      const query = buildDeliveryOptionsQuery({ account: account.account, order: context.order, options: { weightGrams, lengthCm: 1, widthCm: 1, heightCm: 1 }, reference: context.orderNumber });
      return query ? deliveryOptions(config, query) : Promise.resolve(null);
    })(),
  ]);
  await logDarazCall("estimate_fee", orderId, fee);
  if (!fee.ok) notes.push(`Fee estimate unavailable: ${describeDarazError(fee.error)}`);
  if (options) {
    await logDarazCall("delivery_options", orderId, options);
    if (!options.ok) notes.push(`Delivery options unavailable: ${describeDarazError(options.error)}`);
  } else {
    notes.push("Delivery options need Daraz location IDs for the pickup and delivery addresses.");
  }

  return {
    ok: true,
    quote: {
      feePaisa: fee.ok ? fee.data.totalPaisa : null,
      feeLines: fee.ok ? fee.data.lines : [],
      options:
        options?.ok === true
          ? options.data.map((item) => ({
              deliveryOption: item.deliveryOption ?? "standard",
              firstMileType: item.firstMileDeliveryType,
              pickupCutoffAt: item.pickupTargetCutoffTime ? new Date(toMilliseconds(item.pickupTargetCutoffTime)).toISOString() : null,
            }))
          : [],
      notes,
    },
  };
}

export async function bookDarazAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", darazBookingSchema, formData);
  if (!input.ok) return input.result;
  const prepared = await prepare(input.data.orderId);
  if (!prepared.ok) return prepared.result;
  const result = await bookOrder(prepared.value, input.data);
  if (result.ok) refresh();
  return result;
}

export async function readyToShipDarazAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", darazOrderSchema, formData);
  if (!input.ok) return input.result;
  const prepared = await prepare(input.data.orderId);
  if (!prepared.ok) return prepared.result;
  const result = await readyOrder(prepared.value);
  if (result.ok) refresh();
  return result;
}

export async function refreshDarazTrackingAction(orderId: string): Promise<ActionResult> {
  const auth = await authorizeAdmin("orders.write");
  if (!auth.ok) return deniedResult(auth.reason);
  if (!darazOrderSchema.safeParse({ orderId }).success) return { ok: false, message: "That order isn't valid." };
  const prepared = await prepare(orderId);
  if (!prepared.ok) return prepared.result;
  const result = await refreshOrder(prepared.value);
  if (result.ok) refresh();
  return result;
}

export async function cancelDarazBookingAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", darazCancelSchema, formData);
  if (!input.ok) return input.result;
  const prepared = await prepare(input.data.orderId);
  if (!prepared.ok) return prepared.result;
  const { config, context } = prepared.value;
  const booked = bookedPackage(context);
  if (!booked) return NOT_BOOKED;
  if (context.shipment?.status !== "assigned") return { ok: false, message: "Daraz already has the parcel; it can't be unbooked. Use Return or a support case." };

  const result = await cancelPackage(config, booked.packageCode, input.data.reason);
  await logDarazCall("cancel", context.orderId, result);
  if (!result.ok) return darazFailure(result);
  const { error } = await adminDb().rpc("admin_clear_provider_booking", { p_order_id: context.orderId, p_provider: PROVIDER, p_reason: input.data.reason });
  if (error) return databaseErrorResult(error, "clear booking");
  refresh();
  return { ok: true, message: "Booking canceled with Daraz. You can book again or choose another courier." };
}

export async function updateDarazReceiverAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", darazReceiverSchema, formData);
  if (!input.ok) return input.result;
  const prepared = await prepare(input.data.orderId);
  if (!prepared.ok) return prepared.result;
  const { config, settings, context } = prepared.value;
  const booked = bookedPackage(context);
  if (!booked) return NOT_BOOKED;

  const result = await updatePackage(
    config,
    buildPackageUpdate({
      packageCode: booked.packageCode,
      receiverName: input.data.receiverName,
      receiverPhoneE164: input.data.receiverPhone,
      details: input.data.details,
      darazAddressId: null,
      deliveryNote: input.data.deliveryNote,
      phoneFormat: settings.phone_format === "e164" ? "e164" : "national",
    }),
  );
  await logDarazCall("update_receiver", context.orderId, result);
  if (!result.ok) return darazFailure(result);
  const { error } = await adminDb().rpc("admin_record_provider_receiver_update", {
    p_order_id: context.orderId,
    p_provider: PROVIDER,
    p_receiver: { name: input.data.receiverName, phone_e164: input.data.receiverPhone, details: input.data.details },
  });
  if (error) return databaseErrorResult(error, "record receiver update");
  refresh();
  return { ok: true, message: "Delivery details updated with Daraz." };
}

export async function darazFeedbackAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", darazFeedbackSchema, formData);
  if (!input.ok) return input.result;
  const prepared = await prepare(input.data.orderId);
  if (!prepared.ok) return prepared.result;
  const { config, context } = prepared.value;
  const booked = bookedPackage(context);
  if (!booked) return NOT_BOOKED;

  // Re-attempt during the day in Kathmandu: 10:00 NPT on the chosen date.
  const reattemptAt = input.data.reattemptOn ? Date.parse(`${input.data.reattemptOn}T10:00:00+05:45`) : null;
  const result = await reattemptPackage(config, {
    packageCode: booked.packageCode,
    feedbackType: input.data.feedback,
    reAttemptDateTime: reattemptAt,
    sellerNote: input.data.note,
  });
  await logDarazCall(input.data.feedback === "RETURN" ? "return" : "reattempt", context.orderId, result);
  if (!result.ok) return darazFailure(result);
  const { error } = await adminDb().rpc("admin_record_provider_feedback", {
    p_order_id: context.orderId,
    p_provider: PROVIDER,
    p_feedback: input.data.feedback,
    p_reattempt_on: input.data.reattemptOn as string,
  });
  if (error) return databaseErrorResult(error, "record delivery decision");
  refresh();
  return { ok: true, message: input.data.feedback === "RETURN" ? "Daraz will return the parcel to the store." : "Daraz will try the delivery again." };
}

export type ProofOfDelivery = { status: string; at: string; links: string[] }[];

/** Proof-of-delivery and photo links straight from Daraz; nothing is stored. */
export async function proofOfDeliveryAction(orderId: string): Promise<{ ok: true; proof: ProofOfDelivery } | { ok: false; message: string }> {
  const auth = await authorizeAdmin("orders.read");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };
  if (!darazOrderSchema.safeParse({ orderId }).success) return { ok: false, message: "That order isn't valid." };
  const config = darazConfig();
  if (!config) return { ok: false, message: NOT_CONFIGURED.ok ? "" : NOT_CONFIGURED.message };
  const context = await fetchBookingContext(orderId);
  const booked = context ? bookedPackage(context) : null;
  if (!context || !booked) return { ok: false, message: "This order isn't booked with Daraz Express." };
  const result = await packageHistory(config, booked.trackingNumber);
  if (!result.ok) return { ok: false, message: describeDarazError(result.error) };
  const proof = result.data.timeline
    .map((entry) => ({
      status: entry.status,
      at: entry.processTime ? new Date(toMilliseconds(entry.processTime)).toISOString() : "",
      links: [entry.epod, entry.photos]
        .flatMap((value) => (value ?? "").split(","))
        .map((link) => link.trim())
        .filter((link) => /^https?:\/\//.test(link)),
    }))
    .filter((entry) => entry.links.length > 0);
  return { ok: true, proof };
}

/* ---------- Bulk ---------- */

export async function bulkDarazAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", darazBulkSchema, formData);
  if (!input.ok) return input.result;
  if (!darazConfig()) return NOT_CONFIGURED;

  const failures: string[] = [];
  let done = 0;
  for (const orderId of input.data.orderIds) {
    const prepared = await prepare(orderId);
    if (!prepared.ok) {
      failures.push(prepared.result.ok ? orderId : prepared.result.message);
      continue;
    }
    const { settings, context } = prepared.value;
    let result: ActionResult;
    if (input.data.operation === "book") {
      const parcel = defaultParcel(settings, context);
      result = parcel ? await bookOrder(prepared.value, parcel) : { ok: false, message: MISSING_WEIGHT_MESSAGE };
    } else if (input.data.operation === "ready") {
      result = await readyOrder(prepared.value);
    } else {
      result = await refreshOrder(prepared.value);
    }
    if (result.ok) done += 1;
    else failures.push(`#${context.orderNumber}: ${result.message}`);
  }

  refresh();
  const verb = { book: "Booked", ready: "Marked ready", refresh: "Refreshed" }[input.data.operation];
  if (failures.length === 0) return { ok: true, message: `${verb} ${done} order${done === 1 ? "" : "s"}.` };
  return { ok: false, message: `${verb} ${done}. Not done: ${failures.slice(0, 5).join(" · ")}${failures.length > 5 ? " …" : ""}` };
}

/* ---------- COD settlements ---------- */

export async function recordRemittanceAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", remittanceSchema, formData);
  if (!input.ok) return input.result;
  const { data, error } = await adminDb().rpc("admin_record_remittance", {
    p_provider: PROVIDER,
    p_reference: input.data.reference,
    p_statement_date: input.data.statementDate,
    p_gross_paisa: input.data.grossAmount,
    p_deductions_paisa: input.data.deductions,
    p_note: input.data.note as string,
    p_tracking_numbers: input.data.trackingNumbers,
  });
  if (error) {
    return saveErrorResult(error, "record payout", { courier_remittances_provider_reference_key: { field: "reference", message: "This payout reference is already recorded" } });
  }
  const expected = Number((data as { expected_paisa?: number } | null)?.expected_paisa ?? 0);
  const difference = input.data.grossAmount - expected;
  refresh();
  return {
    ok: true,
    message:
      difference === 0
        ? `Payout recorded. It matches the ${formatNpr(expected)} COD Daraz collected.`
        : `Payout recorded. Daraz collected ${formatNpr(expected)}; the payout says ${formatNpr(input.data.grossAmount)} (${difference > 0 ? "+" : "−"}${formatNpr(Math.abs(difference))}). Check the statement.`,
  };
}

export async function deleteRemittanceAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("owner", remittanceIdSchema, formData);
  if (!input.ok) return input.result;
  const { error } = await adminDb().rpc("admin_delete_remittance", { p_remittance_id: input.data.remittanceId });
  if (error) return databaseErrorResult(error, "delete payout");
  refresh();
  return { ok: true, message: "Payout deleted. Its parcels are unsettled again." };
}

/* ---------- Support cases (XSpace) ---------- */

export async function createDarazSupportCaseAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", supportCaseSchema, formData);
  if (!input.ok) return input.result;
  const config = darazConfig();
  if (!config) return NOT_CONFIGURED;
  const settings = await fetchDarazSettings();

  let orderNumber: string | null = null;
  let tracking = input.data.trackingNumber;
  if (input.data.orderId) {
    const context = await fetchBookingContext(input.data.orderId);
    orderNumber = context?.orderNumber ?? null;
    tracking = tracking ?? context?.shipment?.trackingNumber ?? null;
  }

  const result = await createSupportCase(config, {
    subject: input.data.subject,
    description: input.data.description,
    trackingNumber: tracking ?? undefined,
    orderId: orderNumber ?? undefined,
    caseTemplateId: settings?.xspace_case_template_id ?? undefined,
    categoryId: settings?.xspace_category_id ?? undefined,
    platformName: settings?.platform_name ?? undefined,
    externalSellerId: settings?.external_seller_id ?? undefined,
    sellerName: settings?.origin_name ?? undefined,
    sellerEmail: settings?.origin_email ?? undefined,
    sellerPhoneNo: settings?.origin_phone_e164 ?? undefined,
  });
  await logDarazCall("support_case", input.data.orderId, result);
  if (!result.ok) return darazFailure(result);

  const { error } = await adminDb().rpc("admin_record_support_case", {
    p_provider: PROVIDER,
    p_case_id: result.data.caseId,
    p_order_id: input.data.orderId as string,
    p_tracking_number: tracking as string,
    p_subject: input.data.subject,
  });
  if (error) return { ok: false, message: `Daraz opened case ${result.data.caseId}, but Goreto couldn't save it. Note the case number.` };
  refresh();
  return { ok: true, message: `Support case ${result.data.caseId} opened with Daraz.` };
}

export async function supportCaseDetailAction(caseId: string): Promise<{ ok: true; detail: SupportCase } | { ok: false; message: string }> {
  const auth = await authorizeAdmin("orders.read");
  if (!auth.ok) return { ok: false, message: deniedResult(auth.reason).message ?? "" };
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(caseId)) return { ok: false, message: "Invalid case." };
  const config = darazConfig();
  if (!config) return { ok: false, message: "Daraz Express isn't connected yet." };
  const settings = await fetchDarazSettings();
  const result = await supportCaseDetail(config, {
    caseId: Number.isSafeInteger(Number(caseId)) ? Number(caseId) : caseId,
    platformName: settings?.platform_name ?? undefined,
    externalSellerId: settings?.external_seller_id ?? undefined,
  });
  if (!result.ok) return { ok: false, message: describeDarazError(result.error) };
  if (result.data.status) {
    await adminDb().rpc("admin_update_support_case", { p_provider: PROVIDER, p_case_id: caseId, p_status: result.data.status, p_rating: null as unknown as number });
  }
  return { ok: true, detail: result.data };
}

export async function rateDarazSupportCaseAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("orders.write", supportRatingSchema, formData);
  if (!input.ok) return input.result;
  const config = darazConfig();
  if (!config) return NOT_CONFIGURED;
  const settings = await fetchDarazSettings();
  const result = await rateSupportCase(config, {
    caseId: Number.isSafeInteger(Number(input.data.caseId)) ? Number(input.data.caseId) : input.data.caseId,
    ratingStar: input.data.rating,
    ratingRemark: input.data.remark ?? undefined,
    platformName: settings?.platform_name ?? undefined,
    externalSellerId: settings?.external_seller_id ?? undefined,
  });
  await logDarazCall("support_rating", null, result);
  if (!result.ok) return darazFailure(result);
  const { error } = await adminDb().rpc("admin_update_support_case", { p_provider: PROVIDER, p_case_id: input.data.caseId, p_status: null as unknown as string, p_rating: input.data.rating });
  if (error) return databaseErrorResult(error, "rate support case");
  refresh();
  return { ok: true, message: "Thanks. Your rating was sent to Daraz." };
}

/* ---------- Setup (delivery.manage) ---------- */

export async function saveDarazSettingsAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", darazSettingsSchema, formData);
  if (!input.ok) return input.result;
  const values = input.data;
  const { error } = await adminDb().rpc("admin_update_provider_account", {
    p_provider: PROVIDER,
    p_patch: {
      platform_name: values.platformName,
      external_seller_id: values.externalSellerId,
      origin_name: values.originName,
      origin_phone_e164: values.originPhone,
      origin_email: values.originEmail,
      origin_address_details: values.originAddressDetails,
      origin_daraz_address_id: values.originDarazAddressId,
      origin_latitude: values.originLatitude,
      origin_longitude: values.originLongitude,
      pickup_warehouse_code: values.pickupWarehouseCode,
      return_warehouse_code: values.returnWarehouseCode,
      solution_codes: values.solutionCodes,
      booking_endpoint: values.bookingEndpoint,
      default_delivery_option: values.defaultDeliveryOption,
      phone_format: values.phoneFormat,
      undeliverable_option: values.undeliverableOption,
      default_open_box: values.defaultOpenBox,
      declare_insurance: values.declareInsurance,
      auto_book: values.autoBook,
      default_weight_grams: values.defaultWeightGrams,
      default_item_category: values.defaultItemCategory,
      box_presets: values.boxPresets,
      xspace_case_template_id: values.xspaceCaseTemplateId,
      xspace_category_id: values.xspaceCategoryId,
    },
  });
  if (error) return saveErrorResult(error, "save Daraz settings");
  refresh();
  return { ok: true, message: "Daraz settings saved." };
}

async function authorizeSetup(): Promise<{ ok: true; config: DarazConfig; settings: DarazSettings } | { ok: false; result: ActionResult }> {
  const auth = await authorizeAdmin("delivery.manage");
  if (!auth.ok) return { ok: false, result: deniedResult(auth.reason) };
  const config = darazConfig();
  if (!config) return { ok: false, result: NOT_CONFIGURED };
  const settings = await fetchDarazSettings();
  if (!settings) return { ok: false, result: { ok: false, message: "Daraz settings aren't readable with your access." } };
  return { ok: true, config, settings };
}

export async function testDarazConnectionAction(): Promise<ActionResult> {
  const setup = await authorizeSetup();
  if (!setup.ok) return setup.result;
  const check = await checkConnection(setup.config);
  return check.ok ? { ok: true, message: check.detail } : { ok: false, message: check.detail };
}

export async function linkDarazAccountAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", darazLinkSchema, formData);
  if (!input.ok) return input.result;
  const setup = await authorizeSetup();
  if (!setup.ok) return setup.result;
  const { platform_name: platformName, external_seller_id: externalSellerId } = setup.settings;
  if (!platformName || !externalSellerId) return { ok: false, message: "Save the platform name and external seller ID first." };

  const result = await linkCustomerAccount(setup.config, { externalSellerId, platformName, otp: input.data.otp });
  await logDarazCall("link_account", null, result);
  if (!result.ok) return darazFailure(result);
  const { error } = await adminDb().rpc("admin_update_provider_account", { p_provider: PROVIDER, p_patch: { mark_linked: true } });
  if (error) return databaseErrorResult(error, "mark account linked");
  refresh();
  return { ok: true, message: "The store's DEX account is linked to Goreto." };
}

export async function saveDarazWarehouseAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const input = await authorizeAndParse("delivery.manage", darazWarehouseSchema, formData);
  if (!input.ok) return input.result;
  const setup = await authorizeSetup();
  if (!setup.ok) return setup.result;
  const settings = setup.settings;
  const code = input.data.kind === "pickup" ? settings.pickup_warehouse_code : settings.return_warehouse_code;
  const missing = [
    !settings.platform_name && "platform name",
    !settings.external_seller_id && "external seller ID",
    !code && `${input.data.kind} warehouse code`,
    !settings.origin_name && "contact name",
    !settings.origin_phone_e164 && "phone",
    !settings.origin_address_details && "address",
    !settings.origin_daraz_address_id && "Daraz location ID",
    settings.solution_codes.length === 0 && "solution codes",
  ].filter(Boolean);
  if (missing.length > 0) return { ok: false, message: `Save these first: ${missing.join(", ")}.` };

  const result = await saveWarehouse(
    setup.config,
    buildWarehouse({
      platformName: settings.platform_name!,
      externalSellerId: settings.external_seller_id!,
      kind: input.data.kind,
      warehouseCode: code!,
      warehouseName: `${settings.origin_name} (${input.data.kind === "pickup" ? "pickup" : "returns"})`.slice(0, 100),
      contactName: settings.origin_name!,
      phoneE164: settings.origin_phone_e164!,
      phoneFormat: settings.phone_format === "e164" ? "e164" : "national",
      email: settings.origin_email,
      darazAddressId: settings.origin_daraz_address_id!,
      addressDetails: settings.origin_address_details!,
      solutionCodes: settings.solution_codes,
    }),
  );
  await logDarazCall(`warehouse_${input.data.kind}`, null, result);
  if (!result.ok) return darazFailure(result);

  const { error } = await adminDb().rpc("admin_update_provider_account", {
    p_provider: PROVIDER,
    p_patch: input.data.kind === "pickup" ? { mark_pickup_synced: true } : { mark_return_synced: true },
  });
  if (error) return databaseErrorResult(error, "mark warehouse synced");
  refresh();
  const converted = result.data.convertedAddressId ? ` Daraz location ${result.data.convertedAddressId}.` : "";
  return { ok: true, message: `${input.data.kind === "pickup" ? "Pickup" : "Return"} warehouse saved with Daraz.${converted}` };
}
