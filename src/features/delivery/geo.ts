/*
 * Plain point-in-polygon geometry for the Nepal boundary lookup (AGENTS
 * §15.5). Coordinates are GeoJSON order: [longitude, latitude]. No imports,
 * so the build script in scripts/geo can use it too.
 */

export type Position = [number, number];
export type Ring = Position[];
/** Outer ring first, then holes. */
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];
export type BBox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

export function bboxOf(shape: MultiPolygon): BBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const polygon of shape) {
    for (const [lng, lat] of polygon[0] ?? []) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function inBBox([lng, lat]: Position, [minLng, minLat, maxLng, maxLat]: BBox): boolean {
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

/** Even-odd ray casting. Points exactly on an edge may land on either side. */
export function pointInRing([x, y]: Position, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: Position, polygon: Polygon): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((hole) => pointInRing(point, hole));
}

export function pointInMultiPolygon(point: Position, shape: MultiPolygon): boolean {
  return shape.some((polygon) => pointInPolygon(point, polygon));
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j]![0] + ring[i]![0]) * (ring[j]![1] - ring[i]![1]);
  }
  return Math.abs(area / 2);
}

/**
 * A point guaranteed to be inside the shape (unlike a centroid, which can
 * fall outside a crescent). Scans a horizontal line through the middle of the
 * largest polygon and returns the midpoint of its widest inside segment.
 */
export function interiorPoint(shape: MultiPolygon): Position {
  const polygon = [...shape].sort((a, b) => ringArea(b[0] ?? []) - ringArea(a[0] ?? []))[0];
  if (!polygon?.[0]?.length) throw new Error("interiorPoint: empty shape");
  const [minLng, minLat, maxLng, maxLat] = bboxOf([polygon]);

  for (const fraction of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) {
    const y = minLat + (maxLat - minLat) * fraction;
    const crossings: number[] = [];
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi > y !== yj > y) crossings.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
    crossings.sort((a, b) => a - b);
    let best: Position | null = null;
    let width = 0;
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const span = crossings[k + 1]! - crossings[k]!;
      if (span > width) {
        width = span;
        best = [(crossings[k]! + crossings[k + 1]!) / 2, y];
      }
    }
    if (best && pointInPolygon(best, polygon)) return best;
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}
