// @vitest-environment node
import { describe, expect, it } from "vitest";
import { arrivalAnnouncement, mapNotification, newArrivals, sortFeed, type NotificationFeed, type NotificationItem } from "./notifications";

const item = (id: string, createdAt: string, read = false, title = `Order ${id}`): NotificationItem => ({
  id,
  kind: "order_pending",
  title,
  body: "",
  href: `/admin/orders/${id}`,
  createdAt,
  read,
  totalPaisa: null,
  channel: "website",
});

const feed = (...items: NotificationItem[]): NotificationFeed => ({ items, unreadCount: items.filter((entry) => !entry.read).length });

describe("mapNotification", () => {
  it("keeps admin links, the order total and read state", () => {
    expect(
      mapNotification({
        id: "n1",
        kind: "order_auto_accepted",
        title: "Auto-accepted WhatsApp order #GT1",
        body: "Sita. Ready to send to Pathao.",
        href: "/admin/orders/GT1",
        created_at: "2026-09-27T10:00:00Z",
        read_at: null,
        orders: { total_paisa: 549900, channel: "whatsapp" },
      }),
    ).toMatchObject({ href: "/admin/orders/GT1", read: false, totalPaisa: 549900, channel: "whatsapp" });
  });

  it("never links outside the admin", () => {
    const row = { id: "n1", kind: "order_pending" as const, title: "x", body: "", href: "https://evil.example", created_at: "", read_at: "", orders: null };
    expect(mapNotification(row)).toMatchObject({ href: "/admin/orders", read: true, totalPaisa: null, channel: null });
  });
});

describe("sortFeed", () => {
  it("puts unread first, newest first within each group", () => {
    const sorted = sortFeed([item("a", "2026-09-27T09:00:00Z", true), item("b", "2026-09-27T08:00:00Z"), item("c", "2026-09-27T10:00:00Z")]);
    expect(sorted.map((entry) => entry.id)).toEqual(["c", "b", "a"]);
  });
});

describe("newArrivals", () => {
  it("announces only unread items that are new since the last load", () => {
    const before = feed(item("a", "2026-09-27T09:00:00Z"));
    const after = feed(item("a", "2026-09-27T09:00:00Z"), item("b", "2026-09-27T10:00:00Z", false, "New WhatsApp order #GT2"), item("c", "2026-09-27T11:00:00Z", true));
    const arrivals = newArrivals(before, after);
    expect(arrivals.map((entry) => entry.id)).toEqual(["b"]);
    expect(arrivalAnnouncement(arrivals)).toBe("New WhatsApp order #GT2");
  });

  it("stays quiet on the first load", () => {
    expect(newArrivals(null, feed(item("a", "2026-09-27T09:00:00Z")))).toEqual([]);
    expect(arrivalAnnouncement([])).toBe("");
  });

  it("summarises several arrivals", () => {
    const arrivals = [item("b", "2026-09-27T10:00:00Z", false, "New website order #GT2"), item("c", "2026-09-27T11:00:00Z", false, "New WhatsApp order #GT3")];
    expect(arrivalAnnouncement(newArrivals(feed(), feed(...arrivals)))).toBe("2 new order notifications. Latest: New WhatsApp order #GT3");
  });
});
