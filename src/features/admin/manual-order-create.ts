import "server-only";
import { z } from "zod";
import { GENERIC_FAILURE } from "@/features/checkout/errors";
import type { Database } from "@/types/database";
import { manualOrderFailure, type ManualOrder, type ManualOrderFailure } from "./manual-order-forms";
import { adminDb } from "./queries/shared";

/*
 * Saves a staff-entered order through admin_create_order, which prices it,
 * checks stock and permissions again, and accepts it when WhatsApp
 * auto-accept is on. Shared by New WhatsApp order and Send & track; callers
 * authorize (orders.write) and parse the form first.
 */

const createdSchema = z.object({
  order_id: z.uuid(),
  order_number: z.string().regex(/^[A-Z]{2,4}[0-9]{6,14}$/),
  status: z.enum(["pending_confirmation", "confirmed", "processing", "packed", "shipped", "delivered", "canceled"]),
});

export type CreatedOrder = { ok: true; orderId: string; orderNumber: string; status: Database["public"]["Enums"]["order_status"] };

export async function insertManualOrder(order: ManualOrder): Promise<CreatedOrder | ManualOrderFailure> {
  // customer_id and the WhatsApp number are nullable in SQL; the generated type can't say so.
  const { data, error } = await adminDb().rpc("admin_create_order", {
    p_items: order.items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
    p_contact: { name: order.fullName, email: order.email, phone_e164: order.phone },
    p_address: {
      province_code: order.provinceCode,
      district_code: order.districtCode,
      municipality_code: order.municipalityCode,
      ward: order.ward,
      street_landmark: order.streetLandmark,
      postal_code: order.postalCode || null,
    },
    p_courier_service_id: order.courierServiceId,
    p_coupon_code: order.couponCode,
    p_customer_note: order.note,
    p_customer_id: order.customerId,
    p_whatsapp_e164: order.whatsappE164,
  } as Database["public"]["Functions"]["admin_create_order"]["Args"]);
  if (error) {
    const failure = manualOrderFailure(error);
    if (failure.message === GENERIC_FAILURE) console.error("admin_create_order failed", error.code);
    return failure;
  }

  const created = createdSchema.safeParse(data);
  if (!created.success) {
    console.error("admin_create_order returned an unexpected payload");
    return { ok: false, message: GENERIC_FAILURE };
  }
  return { ok: true, orderId: created.data.order_id, orderNumber: created.data.order_number, status: created.data.status };
}
