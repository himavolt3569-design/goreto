import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { AdminShell } from "@/components/admin/admin-shell";
import type { AttentionItem, QuickAction } from "@/components/admin/header-menus";
import { ADMIN_NAV, canAccess } from "@/features/admin/nav";
import { initials } from "@/features/admin/format";
import { fetchAttentionCounts } from "@/features/admin/queries/dashboard";
import { requireAdmin } from "@/lib/auth/profile";
import type { CurrentProfile } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin | Goreto.store" },
  robots: { index: false, follow: false },
};

async function attentionItems(profile: CurrentProfile): Promise<AttentionItem[] | null> {
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
      { key: "orders", label: "Orders awaiting confirmation", count: counts.pendingOrders, href: "/admin/orders?status=pending_confirmation" },
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

function quickActions(profile: CurrentProfile): QuickAction[] {
  const candidates: [boolean, QuickAction][] = [
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
  const [attention, user] = await Promise.all([attentionItems(profile), currentUser()]);

  const allowedHrefs = ADMIN_NAV.flatMap((group) => group.items)
    .filter((item) => canAccess(profile, item.access))
    .map((item) => item.href);
  const name = profile.fullName ?? profile.email ?? "Admin";

  return (
    <AdminShell
      allowedHrefs={allowedHrefs}
      attention={attention}
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
