import { describe, expect, it } from "vitest";
import { bboxOf, inBBox, interiorPoint, pointInMultiPolygon, pointInPolygon, type MultiPolygon, type Polygon } from "./geo";

const square = (x: number, y: number, size: number) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
] as [number, number][];

describe("point in polygon", () => {
  const withHole: Polygon = [square(0, 0, 10), square(4, 4, 2)];

  it("finds points inside and outside, and treats holes as outside", () => {
    expect(pointInPolygon([1, 1], withHole)).toBe(true);
    expect(pointInPolygon([11, 1], withHole)).toBe(false);
    expect(pointInPolygon([5, 5], withHole)).toBe(false);
  });

  it("checks every part of a multipolygon", () => {
    const shape: MultiPolygon = [[square(0, 0, 1)], [square(5, 5, 1)]];
    expect(pointInMultiPolygon([5.5, 5.5], shape)).toBe(true);
    expect(pointInMultiPolygon([3, 3], shape)).toBe(false);
  });

  it("builds a bounding box from the outer rings", () => {
    const box = bboxOf([[square(2, 3, 4)], [square(-1, 0, 1)]]);
    expect(box).toEqual([-1, 0, 6, 7]);
    expect(inBBox([6, 7], box)).toBe(true);
    expect(inBBox([6.1, 7], box)).toBe(false);
  });
});

describe("interiorPoint", () => {
  it("lands inside a U shape whose centre is outside", () => {
    const u: MultiPolygon = [
      [
        [
          [0, 0],
          [9, 0],
          [9, 9],
          [6, 9],
          [6, 3],
          [3, 3],
          [3, 9],
          [0, 9],
          [0, 0],
        ],
      ],
    ];
    expect(pointInMultiPolygon([4.5, 4.5], u)).toBe(false);
    expect(pointInMultiPolygon(interiorPoint(u), u)).toBe(true);
  });

  it("uses the largest part of a multipolygon", () => {
    const point = interiorPoint([[square(0, 0, 1)], [square(10, 10, 5)]]);
    expect(pointInMultiPolygon(point, [[square(10, 10, 5)]])).toBe(true);
  });
});
