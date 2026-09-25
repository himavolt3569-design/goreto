import type { CurrentProfile, StaffPermission } from "@/lib/auth/permissions";
import { profileHasPermission } from "@/lib/auth/permissions";

/*
 * Admin navigation (AGENTS §3.11, grouped as in designs/goreto-admin.png).
 * Visibility is UX only: every page re-checks its permission on the server
 * and RLS enforces it again.
 */

/** Who may open an item: any admin, a staff permission, or the owner only. */
export type AdminAccess = "admin" | "owner" | StaffPermission;

export type AdminNavIcon =
  | "dashboard"
  | "analytics"
  | "products"
  | "categories"
  | "inventory"
  | "media"
  | "orders"
  | "payments"
  | "coupons"
  | "customers"
  | "reviews"
  | "ar"
  | "promotions"
  | "content"
  | "staff"
  | "delivery"
  | "settings"
  | "support";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: AdminNavIcon;
  access: AdminAccess;
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: "dashboard", access: "admin" },
      { label: "Analytics", href: "/admin/analytics", icon: "analytics", access: "analytics.read" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: "products", access: "catalog.read" },
      { label: "Categories", href: "/admin/categories", icon: "categories", access: "catalog.read" },
      { label: "Inventory", href: "/admin/inventory", icon: "inventory", access: "catalog.read" },
      { label: "Media", href: "/admin/media", icon: "media", access: "catalog.read" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: "orders", access: "orders.read" },
      { label: "Payments", href: "/admin/payments", icon: "payments", access: "orders.read" },
      { label: "Coupons", href: "/admin/coupons", icon: "coupons", access: "promotions.manage" },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Customers", href: "/admin/customers", icon: "customers", access: "customers.read" },
      { label: "Reviews", href: "/admin/reviews", icon: "reviews", access: "reviews.manage" },
      { label: "AR Try-On", href: "/admin/ar", icon: "ar", access: "ar.manage" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Promotions", href: "/admin/promotions", icon: "promotions", access: "content.manage" },
      { label: "Content Management", href: "/admin/content", icon: "content", access: "content.manage" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Roles & Permissions", href: "/admin/staff", icon: "staff", access: "owner" },
      { label: "Delivery & Courier", href: "/admin/delivery", icon: "delivery", access: "delivery.manage" },
      { label: "Settings", href: "/admin/settings", icon: "settings", access: "settings.manage" },
      { label: "Support", href: "/admin/support", icon: "support", access: "admin" },
    ],
  },
];

type AccessProfile = Pick<CurrentProfile, "role" | "permissions">;

export function canAccess(profile: AccessProfile, access: AdminAccess): boolean {
  if (profile.role !== "owner" && profile.role !== "staff") return false;
  if (access === "admin") return true;
  if (access === "owner") return profile.role === "owner";
  return profileHasPermission(profile, access);
}

/** Groups with only the items this profile may open; empty groups are dropped. */
export function visibleNav(profile: AccessProfile): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => canAccess(profile, item.access)),
  })).filter((group) => group.items.length > 0);
}

/** `/admin` matches only itself; sections match their subpages too. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
