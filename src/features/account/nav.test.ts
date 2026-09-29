import { describe, expect, it } from "vitest";
import { ACCOUNT_NAV, isAccountNavActive } from "./nav";

describe("isAccountNavActive", () => {
  it("matches the overview only on /account", () => {
    expect(isAccountNavActive("/account", "/account")).toBe(true);
    expect(isAccountNavActive("/account/orders", "/account")).toBe(false);
  });

  it("matches a section and its subpages, not lookalike paths", () => {
    expect(isAccountNavActive("/account/orders", "/account/orders")).toBe(true);
    expect(isAccountNavActive("/account/orders/GRT123456", "/account/orders")).toBe(true);
    expect(isAccountNavActive("/account/orders-archive", "/account/orders")).toBe(false);
  });
});

describe("ACCOUNT_NAV", () => {
  it("has unique hrefs under /account", () => {
    const hrefs = ACCOUNT_NAV.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((href) => href === "/account" || href.startsWith("/account/"))).toBe(true);
  });
});
