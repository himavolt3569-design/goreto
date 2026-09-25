// @vitest-environment node
import { describe, expect, it } from "vitest";
import { profileInputFromClerkUser } from "./clerk-user";

function userJson(overrides: Record<string, unknown> = {}) {
  return {
    id: "user_123",
    object: "user",
    first_name: " Asha ",
    last_name: "Shrestha",
    primary_email_address_id: "idn_primary",
    email_addresses: [
      { id: "idn_other", email_address: "other@example.com", verification: { status: "verified" } },
      { id: "idn_primary", email_address: "Asha@Example.COM", verification: { status: "verified" } },
    ],
    primary_phone_number_id: "idn_phone",
    phone_numbers: [{ id: "idn_phone", phone_number: "+9779812345678", verification: { status: "verified" } }],
    updated_at: 1_790_000_000_000,
    ...overrides,
  };
}

function parse(overrides: Record<string, unknown> = {}) {
  const result = profileInputFromClerkUser(userJson(overrides));
  if (!result.ok) throw new Error(result.error);
  return result.input;
}

describe("profileInputFromClerkUser", () => {
  it("maps the primary verified email, name, phone and timestamp", () => {
    expect(parse()).toEqual({
      clerkUserId: "user_123",
      email: "asha@example.com",
      fullName: "Asha Shrestha",
      phoneE164: "+9779812345678",
      clerkUpdatedAt: new Date(1_790_000_000_000),
    });
  });

  it("drops an unverified primary email", () => {
    const input = parse({
      email_addresses: [
        { id: "idn_primary", email_address: "asha@example.com", verification: { status: "unverified" } },
      ],
    });
    expect(input.email).toBeNull();
  });

  it("drops the email when there is no primary address", () => {
    expect(parse({ primary_email_address_id: null }).email).toBeNull();
  });

  it("returns null for a missing name", () => {
    expect(parse({ first_name: null, last_name: "  " }).fullName).toBeNull();
  });

  it("keeps a single name part", () => {
    expect(parse({ last_name: null }).fullName).toBe("Asha");
  });

  it("drops a phone number the database would reject", () => {
    const input = parse({
      phone_numbers: [{ id: "idn_phone", phone_number: "9812345678", verification: null }],
    });
    expect(input.phoneE164).toBeNull();
  });

  it("returns null phone when there is none", () => {
    expect(parse({ primary_phone_number_id: null, phone_numbers: [] }).phoneE164).toBeNull();
  });

  it("rejects a payload without an id or timestamp", () => {
    const result = profileInputFromClerkUser({ email_addresses: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/id/);
  });

  it("rejects non-objects", () => {
    expect(profileInputFromClerkUser(null).ok).toBe(false);
  });
});
