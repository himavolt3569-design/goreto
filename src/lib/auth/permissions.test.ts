// @vitest-environment node
import { describe, expect, it } from "vitest";
import { profileHasPermission } from "./permissions";

describe("profileHasPermission", () => {
  it("gives the owner every permission", () => {
    expect(profileHasPermission({ role: "owner", permissions: [] }, "staff.manage")).toBe(true);
  });

  it("gives staff only their granted keys", () => {
    const staff = { role: "staff", permissions: ["catalog.read", "catalog.write"] } as const;
    expect(profileHasPermission(staff, "catalog.write")).toBe(true);
    expect(profileHasPermission(staff, "orders.read")).toBe(false);
  });

  it("gives customers nothing, even with stray permission rows", () => {
    expect(profileHasPermission({ role: "customer", permissions: ["orders.read"] }, "orders.read")).toBe(false);
  });
});
