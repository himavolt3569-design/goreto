import { topology } from "topojson-server";
import { describe, expect, it } from "vitest";
import { buildAreaIndex, lookupArea, type BoundaryTopology } from "./area-lookup";

const square = (x: number, y: number, size: number): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ],
});

// Two local levels side by side; only part of the first has ward boundaries.
const fixture = topology({
  municipalities: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { c: "west-municipality" }, geometry: square(85, 27, 1) },
      { type: "Feature", properties: { c: "east-rural-municipality" }, geometry: square(86, 27, 1) },
    ],
  },
  wards: {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { m: "west-municipality", w: 1 }, geometry: square(85, 27, 0.5) },
      { type: "Feature", properties: { m: "west-municipality", w: 2 }, geometry: square(85.5, 27, 0.5) },
    ],
  },
} as never) as unknown as BoundaryTopology;

const index = buildAreaIndex(fixture);

describe("lookupArea", () => {
  it("returns the municipality and ward from a ward boundary", () => {
    expect(lookupArea(index, [85.25, 27.25])).toEqual({ municipalityCode: "west-municipality", ward: 1 });
    expect(lookupArea(index, [85.75, 27.25])).toEqual({ municipalityCode: "west-municipality", ward: 2 });
  });

  it("falls back to the municipality alone where no ward covers the point", () => {
    expect(lookupArea(index, [85.25, 27.75])).toEqual({ municipalityCode: "west-municipality", ward: null });
    expect(lookupArea(index, [86.5, 27.5])).toEqual({ municipalityCode: "east-rural-municipality", ward: null });
  });

  it("returns null outside every boundary", () => {
    expect(lookupArea(index, [84.5, 27.5])).toBeNull();
  });
});
