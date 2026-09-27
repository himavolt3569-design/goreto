import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { markNotificationsReadAction } from "@/features/admin/actions/notifications";
import type { AttentionItem } from "@/features/admin/attention";
import type { NotificationFeed } from "@/features/admin/notifications";
import { bellLabel, NotificationsMenu } from "../notifications-menu";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
vi.mock("@/lib/supabase/browser", () => ({ useBrowserSupabase: () => null }));
vi.mock("@/features/admin/actions/notifications", () => ({
  loadBellAction: vi.fn(async () => null),
  markNotificationsReadAction: vi.fn(async () => null),
}));

const feed: NotificationFeed = {
  unreadCount: 1,
  items: [
    {
      id: "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80",
      kind: "order_pending",
      title: "New WhatsApp order #GT260927123456",
      body: "Sita Gurung",
      href: "/admin/orders/GT260927123456",
      createdAt: new Date().toISOString(),
      read: false,
      totalPaisa: 549900,
      channel: "whatsapp",
    },
    {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "order_auto_accepted",
      title: "Auto-accepted website order #GT260926000001",
      body: "Web Shopper. Ready to send to Pathao.",
      href: "/admin/orders/GT260926000001",
      createdAt: "2026-09-26T08:00:00Z",
      read: true,
      totalPaisa: 120000,
      channel: "website",
    },
  ],
};

const attention: AttentionItem[] = [{ key: "orders", label: "Orders awaiting acceptance", count: 1, href: "/admin/orders?status=pending_confirmation" }];

beforeEach(() => vi.mocked(markNotificationsReadAction).mockClear());

describe("bellLabel", () => {
  it("names new orders and attention counts, or says nothing is new", () => {
    expect(bellLabel(2, 5)).toBe("Notifications: 2 new order notifications, 5 items need attention");
    expect(bellLabel(1, 0)).toBe("Notifications: 1 new order notification");
    expect(bellLabel(0, 0)).toBe("Notifications: nothing new");
    expect(bellLabel(0, null)).toBe("Notifications: counts couldn't load");
  });
});

describe("NotificationsMenu", () => {
  it("lists order notifications with totals and marks one read when opened", async () => {
    render(<NotificationsMenu profileId="p1" initialFeed={feed} initialAttention={attention} />);
    fireEvent.click(screen.getByRole("button", { name: /1 new order notification/ }));

    const [unread, read] = screen.getAllByRole("menuitem");
    expect(unread).toHaveTextContent("New WhatsApp order #GT260927123456 (new)");
    expect(unread).toHaveAttribute("href", "/admin/orders/GT260927123456");
    expect(unread).toHaveTextContent("Rs. 5,499 COD");
    expect(read).toHaveTextContent("Auto-accepted website order");
    expect(read).not.toHaveTextContent("(new)");
    expect(screen.getByRole("menuitem", { name: /Orders awaiting acceptance/ })).toHaveTextContent("1");

    fireEvent.click(unread!);
    await waitFor(() => expect(markNotificationsReadAction).toHaveBeenCalledWith(feed.items[0]!.id));
  });

  it("marks everything read", async () => {
    render(<NotificationsMenu profileId="p1" initialFeed={feed} initialAttention={attention} />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark all as read" }));
    await waitFor(() => expect(markNotificationsReadAction).toHaveBeenCalledWith(null));
  });

  it("shows only the counts to admins without orders.read, and says when they failed", () => {
    const { unmount } = render(<NotificationsMenu profileId="p1" initialFeed={null} initialAttention={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications: nothing new" }));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /sound/ })).not.toBeInTheDocument();

    unmount();

    render(<NotificationsMenu profileId="p1" initialFeed={null} initialAttention={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications: counts couldn't load" }));
    expect(screen.getByText(/Couldn.t load the counts/)).toBeInTheDocument();
  });
});
