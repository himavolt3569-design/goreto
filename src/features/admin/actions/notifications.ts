"use server";

import { z } from "zod";
import { loadAttentionItems, loadNotificationFeed, type AttentionItem } from "../attention";
import { authorizeAdmin } from "../auth";
import type { NotificationFeed } from "../notifications";
import { markNotificationsRead } from "../queries/notifications";

/*
 * The header bell's live data. The bell calls loadBellAction whenever
 * Realtime says the caller's notifications changed (or on focus / polling),
 * so the feed and counts always come from the database under RLS.
 */

export type BellData = { feed: NotificationFeed | null; attention: AttentionItem[] | null };

export async function loadBellAction(): Promise<BellData | null> {
  const auth = await authorizeAdmin("admin");
  if (!auth.ok) return null;
  const [feed, attention] = await Promise.all([loadNotificationFeed(auth.profile), loadAttentionItems(auth.profile)]);
  return { feed, attention };
}

/** Marks one notification read (clicking it) or all of them (id null), then returns fresh bell data. */
export async function markNotificationsReadAction(id: string | null): Promise<BellData | null> {
  const auth = await authorizeAdmin("orders.read");
  if (!auth.ok) return null;
  const parsed = z.uuid().nullable().safeParse(id);
  if (!parsed.success) return null;
  try {
    await markNotificationsRead(parsed.data);
  } catch (error) {
    console.error("Marking notifications read failed", error instanceof Error ? error.message : error);
  }
  return loadBellAction();
}
