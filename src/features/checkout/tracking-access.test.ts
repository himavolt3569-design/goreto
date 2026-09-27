// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { createTrackingSecret, hashTrackingSecret, isOrderNumber, isTrackingSecret, trackingLinkPath } = await import(
  "./tracking-access"
);

describe("tracking access", () => {
  it("creates URL-safe secrets the validator accepts", () => {
    const secret = createTrackingSecret();
    expect(secret).toHaveLength(32);
    expect(isTrackingSecret(secret)).toBe(true);
    expect(createTrackingSecret()).not.toBe(secret);
  });

  it("hashes like the database (sha256 hex of UTF-8)", () => {
    expect(hashTrackingSecret("test-secret-0123456789abcdef")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashTrackingSecret("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("validates order numbers and secrets", () => {
    expect(isOrderNumber("GT250318123456")).toBe(true);
    expect(isOrderNumber("gt250318")).toBe(false);
    expect(isOrderNumber("GT25' or 1=1")).toBe(false);
    expect(isTrackingSecret("short")).toBe(false);
    expect(isTrackingSecret("has spaces in it 1234567")).toBe(false);
  });

  it("builds the tracking link", () => {
    expect(trackingLinkPath("GT250318123456", "abc_DEF-1234567890")).toBe(
      "/track/GT250318123456/access?code=abc_DEF-1234567890",
    );
  });
});
