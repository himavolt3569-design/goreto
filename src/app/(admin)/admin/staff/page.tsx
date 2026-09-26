import type { Metadata } from "next";
import { ToggleForm } from "@/components/admin/action-forms";
import { EmptyState, PageHeader, Panel, TableScroll, tableClasses, tdClasses, thClasses, theadRowClasses } from "@/components/admin/admin-ui";
import { Pill } from "@/components/admin/status-pills";
import { RemoveStaffButton, RevokeInvitationButton } from "@/components/admin/staff-actions";
import { StaffInviteForm } from "@/components/admin/staff-invite-form";
import { EnvelopeSimpleIcon, UsersIcon } from "@/components/ui/icons";
import { setStaffPermissionAction } from "@/features/admin/actions/system";
import { requireAdminAccess } from "@/features/admin/auth";
import { formatDate } from "@/features/admin/format";
import { fetchStaff, fetchStaffInvitations } from "@/features/admin/queries/system";
import { isInvitationExpired, PERMISSION_GROUPS, permissionLabels } from "@/features/admin/staff-permissions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Roles & Permissions" };

/**
 * Owner-only (RLS: staff_permissions and staff_invitations are
 * owner-managed). Roles live in Postgres, never in Clerk metadata (AGENTS
 * §9.2); a Clerk invitation only delivers the sign-up link.
 */
export default async function StaffPage() {
  await requireAdminAccess("owner");
  const [staff, invitations] = await Promise.all([fetchStaff(), fetchStaffInvitations()]);
  const now = new Date();
  const members = staff.filter((member) => member.role === "staff");
  const owner = staff.find((member) => member.role === "owner");

  return (
    <>
      <PageHeader title="Roles & Permissions" description="Grant staff only the areas they work in. Changes apply on their next page load." />

      <Panel
        title="Invite staff"
        description="They become staff when they create their account with this email. If the email already has a customer account, they get staff access straight away."
      >
        <StaffInviteForm />
      </Panel>

      <Panel title="Pending invitations" description={`${invitations.length} ${invitations.length === 1 ? "invitation" : "invitations"}`}>
        {invitations.length === 0 ? (
          <EmptyState icon={EnvelopeSimpleIcon} title="No pending invitations" description="Invitations you send appear here until they're accepted." />
        ) : (
          <TableScroll label="Pending invitations">
            <table className={tableClasses}>
              <thead>
                <tr className={theadRowClasses}>
                  <th scope="col" className={thClasses}>Email</th>
                  <th scope="col" className={thClasses}>Starting permissions</th>
                  <th scope="col" className={thClasses}>Sent</th>
                  <th scope="col" className={thClasses}>Status</th>
                  <th scope="col" className={thClasses}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const labels = permissionLabels(invitation.permissions);
                  const expired = isInvitationExpired(invitation.expiresAt, now);
                  return (
                    <tr key={invitation.id}>
                      <td className={cn(tdClasses, "font-medium")}>{invitation.email}</td>
                      <td className={cn(tdClasses, "min-w-60 text-neutral-700")}>{labels.length ? labels.join(", ") : "None yet"}</td>
                      <td className={cn(tdClasses, "whitespace-nowrap text-neutral-700")}>{formatDate(invitation.createdAt)}</td>
                      <td className={cn(tdClasses, "whitespace-nowrap")}>
                        {expired ? (
                          <Pill tone="warning">Expired</Pill>
                        ) : (
                          <span className="text-neutral-700">Expires {formatDate(invitation.expiresAt)}</span>
                        )}
                      </td>
                      <td className={cn(tdClasses, "text-right")}>
                        <div className="flex justify-end">
                          <RevokeInvitationButton invitationId={invitation.id} email={invitation.email} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

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
          <EmptyState icon={UsersIcon} title="No staff yet" description="Invite someone above, and they appear here once they've created their account." />
        ) : (
          <TableScroll label="Staff permissions">
            <table className={cn(tableClasses, "min-w-[1520px]")}>
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
                  <th scope="col" rowSpan={2} className={cn(thClasses, "align-bottom")}>
                    <span className="sr-only">Actions</span>
                  </th>
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
                      <td className={cn(tdClasses, "text-right")}>
                        <div className="flex justify-end">
                          <RemoveStaffButton profileId={member.id} name={name} />
                        </div>
                      </td>
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
