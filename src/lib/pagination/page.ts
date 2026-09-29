/*
 * Offset pagination for `?page=` lists read with PostgREST `.range()`.
 * Shared by the admin tables and the customer account.
 */

export const DEFAULT_PAGE_SIZE = 20;

/** `?page=` as a 1-based page number (invalid or missing -> 1). */
export function pageNumber(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value >= 1 && value <= 10_000 ? value : 1;
}

/** Inclusive row range for `.range()`. */
export function pageRange(page: number, size = DEFAULT_PAGE_SIZE): [number, number] {
  const start = (page - 1) * size;
  return [start, start + size - 1];
}

export type Page<T> = { rows: T[]; total: number; page: number; pageCount: number };

export function toPage<T>(rows: T[], total: number | null, page: number, size = DEFAULT_PAGE_SIZE): Page<T> {
  const count = total ?? rows.length;
  return { rows, total: count, page, pageCount: Math.max(1, Math.ceil(count / size)) };
}
