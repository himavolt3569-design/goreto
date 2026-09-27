import { formatNpr } from "@/lib/money/format";
import { formatNepalPhone } from "@/lib/validation/phone";

/*
 * The order handoff a courier receives after acceptance (worklog §4.0): a
 * WhatsApp click-to-send (wa.me) message staff open and send themselves.
 * Built on the server from the order's snapshots, and only for accepted
 * orders; it carries what delivery needs and nothing else (no email, no
 * internal notes).
 */

export type CourierMessageInput = {
  storeName: string;
  orderNumber: string;
  recipientName: string;
  phoneE164: string;
  address: {
    street_landmark?: string;
    municipality_name?: string;
    ward?: number;
    district_name?: string;
    province_name?: string;
    postal_code?: string | null;
  };
  serviceName: string | null;
  codAmountPaisa: number;
  items: { title: string; variant: string | null; quantity: number }[];
};

/** Keeps the wa.me URL well under the length browsers and WhatsApp accept. */
const MAX_ITEM_LINES = 15;

export function formatCourierAddress(address: CourierMessageInput["address"]): string {
  const area = [address.municipality_name, address.ward ? `Ward ${address.ward}` : null].filter(Boolean).join(", ");
  const region = [address.district_name, address.province_name].filter(Boolean).join(", ");
  return [address.street_landmark, area, [region, address.postal_code].filter(Boolean).join(" ")]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildCourierMessage(input: CourierMessageInput): string {
  const items = input.items.slice(0, MAX_ITEM_LINES).map((item) => {
    const name = item.variant ? `${item.title} (${item.variant})` : item.title;
    return `• ${name} × ${item.quantity}`;
  });
  const hidden = input.items.length - items.length;
  if (hidden > 0) items.push(`• …and ${hidden} more ${hidden === 1 ? "item" : "items"}`);

  return [
    `New delivery from ${input.storeName}`,
    `Order #${input.orderNumber}`,
    "",
    `Recipient: ${input.recipientName}`,
    `Phone: ${formatNepalPhone(input.phoneE164)}`,
    `Address: ${formatCourierAddress(input.address)}`,
    input.serviceName ? `Service: ${input.serviceName}` : null,
    `Cash to collect: ${formatNpr(input.codAmountPaisa)}`,
    "",
    "Items:",
    ...items,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** `https://wa.me/<digits>` with an optional prefilled message. */
export function whatsappLink(phoneE164: string, text?: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}
