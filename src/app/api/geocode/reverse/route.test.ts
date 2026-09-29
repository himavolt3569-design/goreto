// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { GET } = await import("./route");

const request = (query: string) => new NextRequest(`http://localhost/api/geocode/reverse?${query}`);

describe("GET /api/geocode/reverse", () => {
  it("returns the province, district, municipality and ward for a point", async () => {
    const response = await GET(request("lat=27.7042&lng=85.3067"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      provinceCode: "bagmati",
      districtCode: "kathmandu",
      municipalityCode: "kathmandu-metropolitan-city",
      ward: 24,
      postalCode: "44600",
    });
  });

  it("is 422 outside Nepal and 404 where nothing matches", async () => {
    expect((await GET(request("lat=40&lng=85"))).status).toBe(422);
    expect((await GET(request("lat=abc&lng=85"))).status).toBe(422);
    expect((await GET(request("lat=26.73&lng=88.4"))).status).toBe(404);
  });
});
