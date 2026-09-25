import "server-only";
import type { Database } from "@/types/database";
import type { OrderStatus, PaymentStatus } from "../order-transitions";
import { adminDb, fail, PAGE_SIZE, pageRange, toPage, type Page } from "./shared";

/* Customers (customers.read) and their orders/reviews where the viewer may see them. */

type SummaryArgs = Database["public"]["Functions"]["admin_customer_summaries"]["Args"];

export const CUSTOMER_SORTS = ["newest", "billed", "orders", "recent_order"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export type CustomerRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  orderCount: number;
  billedPaisa: number;
  pendingPaisa: number;
  lastOrderAt: string | null;
};

export async function fetchCustomers(filter: { q: string; sort: CustomerSort; page: number }): Promise<Page<CustomerRow>> {
  const [start] = pageRange(filter.page);
  // The generated types can't express nullable SQL arguments; the function accepts a null search.
  const args = { p_search: filter.q || null, p_sort: filter.sort, p_limit: PAGE_SIZE, p_offset: start } as unknown as SummaryArgs;
  const { data, error } = await adminDb().rpc("admin_customer_summaries", args);
  if (error) fail("customers", error);
  const rows = data.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone_e164,
    createdAt: row.created_at,
    orderCount: row.order_count,
    billedPaisa: Number(row.billed_paisa),
    pendingPaisa: Number(row.pending_paisa),
    lastOrderAt: row.last_order_at,
  }));
  return toPage(rows, data[0] ? Number(data[0].total_count) : 0, filter.page);
}

export async function fetchCustomerProfile(customerId: string) {
  const { data, error } = await adminDb()
    .from("profiles")
    .select("id, full_name, email, phone_e164, role, created_at, deleted_at")
    .eq("id", customerId)
    .maybeSingle();
  if (error) fail("customer", error);
  return data;
}

export type CustomerAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  line: string;
  isDefault: boolean;
};

export async function fetchCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const { data, error } = await adminDb()
    .from("customer_addresses")
    .select(
      "id, label, recipient_name, phone_e164, ward, street_landmark, postal_code, is_default, nepal_provinces(name), nepal_districts(name), nepal_municipalities(name)",
    )
    .eq("user_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error) fail("customer addresses", error);
  return data.map((row) => ({
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone_e164,
    line: [
      row.street_landmark,
      `${row.nepal_municipalities?.name ?? ""}-${row.ward}`,
      row.nepal_districts?.name,
      row.nepal_provinces?.name,
      row.postal_code,
    ]
      .filter(Boolean)
      .join(", "),
    isDefault: row.is_default,
  }));
}

export type CustomerOrder = {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPaisa: number;
};

export async function fetchCustomerOrders(customerId: string): Promise<CustomerOrder[]> {
  const { data, error } = await adminDb()
    .from("orders")
    .select("order_number, created_at, status, payment_status, total_paisa")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });
  if (error) fail("customer orders", error);
  return data.map((row) => ({
    orderNumber: row.order_number,
    createdAt: row.created_at,
    status: row.status,
    paymentStatus: row.payment_status,
    totalPaisa: row.total_paisa,
  }));
}

export type CustomerReview = {
  id: string;
  rating: number;
  body: string;
  status: Database["public"]["Enums"]["review_status"];
  productTitle: string;
  createdAt: string;
};

export async function fetchCustomerReviews(customerId: string): Promise<CustomerReview[]> {
  const { data, error } = await adminDb()
    .from("reviews")
    .select("id, rating, body, status, created_at, products(title)")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail("customer reviews", error);
  return data.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    status: row.status,
    productTitle: row.products?.title ?? "Unknown product",
    createdAt: row.created_at,
  }));
}
