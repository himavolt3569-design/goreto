/*
 * Customer account navigation (AGENTS §4.9), grouped so later sections
 * (Saved: wishlist, addresses; Profile: reviews, profile & security) slot in
 * without restructuring. Only built sections are listed.
 */

export type AccountNavIcon = "overview" | "orders" | "tracking" | "billing";

export type AccountNavItem = { label: string; href: string; icon: AccountNavIcon };
export type AccountNavGroup = { label: string; items: AccountNavItem[] };

export const ACCOUNT_NAV: AccountNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Overview", href: "/account", icon: "overview" }],
  },
  {
    label: "Orders",
    items: [
      { label: "Orders", href: "/account/orders", icon: "orders" },
      { label: "Tracking", href: "/account/tracking", icon: "tracking" },
      { label: "Billing", href: "/account/billing", icon: "billing" },
    ],
  },
];

/** `/account` matches only itself; sections match their subpages too. */
export function isAccountNavActive(pathname: string, href: string): boolean {
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}
