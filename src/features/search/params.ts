import { isValidSlug } from "@/features/catalog/slug";
import { sanitizeSearch } from "@/lib/validation/search";

/*
 * `/search` URL contract (client-safe, no data). Everything a shopper can
 * change lives in the query string, so results are shareable and survive a
 * refresh (AGENTS §8, §13). Raw values are whitelisted or bounded here and
 * clamped again in SQL.
 */

export const SEARCH_PAGE_SIZE = 24;
export const SEARCH_MAX_PAGE = 200;
/** Rs 1 crore: far above any real price, small enough to stay an exact integer in paisa. */
export const SEARCH_MAX_PRICE_RUPEES = 10_000_000;

export const SEARCH_SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export type SearchSort = (typeof SEARCH_SORTS)[number]["value"];

export type SearchParams = {
  /** Sanitised query; "" lists every product. */
  q: string;
  /** Category slug (top-level or sub); includes its subcategories. */
  category: string | null;
  /** Whole rupees, as typed by the shopper. */
  minRupees: number | null;
  maxRupees: number | null;
  sort: SearchSort;
  /** 1-based. */
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

/** Relevance only means something with a query. */
export function defaultSearchSort(q: string): SearchSort {
  return q ? "relevance" : "featured";
}

export function searchSortOptions(q: string) {
  return SEARCH_SORTS.filter((option) => q || option.value !== "relevance");
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Whole rupees only: digits (commas allowed), no decimals or signs. */
function parseRupees(value: string | string[] | undefined): number | null {
  const raw = first(value)?.replace(/[,\s]/g, "");
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const rupees = Number(raw);
  return rupees <= SEARCH_MAX_PRICE_RUPEES ? rupees : null;
}

export function parseSearchParams(raw: RawParams): SearchParams {
  const q = sanitizeSearch(raw.q);

  const categoryRaw = first(raw.category);
  const category = categoryRaw && isValidSlug(categoryRaw) ? categoryRaw : null;

  let minRupees = parseRupees(raw.min);
  let maxRupees = parseRupees(raw.max);
  if (minRupees !== null && maxRupees !== null && minRupees > maxRupees) {
    [minRupees, maxRupees] = [maxRupees, minRupees];
  }

  const sortRaw = first(raw.sort);
  const sort =
    searchSortOptions(q).find((option) => option.value === sortRaw)?.value ?? defaultSearchSort(q);

  const pageRaw = first(raw.page);
  const pageNumber = pageRaw && /^\d{1,4}$/.test(pageRaw) ? Number(pageRaw) : 1;
  const page = Math.min(Math.max(pageNumber, 1), SEARCH_MAX_PAGE);

  return { q, category, minRupees, maxRupees, sort, page };
}

export function hasActiveFilters(params: SearchParams): boolean {
  return params.category !== null || params.minRupees !== null || params.maxRupees !== null;
}

/**
 * `/search?…` for `params` with `overrides` applied. Defaults are left out of
 * the URL, and any change other than the page itself goes back to page 1.
 */
export function buildSearchHref(params: SearchParams, overrides: Partial<SearchParams> = {}): string {
  const next = { ...params, ...overrides };
  if (!("page" in overrides)) next.page = 1;
  // A sort that no longer applies (relevance after clearing q) falls back.
  if (!searchSortOptions(next.q).some((option) => option.value === next.sort)) {
    next.sort = defaultSearchSort(next.q);
  }

  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.category) query.set("category", next.category);
  if (next.minRupees !== null) query.set("min", String(next.minRupees));
  if (next.maxRupees !== null) query.set("max", String(next.maxRupees));
  if (next.sort !== defaultSearchSort(next.q)) query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));

  const search = query.toString();
  return search ? `/search?${search}` : "/search";
}

export function rupeesToPaisa(rupees: number | null): number | null {
  return rupees === null ? null : rupees * 100;
}
