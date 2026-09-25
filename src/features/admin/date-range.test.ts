// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, daySpan, isIsoDate, resolveRange, resolveRevenueWindow, todayInKathmandu } from "./date-range";

describe("todayInKathmandu", () => {
  it("uses the Kathmandu date, not UTC", () => {
    // 20:00 UTC on Sep 30 is 01:45 on Oct 1 in Kathmandu (UTC+5:45).
    expect(todayInKathmandu(new Date("2026-09-30T20:00:00Z"))).toBe("2026-10-01");
    expect(todayInKathmandu(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09-30");
  });
});

describe("day arithmetic", () => {
  it("validates real calendar dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-9-1")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daySpan("2026-09-01", "2026-09-30")).toBe(30);
  });
});

describe("resolveRange", () => {
  const today = "2026-09-25";

  it("defaults to the current month compared with the same days of last month", () => {
    expect(resolveRange({}, today)).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
      prevFrom: "2026-08-01",
      prevTo: "2026-08-25",
      compareLabel: "vs last month",
      label: "Sep 1, 2026 – Sep 30, 2026",
      preset: "this_month",
    });
  });

  it("compares January with the previous December", () => {
    expect(resolveRange({ from: "2026-01-01", to: "2026-01-31" }, today)).toMatchObject({
      prevFrom: "2025-12-01",
      prevTo: "2025-12-31",
      compareLabel: "vs last month",
    });
  });

  it("compares a calendar year with the same days of the previous year", () => {
    expect(resolveRange({ from: "2026-01-01", to: "2026-12-31" }, today)).toMatchObject({
      prevFrom: "2025-01-01",
      prevTo: "2025-09-25",
      compareLabel: "vs last year",
      preset: "this_year",
    });
  });

  it("compares a custom range with the same number of days before it", () => {
    expect(resolveRange({ from: "2026-09-10", to: "2026-09-19" }, today)).toMatchObject({
      prevFrom: "2026-08-31",
      prevTo: "2026-09-09",
      compareLabel: "vs previous period",
      preset: null,
    });
  });

  it("caps the comparison of an in-progress range at the elapsed days", () => {
    expect(resolveRange({ from: "2026-09-20", to: "2026-09-29" }, today)).toMatchObject({
      prevFrom: "2026-09-10",
      prevTo: "2026-09-15",
      compareLabel: "vs previous period",
    });
    // Past the end of a shorter previous month: keep the month's end.
    expect(resolveRange({ from: "2026-03-01", to: "2026-03-31" }, "2026-03-30")).toMatchObject({
      prevFrom: "2026-02-01",
      prevTo: "2026-02-28",
    });
    // Not yet started: the full previous period.
    expect(resolveRange({ from: "2026-10-01", to: "2026-10-31" }, today)).toMatchObject({
      prevFrom: "2026-09-01",
      prevTo: "2026-09-30",
    });
  });

  it("recognises rolling presets", () => {
    expect(resolveRange({ from: "2026-08-27", to: "2026-09-25" }, today).preset).toBe("last_30");
  });

  it("falls back to this month for invalid, reversed or oversized ranges", () => {
    for (const params of [
      { from: "2026-09-30", to: "2026-09-01" },
      { from: "nope", to: "2026-09-01" },
      { from: "2020-01-01", to: "2026-09-01" },
      { from: ["2026-09-01", "x"], to: undefined },
    ]) {
      expect(resolveRange(params, today).from).toBe("2026-09-01");
    }
  });
});

describe("resolveRevenueWindow", () => {
  const today = "2026-09-25";

  it("defaults to the last 30 days by day", () => {
    expect(resolveRevenueWindow(undefined, today)).toMatchObject({
      window: "30d",
      from: "2026-08-27",
      to: "2026-09-25",
      prevFrom: "2026-07-28",
      prevTo: "2026-08-26",
      bucket: "day",
    });
  });

  it("uses months for the last 12 months", () => {
    expect(resolveRevenueWindow("12m", today)).toMatchObject({
      from: "2025-10-01",
      prevFrom: "2024-10-01",
      prevTo: "2025-09-30",
      bucket: "month",
    });
  });

  it("ignores unknown windows", () => {
    expect(resolveRevenueWindow("5y", today).window).toBe("30d");
  });
});
