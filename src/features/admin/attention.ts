import "server-only";
import type { CurrentProfile } from "@/lib/auth/permissions";
import { canAccess } from "./nav";
import { fetchAttentionCounts } from "./queries/dashboard";
import { fetchNotificationFeed } from "./queries/notifications";
import type { NotificationFeed } from "./notifications";

/*
 * What the header bell shows: the order notification feed (owner and
 * orders.read staff) and the "needs attention" counts, each filtered by
 * permission. Loaded by the admin layout and refetched live by the bell.
 */

export type AttentionItem = {
  key: "orders" | "reviews" | "low_stock" | "sold_out";
  label: string;
  count: number;
  href: string;
};

/** null when the counts couldn't be loaded; the menu says so instead of showing zeros. */
export async function loadAttentionItems(profile: CurrentProfile): Promise<AttentionItem[] | null> {
  let counts;
  try {
    counts = await fetchAttentionCounts();
  } catch (error) {
    console.error("Admin notifications failed to load", error instanceof Error ? error.message : error);
    return null;
  }
  const candidates: [boolean, AttentionItem][] = [
    [
      canAccess(profile, "orders.read"),
      { key: "orders", label: "Orders awaiting acceptance", count: counts.pendingOrders, href: "/admin/orders?status=pending_confirmation" },
    ],
    [
      canAccess(profile, "reviews.manage"),
      { key: "reviews", label: "Reviews to moderate", count: counts.pendingReviews, href: "/admin/reviews?status=pending" },
    ],
    [
      canAccess(profile, "catalog.read"),
      { key: "low_stock", label: "Variants low on stock", count: counts.lowStockVariants, href: "/admin/inventory?stock=low_stock" },
    ],
    [
      canAccess(profile, "catalog.read"),
      { key: "sold_out", label: "Variants sold out", count: counts.soldOutVariants, href: "/admin/inventory?stock=sold_out" },
    ],
  ];
  return candidates.filter(([allowed]) => allowed).map(([, item]) => item);
}

/** null without orders.read (no feed at all) or when it couldn't be loaded. */
export async function loadNotificationFeed(profile: CurrentProfile): Promise<NotificationFeed | null> {
  if (!canAccess(profile, "orders.read")) return null;
  try {
    return await fetchNotificationFeed();
  } catch (error) {
    console.error("Admin notification feed failed to load", error instanceof Error ? error.message : error);
    return null;
  }
}
