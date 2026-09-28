import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AdminShell } from "@/components/admin/admin-shell";
import type { QuickAction } from "@/components/admin/header-menus";
import { loadAttentionItems, loadNotificationFeed } from "@/features/admin/attention";
import { ADMIN_NAV, canAccess } from "@/features/admin/nav";
import { initials } from "@/features/admin/format";
import { requireAdmin } from "@/lib/auth/profile";
import type { CurrentProfile } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin | Goreto.store" },
  robots: { index: false, follow: false },
};

function quickActions(profile: CurrentProfile): QuickAction[] {
  const candidates: [boolean, QuickAction][] = [
    [canAccess(profile, "catalog.write"), { label: "Add product", href: "/admin/products/new", icon: "add" }],
    [canAccess(profile, "orders.write"), { label: "New WhatsApp order", href: "/admin/orders/new", icon: "whatsapp" }],
    [canAccess(profile, "orders.read"), { label: "Review pending orders", href: "/admin/orders?status=pending_confirmation", icon: "orders" }],
    [canAccess(profile, "catalog.read"), { label: "Restock low inventory", href: "/admin/inventory?stock=low_stock", icon: "inventory" }],
    [canAccess(profile, "reviews.manage"), { label: "Moderate reviews", href: "/admin/reviews?status=pending", icon: "reviews" }],
    [true, { label: "View storefront", href: "/", icon: "store" }],
  ];
  return candidates.filter(([allowed]) => allowed).map(([, action]) => action);
}

/** Admin area (AGENTS §4.6, §9.2): owner and staff only; each page checks its own permission too. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  const [attention, notifications, user] = await Promise.all([
    loadAttentionItems(profile),
    loadNotificationFeed(profile),
    // The avatar is optional; a Clerk API failure falls back to initials.
    currentUser().catch(() => null),
  ]);

  const allowedHrefs = ADMIN_NAV.flatMap((group) => group.items)
    .filter((item) => canAccess(profile, item.access))
    .map((item) => item.href);
  const name = profile.fullName ?? profile.email ?? "Admin";

  return (
    <AdminShell
      allowedHrefs={allowedHrefs}
      attention={attention}
      notifications={notifications}
      profileId={profile.id}
      quickActions={quickActions(profile)}
      profile={{
        name,
        roleLabel: profile.role === "owner" ? "Store owner" : "Staff",
        imageUrl: user?.hasImage ? user.imageUrl : null,
        initials: initials(name) || "A",
      }}
    >
      {children}
    </AdminShell>
  );
}
