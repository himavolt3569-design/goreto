import "server-only";
import { FEED_LIMIT, mapNotification, sortFeed, type NotificationFeed } from "../notifications";
import { adminDb, fail } from "./shared";

/* The signed-in admin's own notifications (RLS: recipient and orders.read). */

export async function fetchNotificationFeed(): Promise<NotificationFeed> {
  const [list, unread] = await Promise.all([
    adminDb()
      .from("notifications")
      .select("id, kind, title, body, href, created_at, read_at, orders(total_paisa, channel)")
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT),
    adminDb().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (list.error) fail("notifications", list.error);
  if (unread.error) fail("unread notifications", unread.error);
  return { items: sortFeed(list.data.map(mapNotification)), unreadCount: unread.count ?? 0 };
}

/** Marks one notification, or all of them, read. RLS limits it to the caller's own. */
export async function markNotificationsRead(id: string | null): Promise<void> {
  let query = adminDb().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (id) query = query.eq("id", id);
  const { error } = await query;
  if (error) fail("mark notifications read", error);
}
