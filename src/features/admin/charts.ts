/*
 * Geometry for the hand-built SVG charts (sparklines, revenue overview).
 * Pure so it can be unit-tested; components only turn these into markup.
 */

export type Point = { x: number; y: number };

/** Maps `value` from [d0, d1] to [r0, r1]; a flat domain maps to the middle. */
export function scaleLinear(value: number, [d0, d1]: [number, number], [r0, r1]: [number, number]): number {
  if (d1 === d0) return (r0 + r1) / 2;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

/** Straight-segment line path. Empty for no points. */
export function linePath(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`).join(" ");
}

/** Closed area under a line down to `baseline`. */
export function areaPath(points: readonly Point[], baseline: number): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${linePath(points)} L${round(last.x)} ${round(baseline)} L${round(first.x)} ${round(baseline)} Z`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Clean axis ticks from 0 to at least `max`: steps of 1, 2, 2.5 or 5 x 10^n.
 * Returns [0] for an all-zero series.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!(max > 0)) return [0];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough)!;
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step * 0.001; tick += step) ticks.push(Math.round(tick * 1000) / 1000);
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

/** Points for a series across a box, with values scaled from 0 (or the series min) to max. */
export function seriesPoints(
  values: readonly number[],
  { width, height, padY = 0, fromZero = true }: { width: number; height: number; padY?: number; fromZero?: boolean },
): Point[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const min = fromZero ? 0 : Math.min(...values);
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: scaleLinear(value, [min, max], [height - padY, padY]),
  }));
}

/**
 * Compact rupee label for axis ticks, from paisa: 40K, 1.2L, 3Cr
 * (Nepali lakh/crore grouping, matching the "Rs. 1,24,580" style).
 */
export function compactRupees(paisa: number): string {
  const rupees = paisa / 100;
  const format = (value: number, suffix: string) =>
    `${value.toLocaleString("en-US", { maximumFractionDigits: value < 10 ? 1 : 0 })}${suffix}`;
  if (rupees >= 1e7) return format(rupees / 1e7, "Cr");
  if (rupees >= 1e5) return format(rupees / 1e5, "L");
  if (rupees >= 1e3) return format(rupees / 1e3, "K");
  return format(rupees, "");
}
