// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import divisions from "@/data/nepal/divisions.json";
import municipalities from "@/data/nepal/municipalities.json";
import legacy from "../../../scripts/geo/legacy-municipalities.json";

vi.mock("server-only", () => ({}));
const { locateArea } = await import("./locate");

/*
 * The committed Nepal geography and the lookup over it. Expected wards were
 * read from the OpenStreetMap ward boundaries the data is built from.
 */

describe("src/data/nepal", () => {
  it("has every local level with the official ward total", () => {
    expect(divisions.provinces).toHaveLength(7);
    expect(divisions.districts).toHaveLength(77);
    expect(municipalities).toHaveLength(753);
    expect(municipalities.reduce((sum, item) => sum + item.wardCount, 0)).toBe(6743);
    expect(new Set(municipalities.map((item) => item.code)).size).toBe(753);
    const districtCodes = new Set(divisions.districts.map((district) => district.code));
    for (const item of municipalities) {
      expect(districtCodes.has(item.districtCode), item.code).toBe(true);
      expect(item.wardCount, item.code).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every code used before the full dataset", () => {
    const codes = new Set(municipalities.map((item) => item.code));
    for (const row of legacy) expect(codes.has(row.code), row.code).toBe(true);
  });
});

describe("locateArea", () => {
  it.each([
    ["Kathmandu Durbar Square", 27.7042, 85.3067, "bagmati", "kathmandu", "kathmandu-metropolitan-city", 24],
    ["Thamel", 27.7154, 85.3123, "bagmati", "kathmandu", "kathmandu-metropolitan-city", 26],
    ["Pokhara Lakeside", 28.2096, 83.9589, "gandaki", "kaski", "pokhara-metropolitan-city", 6],
    ["Biratnagar", 26.4525, 87.2718, "koshi", "morang", "biratnagar-metropolitan-city", 11],
    ["Dharan", 26.8125, 87.2836, "koshi", "sunsari", "dharan-sub-metropolitan-city", 9],
    ["Butwal", 27.7006, 83.4484, "lumbini", "rupandehi", "butwal-sub-metropolitan-city", 2],
    ["Dhangadhi", 28.6938, 80.5937, "sudurpashchim", "kailali", "dhangadhi-sub-metropolitan-city", 8],
  ])("places %s", async (_place, lat, lng, provinceCode, districtCode, municipalityCode, ward) => {
    const result = await locateArea(lat, lng);
    expect(result).toEqual({
      ok: true,
      area: expect.objectContaining({ provinceCode, districtCode, municipalityCode, ward }),
    });
  });

  it("gives Kathmandu's known postal code", async () => {
    const result = await locateArea(27.7154, 85.3123);
    expect(result.ok && result.area.postalCode).toBe("44600");
  });

  it("says when a point is outside Nepal or can't be placed", async () => {
    expect(await locateArea(28.61, 77.2)).toEqual({ ok: false, reason: "outside_nepal" });
    expect(await locateArea(26.73, 88.4)).toEqual({ ok: false, reason: "no_match" });
  });
});
