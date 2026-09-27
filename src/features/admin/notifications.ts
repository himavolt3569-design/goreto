import type { Database } from "@/types/database";

/*
 * Admin notification feed (worklog §4.0): one row per recipient, written by
 * the database when an order arrives (migration whatsapp_orders). The bell
 * refetches the feed from the server on every Realtime signal, so what it
 * shows always comes from the database, never from an event payload.
 */

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];
type OrderChannel = Database["public"]["Enums"]["order_channel"];

export const FEED_LIMIT = 20;

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
  /** The order's COD total and channel, when the order is still readable. */
  totalPaisa: number | null;
  channel: OrderChannel | null;
};

export type NotificationFeed = { items: NotificationItem[]; unreadCount: number };

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  created_at: string;
  read_at: string | null;
  orders: { total_paisa: number; channel: OrderChannel } | null;
};

export function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    // Links stay inside the admin (also a database check).
    href: row.href.startsWith("/admin") ? row.href : "/admin/orders",
    createdAt: row.created_at,
    read: row.read_at !== null,
    totalPaisa: row.orders?.total_paisa ?? null,
    channel: row.orders?.channel ?? null,
  };
}

/** Unread first, then newest first. */
export function sortFeed(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt));
}

/**
 * Unread items that weren't in the previous feed, newest first: what to
 * announce (and chime for) after a refetch. Nothing on the first load.
 */
export function newArrivals(previous: NotificationFeed | null, next: NotificationFeed): NotificationItem[] {
  if (!previous) return [];
  const seen = new Set(previous.items.map((item) => item.id));
  return next.items.filter((item) => !item.read && !seen.has(item.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function arrivalAnnouncement(arrivals: NotificationItem[]): string {
  if (arrivals.length === 0) return "";
  if (arrivals.length === 1) return arrivals[0]!.title;
  return `${arrivals.length} new order notifications. Latest: ${arrivals[0]!.title}`;
}
