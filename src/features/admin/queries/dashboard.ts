import "server-only";
import { z } from "zod";
import type { ResolvedRange, ResolvedRevenueWindow } from "../date-range";
import type { OrderStatus } from "../order-transitions";
import { adminDb, fail, mediaUrl } from "./shared";

/* Dashboard and analytics reads (migration admin_operations aggregates). */

const totalsSchema = z.object({
  sales_paisa: z.coerce.number(),
  orders: z.coerce.number(),
  active_products: z.coerce.number(),
  customers: z.coerce.number(),
});

const kpisSchema = z.object({
  current: totalsSchema,
  previous: totalsSchema,
  daily: z.array(totalsSchema.extend({ day: z.string() })),
});

export type KpiTotals = z.infer<typeof totalsSchema>;
export type DashboardKpis = z.infer<typeof kpisSchema>;

export async function fetchDashboardKpis(range: ResolvedRange): Promise<DashboardKpis> {
  const { data, error } = await adminDb().rpc("admin_dashboard_kpis", {
    p_from: range.from,
    p_to: range.to,
    p_prev_from: range.prevFrom,
    p_prev_to: range.prevTo,
  });
  if (error) fail("dashboard kpis", error);
  return kpisSchema.parse(data);
}

export type RevenuePoint = { bucket: string; salesPaisa: number; orders: number };
export type RevenueSeries = { points: RevenuePoint[]; totalPaisa: number; previousTotalPaisa: number };

async function revenueBuckets(from: string, to: string, bucket: "day" | "month"): Promise<RevenuePoint[]> {
  const { data, error } = await adminDb().rpc("admin_revenue_series", { p_from: from, p_to: to, p_bucket: bucket });
  if (error) fail("revenue series", error);
  return data.map((row) => ({ bucket: row.bucket, salesPaisa: Number(row.sales_paisa), orders: row.orders }));
}

export async function fetchRevenueSeries(window: Pick<ResolvedRevenueWindow, "from" | "to" | "prevFrom" | "prevTo" | "bucket">): Promise<RevenueSeries> {
  const [points, previous] = await Promise.all([
    revenueBuckets(window.from, window.to, window.bucket),
    revenueBuckets(window.prevFrom, window.prevTo, window.bucket),
  ]);
  const sum = (rows: RevenuePoint[]) => rows.reduce((total, row) => total + row.salesPaisa, 0);
  return { points, totalPaisa: sum(points), previousTotalPaisa: sum(previous) };
}

const breakdownSchema = z.object({
  order_count: z.coerce.number(),
  sold_order_count: z.coerce.number(),
  sales_paisa: z.coerce.number(),
  discount_paisa: z.coerce.number(),
  delivery_fee_paisa: z.coerce.number(),
  aov_paisa: z.coerce.number(),
  units_sold: z.coerce.number(),
  guest_order_count: z.coerce.number(),
  buyer_count: z.coerce.number(),
  repeat_buyer_count: z.coerce.number(),
  status_counts: z.array(z.object({ status: z.string(), count: z.coerce.number() })),
  payment_totals: z.array(z.object({ status: z.string(), count: z.coerce.number(), total_paisa: z.coerce.number() })),
  top_products: z.array(
    z.object({ product_id: z.string().nullable(), title: z.string(), units: z.coerce.number(), revenue_paisa: z.coerce.number() }),
  ),
  categories: z.array(z.object({ title: z.string(), units: z.coerce.number(), revenue_paisa: z.coerce.number() })),
  provinces: z.array(z.object({ name: z.string(), orders: z.coerce.number(), revenue_paisa: z.coerce.number() })),
});

export type AnalyticsBreakdown = z.infer<typeof breakdownSchema>;

export async function fetchAnalyticsBreakdown(range: Pick<ResolvedRange, "from" | "to">): Promise<AnalyticsBreakdown> {
  const { data, error } = await adminDb().rpc("admin_analytics_breakdown", { p_from: range.from, p_to: range.to });
  if (error) fail("analytics breakdown", error);
  return breakdownSchema.parse(data);
}

export type AttentionCounts = {
  pendingOrders: number;
  pendingReviews: number;
  lowStockVariants: number;
  soldOutVariants: number;
};

export async function fetchAttentionCounts(): Promise<AttentionCounts> {
  const { data, error } = await adminDb().rpc("admin_attention_counts");
  if (error) fail("attention counts", error);
  const row = data[0];
  return {
    pendingOrders: row?.pending_orders ?? 0,
    pendingReviews: row?.pending_reviews ?? 0,
    lowStockVariants: row?.low_stock_variants ?? 0,
    soldOutVariants: row?.sold_out_variants ?? 0,
  };
}

export type RecentOrder = {
  orderNumber: string;
  createdAt: string;
  contactName: string;
  totalPaisa: number;
  status: OrderStatus;
  thumbnail: string | null;
  firstItemTitle: string | null;
};

export async function fetchRecentOrders(limit = 5): Promise<RecentOrder[]> {
  const { data, error } = await adminDb()
    .from("orders")
    .select("order_number, created_at, contact_name, total_paisa, status, order_items(image_path, product_title, created_at)")
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "order_items" })
    .limit(1, { referencedTable: "order_items" })
    .limit(limit);
  if (error) fail("recent orders", error);
  return data.map((row) => ({
    orderNumber: row.order_number,
    createdAt: row.created_at,
    contactName: row.contact_name,
    totalPaisa: row.total_paisa,
    status: row.status,
    thumbnail: mediaUrl(row.order_items[0]?.image_path),
    firstItemTitle: row.order_items[0]?.product_title ?? null,
  }));
}
