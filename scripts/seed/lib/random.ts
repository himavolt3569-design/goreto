/**
 * Seeded randomness for the development seed. Never use `Math.random` in the
 * generator: every draw goes through an `Rng` so the output is reproducible.
 *
 * Each domain gets its own stream (`rngFor("orders")`), so adding a product
 * does not reshuffle every customer name generated after it.
 */

export const BASE_SEED = 20260924;

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  float(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Pick by relative weight; weights need not sum to 1. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  shuffle<T>(items: readonly T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  /** Standard normal draw (Box–Muller). */
  normal(): number;
  /** Poisson draw, used for daily order counts. */
  poisson(lambda: number): number;
};

/** 32-bit FNV-1a, used to derive stream seeds from labels. */
export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  // mulberry32
  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, max: number): number {
    if (max < min) throw new RangeError(`int(${min}, ${max}) has an empty range`);
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick() from an empty list");
    return items[Math.floor(next() * items.length)] as T;
  }

  function weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, weight] of entries) total += Math.max(0, weight);
    if (total <= 0) throw new RangeError("weighted() needs a positive weight");
    let roll = next() * total;
    for (const [value, weight] of entries) {
      roll -= Math.max(0, weight);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(next() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap] as T, copy[index] as T];
    }
    return copy;
  }

  function normal(): number {
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const limit = Math.exp(-lambda);
    let count = 0;
    let product = next();
    while (product > limit) {
      count += 1;
      product *= next();
    }
    return count;
  }

  return {
    next,
    int,
    float: (min, max) => min + next() * (max - min),
    chance: (probability) => next() < probability,
    pick,
    weighted,
    shuffle,
    sample: (items, count) => shuffle(items).slice(0, Math.max(0, count)),
    normal,
    poisson,
  };
}

/** An independent, reproducible stream for one part of the seed. */
export function rngFor(label: string): Rng {
  return createRng(hash32(`${BASE_SEED}:${label}`));
}
