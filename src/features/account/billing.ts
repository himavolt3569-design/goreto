import type { OrderStatus } from "@/features/orders/tracking-model";

/*
 * How each order counts toward billing (AGENTS §4.9): billed = cash collected
 * on delivery; pending = COD still to collect on a live order; canceled,
 * refunded and failed collections count toward neither. The totals themselves
 * come from SQL (account_summary); this only labels rows.
 */

export type PaymentStatus = "pending" | "collected" | "failed" | "refunded";
export type BillingBucket = "billed" | "pending" | "excluded";

export type BillingLine = {
  bucket: BillingBucket;
  label: string;
  tone: "success" | "warning" | "neutral" | "error";
};

export function billingLine(status: OrderStatus, paymentStatus: PaymentStatus): BillingLine {
  switch (paymentStatus) {
    case "collected":
      return { bucket: "billed", label: "Paid", tone: "success" };
    case "refunded":
      return { bucket: "excluded", label: "Refunded", tone: "neutral" };
    case "failed":
      return { bucket: "excluded", label: "Not collected", tone: "error" };
    case "pending":
      return status === "canceled"
        ? { bucket: "excluded", label: "Canceled", tone: "neutral" }
        : { bucket: "pending", label: "Pay on delivery", tone: "warning" };
    default: {
      const unreachable: never = paymentStatus;
      throw new Error(`Unknown payment status ${String(unreachable)}`);
    }
  }
}
