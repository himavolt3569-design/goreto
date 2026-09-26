import type { StaffPermission } from "@/lib/auth/permissions";

/*
 * Staff permission labels, grouped like the admin nav, shared by the
 * permissions table and the invite form on /admin/staff.
 */

export const PERMISSION_GROUPS: { label: string; permissions: { key: StaffPermission; label: string }[] }[] = [
  { label: "Overview", permissions: [{ key: "analytics.read", label: "View analytics" }] },
  {
    label: "Catalog",
    permissions: [
      { key: "catalog.read", label: "View catalog" },
      { key: "catalog.write", label: "Edit catalog" },
      { key: "inventory.write", label: "Adjust stock" },
    ],
  },
  {
    label: "Sales",
    permissions: [
      { key: "orders.read", label: "View orders" },
      { key: "orders.write", label: "Fulfil orders" },
      { key: "promotions.manage", label: "Manage coupons" },
    ],
  },
  {
    label: "Customers",
    permissions: [
      { key: "customers.read", label: "View customers" },
      { key: "reviews.manage", label: "Moderate reviews" },
      { key: "ar.manage", label: "Manage AR" },
    ],
  },
  { label: "Content", permissions: [{ key: "content.manage", label: "Manage content" }] },
  {
    label: "System",
    permissions: [
      { key: "delivery.manage", label: "Manage delivery" },
      { key: "settings.manage", label: "Manage settings" },
      { key: "staff.manage", label: "Manage staff" },
    ],
  },
];

export const STAFF_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key)) as [
  StaffPermission,
  ...StaffPermission[],
];

const LABELS = new Map(PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => [permission.key, permission.label] as const)));

/** Labels in the table's order, for a list of granted keys. */
export function permissionLabels(keys: readonly StaffPermission[]): string[] {
  return STAFF_PERMISSION_KEYS.filter((key) => keys.includes(key)).map((key) => LABELS.get(key) ?? key);
}

/** A pending invitation past its expiry grants nothing (the database checks too). */
export function isInvitationExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
