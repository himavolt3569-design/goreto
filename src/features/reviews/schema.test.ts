import { describe, expect, it } from "vitest";
import { REVIEW_STATUS_DISPLAY, reviewFailureFromError, reviewFormSchema } from "./schema";

const valid = { rating: "4", title: "  Nice  ", body: "  Fits well and the fabric is soft.  " };

describe("reviewFormSchema", () => {
  it("parses a rating string to a number and trims text", () => {
    expect(reviewFormSchema.parse(valid)).toEqual({ rating: 4, title: "Nice", body: "Fits well and the fabric is soft." });
  });

  it.each(["", "0", "6", "4.5", "x"])("rejects rating %j", (rating) => {
    const result = reviewFormSchema.safeParse({ ...valid, rating });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose a star rating");
  });

  it("allows an empty title but caps it at 120", () => {
    expect(reviewFormSchema.safeParse({ ...valid, title: "" }).success).toBe(true);
    expect(reviewFormSchema.safeParse({ ...valid, title: "t".repeat(121) }).success).toBe(false);
  });

  it("needs 10 to 2000 characters of review after trimming", () => {
    expect(reviewFormSchema.safeParse({ ...valid, body: "  too short  " }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...valid, body: "x".repeat(10) }).success).toBe(true);
    expect(reviewFormSchema.safeParse({ ...valid, body: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("reviewFailureFromError", () => {
  it("explains the verified-buyer rule", () => {
    expect(reviewFailureFromError({ code: "42501", message: "not_a_verified_buyer" }).message).toMatch(/delivered/);
  });

  it("maps a lost session, a missing product and each limit", () => {
    expect(reviewFailureFromError({ code: "42501", message: "not_signed_in" }).message).toMatch(/Sign in/);
    expect(reviewFailureFromError({ code: "P0002", message: "product_not_found" }).message).toMatch(/no longer available/);
    expect(reviewFailureFromError({ code: "22023", message: "invalid_rating" }).fieldErrors).toHaveProperty("rating");
    expect(reviewFailureFromError({ code: "22023", message: "invalid_title" }).fieldErrors).toHaveProperty("title");
    expect(reviewFailureFromError({ code: "22023", message: "invalid_body" }).fieldErrors).toHaveProperty("body");
  });

  it("falls back to a generic message", () => {
    expect(reviewFailureFromError({ code: "XX000", message: "boom" })).toEqual({ ok: false, message: "Your review couldn't be saved. Please try again." });
  });
});

describe("REVIEW_STATUS_DISPLAY", () => {
  it("never says rejected to the customer", () => {
    expect(Object.values(REVIEW_STATUS_DISPLAY).map((status) => status.label)).toEqual(["Awaiting approval", "Published", "Not published"]);
  });
});
