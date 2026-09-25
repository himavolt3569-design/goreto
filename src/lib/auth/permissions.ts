import type { Database } from "@/types/database";

export type ProfileRole = Database["public"]["Enums"]["profile_role"];
export type StaffPermission = Database["public"]["Enums"]["staff_permission"];

/** The signed-in user's profile as server code sees it (not the full row). */
export type CurrentProfile = {
  id: string;
  clerkUserId: string;
  fullName: string | null;
  email: string | null;
  role: ProfileRole;
  permissions: readonly StaffPermission[];
};

/**
 * Mirrors the database's `has_permission()`: the owner has every permission,
 * staff have the keys granted to them, customers have none. RLS remains the
 * enforcement; this lets server code fail early with a clear 403.
 */
export function profileHasPermission(
  profile: Pick<CurrentProfile, "role" | "permissions">,
  permission: StaffPermission,
): boolean {
  switch (profile.role) {
    case "owner":
      return true;
    case "staff":
      return profile.permissions.includes(permission);
    case "customer":
      return false;
    default: {
      const unreachable: never = profile.role;
      return unreachable;
    }
  }
}
