import { ClerkAPIResponseError } from "@clerk/nextjs/errors";
import { describe, expect, it } from "vitest";
import { classifyClerkInviteError, invitationSignUpUrl, staffInviteSchema, withJoinedPermissions } from "./staff-forms";
import { isInvitationExpired, permissionLabels } from "./staff-permissions";

describe("staffInviteSchema", () => {
  it("normalizes the email and de-duplicates permissions", () => {
    const parsed = staffInviteSchema.parse({ email: "  New.Staff@Example.COM ", permissions: "orders.read,orders.write,orders.read" });
    expect(parsed).toEqual({ email: "new.staff@example.com", permissions: ["orders.read", "orders.write"] });
  });

  it("accepts no permissions", () => {
    expect(staffInviteSchema.parse({ email: "a@example.com", permissions: "" }).permissions).toEqual([]);
    expect(staffInviteSchema.parse({ email: "a@example.com" }).permissions).toEqual([]);
  });

  it.each([
    ["", "Enter an email address"],
    ["not-an-email", "Enter a valid email address"],
    [`${"a".repeat(250)}@example.com`, "Use at most 254 characters"],
  ])("rejects %j", (email, message) => {
    const result = staffInviteSchema.safeParse({ email, permissions: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("rejects unknown permissions", () => {
    expect(staffInviteSchema.safeParse({ email: "a@example.com", permissions: "orders.read,owner" }).success).toBe(false);
  });
});

describe("withJoinedPermissions", () => {
  it("joins repeated checkboxes and keeps other fields", () => {
    const formData = new FormData();
    formData.append("email", "a@example.com");
    formData.append("permissions", "orders.read");
    formData.append("permissions", "catalog.read");
    const joined = withJoinedPermissions(formData);
    expect(joined.get("email")).toBe("a@example.com");
    expect(joined.getAll("permissions")).toEqual(["orders.read,catalog.read"]);
  });
});

describe("classifyClerkInviteError", () => {
  const clerkError = (status: number, code: string) =>
    new ClerkAPIResponseError("Clerk", { status, data: [{ code, message: code, long_message: code, meta: {} }] });

  it("recognizes an existing account or invitation", () => {
    expect(classifyClerkInviteError(clerkError(422, "form_identifier_exists"))).toBe("exists");
    expect(classifyClerkInviteError(clerkError(400, "duplicate_record"))).toBe("exists");
  });

  it("recognizes rate limiting, and treats anything else as unknown", () => {
    expect(classifyClerkInviteError(clerkError(429, "too_many_requests"))).toBe("rate_limited");
    expect(classifyClerkInviteError(clerkError(500, "internal"))).toBe("unknown");
    expect(classifyClerkInviteError(new Error("network"))).toBe("unknown");
  });
});

describe("staff permission helpers", () => {
  it("labels permissions in table order", () => {
    expect(permissionLabels(["orders.write", "analytics.read"])).toEqual(["View analytics", "Fulfil orders"]);
  });

  it("treats an invitation as expired at its expiry time", () => {
    const now = new Date("2026-09-26T12:00:00Z");
    expect(isInvitationExpired("2026-09-26T12:00:00Z", now)).toBe(true);
    expect(isInvitationExpired("2026-09-26T12:00:01Z", now)).toBe(false);
  });
});

describe("invitationSignUpUrl", () => {
  it("uses the configured site in every environment", () => {
    expect(invitationSignUpUrl({ configured: " https://goreto.store ", requestOrigin: "https://evil.example", isProduction: true })).toBe(
      "https://goreto.store/sign-up",
    );
    expect(invitationSignUpUrl({ configured: "https://goreto.store", requestOrigin: "http://localhost:3000", isProduction: false })).toBe(
      "https://goreto.store/sign-up",
    );
  });

  it("never falls back to the request Origin in production", () => {
    expect(invitationSignUpUrl({ configured: undefined, requestOrigin: "https://evil.example", isProduction: true })).toBeNull();
    expect(invitationSignUpUrl({ configured: "  ", requestOrigin: "https://evil.example", isProduction: true })).toBeNull();
  });

  it("falls back to the request Origin outside production", () => {
    expect(invitationSignUpUrl({ configured: undefined, requestOrigin: "http://localhost:3000", isProduction: false })).toBe(
      "http://localhost:3000/sign-up",
    );
    expect(invitationSignUpUrl({ configured: undefined, requestOrigin: null, isProduction: false })).toBeNull();
    expect(invitationSignUpUrl({ configured: "not a url", requestOrigin: null, isProduction: false })).toBeNull();
  });
});
