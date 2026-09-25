import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { Pill } from "@/components/admin/status-pills";
import { InfoIcon, UsersIcon } from "@/components/ui/icons";
import { ICON_SIZE_SM, ICON_WEIGHT_OUTLINE } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { setStaffPermissionAction } from "@/features/admin/actions/system";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDate } from "@/features/admin/format";
import { fetchStaff } from "@/features/admin/queries/system";
import type { StaffPermission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Roles & Permissions" };

const PERMISSION_GROUPS: { label: string; permissions: { key: StaffPermission; label: string }[] }[] = [
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

/**
 * Owner-only (RLS: staff_permissions is owner-managed). Roles live in
 * Postgres, never in Clerk metadata (AGENTS §9.2).
 */
export default async function StaffPage() {
  await requireAdminAccess("owner");
  const staff = await fetchStaff();
  const members = staff.filter((member) => member.role === "staff");
  const owner = staff.find((member) => member.role === "owner");

  return (
    <>
      <PageHeader title="Roles & Permissions" description="Grant staff only the areas they work in. Changes apply on their next page load." />

      <Card className="flex items-start gap-3 p-4">
        <InfoIcon aria-hidden="true" size={ICON_SIZE_SM} weight={ICON_WEIGHT_OUTLINE} className="mt-0.5 shrink-0 text-info-700" />
        <p className="text-body text-neutral-700">
          Inviting new staff and changing roles will arrive in a follow-up. For now, staff accounts are created by the store&apos;s trusted setup scripts.
        </p>
      </Card>

      {owner ? (
        <Panel title="Store owner" bodyClassName="px-6 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="font-medium text-neutral-900">{owner.fullName ?? owner.email ?? "Owner"}</span>
              <span className="text-small text-neutral-500">{owner.email}</span>
            </div>
            <Pill tone="primary">All permissions</Pill>
          </div>
        </Panel>
      ) : null}

      <Panel title="Staff" description={`${members.length} ${members.length === 1 ? "member" : "members"}`}>
        {members.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No staff yet" description="You're running the store on your own for now." />
        ) : (
          <TableScroll label="Staff permissions">
            <table className={cn(tableClasses, "min-w-[1400px]")}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" rowSpan={2} className={cn(thClasses, "sticky left-0 z-10 align-bottom")}>
                    Staff member
                  </th>
                  {PERMISSION_GROUPS.map((group) => (
                    <th key={group.label} scope="colgroup" colSpan={group.permissions.length} className={cn(thClasses, "text-center")}>
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr className={theadRowClasses}>
                  {PERMISSION_GROUPS.flatMap((group) =>
                    group.permissions.map((permission) => (
                      <th key={permission.key} scope="col" className={cn(thClasses, "whitespace-normal text-center")}>
                        {permission.label}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const name = member.fullName ?? member.email ?? "Staff member";
                  return (
                    <tr key={member.id}>
                      <th scope="row" className={cn(tdClasses, "sticky left-0 z-10 bg-white text-left font-normal")}>
                        <span className="flex flex-col">
                          <span className="font-medium">{name}</span>
                          <span className="text-small text-neutral-500">Since {formatDate(member.createdAt)}</span>
                        </span>
                      </th>
                      {PERMISSION_GROUPS.flatMap((group) =>
                        group.permissions.map((permission) => (
                          <td key={permission.key} className={cn(tdClasses, "text-center")}>
                            <div className="flex justify-center">
                              <ToggleForm
                                action={setStaffPermissionAction}
                                id={member.id}
                                checked={member.permissions.includes(permission.key)}
                                label={`${permission.label} for ${name}`}
                                extra={{ profileId: member.id, permission: permission.key }}
                              />
                            </div>
                          </td>
                        )),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>
    </>
  );
}
