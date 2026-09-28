# Discovery phase 1: product search (`/search`)

First of five discovery phases (worklog §4.2): **1. Search** → 2. Quick view → 3. Collections → 4. Offers → 5. Product-page reviews, then a product-page type-size pass. Each phase gets its own prompt and approval.

## Goal

Make `/search` work. The header search form, the mobile-nav search, the footer "Shop" link and the "New Arrivals" nav link (`/search?sort=newest`) already point there and 404 today.

- Postgres search (AGENTS §13): exact title match first, then title prefix, then full-text relevance, with `pg_trgm` typo tolerance. Active products only.
- Query, category filter, price range, sort and page all live in the URL (§8), so results are shareable and refresh-safe, and the page works without JavaScript.
- With no query, `/search` is the "Shop all" listing, so the footer "Shop" and "New Arrivals" links make sense.

## Non-goals

- Autocomplete / suggestion dropdown (§13 calls it optional). The header form stays a plain GET form.
- Filters beyond category and price (size, colour, AR-ready, in-stock).
- Search analytics, synonyms, Nepali-script stemming.
- Quick view from results (phase 2).

## What I inspected

- `AGENTS.md` §3, §7, §8, §13, §22, §25; `worklog.md` §4.2.
- `designs/Goreto-designsystem.png` (search input, select, product card), `designs/goreto-home.png` (grid). There is no search screenshot.
- `prompts/goreto-categories.md` (grid, sort control and empty-state conventions this page reuses).
- Migrations: `catalog` (`products.search_vector` generated tsvector with weights A/B/C over title/short/description, GIN index, `products_title_trgm_idx`), `foundation` (`pg_trgm` in `extensions`), `storefront_reads` (security-definer read functions + explicit grants), `harden_grants`.
- `src/features/catalog/{queries,mappers,categories,category-sort,types,slug}.ts`, `src/lib/supabase/public.ts`.
- `src/components/store/{store-header,mobile-nav,product-card-actions}.tsx`, `src/components/store/category/category-sort.tsx`, `src/app/(store)/categories/[slug]/page.tsx`, `src/components/ui/{search-input,select,product-card,section-heading}.tsx`.
- `src/features/admin/search-input.ts` (`sanitizeSearch`, the admin's input bounding) and `features/admin/queries/search.ts`.
- `tests/db/harness.ts` (PGlite loads `pg_trgm`).
- Next docs: `03-file-conventions/page.md` (`searchParams` promise, dynamic), `04-functions/unstable_cache.md`.

## Decisions

1. **One SQL function, `public.search_products`** (new migration `<ts>_storefront_search.sql`):
   ```
   search_products(q text, category_slug text, min_price_paisa bigint, max_price_paisa bigint,
                   sort text, page_limit int, page_offset int)
   returns table (id, slug, title, category_id, base_price_paisa, is_bestseller,
                  is_limited_edition, published_at, cover_path, cover_alt, total_count bigint)
   ```
   - `security invoker`, `stable`, `set search_path = ''`. Runs as the caller, so RLS on `products`/`categories`/`product_media` still applies, and it also filters `status = 'active'` and active categories explicitly.
   - **Match** (when `q` is non-empty): `search_vector @@ websearch_to_tsquery('english', q)` OR a prefix tsquery built in SQL from `q`'s alphanumeric words (`word:*`, so "earr" finds earrings) OR `extensions.word_similarity(q, title) >= 0.4` (typos: "jhumka" / "earings") OR the product's category / parent category title matches the query words (so "necklace" finds products in Necklaces even if a title doesn't say it).
   - **Rank** (sort `relevance`): exact title (case-insensitive) → title starts with `q` → `ts_rank` weighted (title A beats description C) + trigram similarity on title → category match only. Ties: featured, newest, slug. Deterministic.
   - **Category filter**: top-level or sub-category slug; includes its subtree (recursive CTE).
   - **Price filter**: on `base_price_paisa`, the same price the card shows. Either bound optional.
   - **Sort**: `relevance` (default when `q` is set), `featured` (default when not), `newest`, `price-asc`, `price-desc`. Unknown → default.
   - Bounds inside SQL too: `q` trimmed to 64 chars, `page_limit` clamped 1–48, `page_offset` ≥ 0 and ≤ 10 000.
   - `total_count` via `count(*) over ()`, so one round-trip gives the page and the total.
   - Cover image: `left join lateral` first `product_media` by `sort_order`.
   - Grants per `harden_grants`: `revoke execute … from public`; `grant execute … to anon, authenticated, service_role`.
   - No new index: the GIN tsvector and trigram indexes exist. The category-match branch is a join over ~40 categories.

2. **URL contract** (`src/features/search/params.ts`, client-safe, pure, unit-tested):
   - `q`: sanitised with the same rules as the admin (`NFKC`, letters/digits/space and `'-.`, collapse spaces, max 64). I will move `sanitizeSearch` to `src/lib/validation/search.ts` and re-export from the admin module, so both share one rule.
   - `category`: must pass `isValidSlug`, else ignored.
   - `min` / `max`: whole rupees (what shoppers type), converted to paisa with integers only; non-numeric or negative ignored; swapped if `min > max`.
   - `sort`: whitelist; the default for the current mode is left out of URLs.
   - `page`: integer ≥ 1, capped at 200. 24 results per page.
   - `buildSearchHref(params, overrides)` builds links for pagination, "clear filter" chips and sort, always dropping `page` when a filter changes.

3. **Reads** (`src/features/search/queries.ts`, server-only): calls the RPC with the public anon client (no `auth()`, so no Clerk dependency), then `fetchRatings` for the page's ids (existing RPC) and maps to `ProductSummary` with the existing mapper helpers (category slug, `productMediaImage`). Wrapped in `unstable_cache` keyed by the normalised params, 60 s, tag `CATALOG_CACHE_TAG`, like the category listing, so admin edits still revalidate it.

4. **Page `src/app/(store)/search/page.tsx`** (server component, dynamic because it reads `searchParams`):
   - Breadcrumbs: Home › Search (or Home › Shop without a query).
   - `SectionHeading as="h1"`: eyebrow "Search", title `Results for "{q}"`; without a query: eyebrow "Shop", title "All Products" (or "New Arrivals" when `sort=newest`).
   - A large page search form (the existing `SearchInput`, prefilled, `name="q"`), carrying the other filters as hidden inputs so a new query keeps the category but resets the page.
   - **Filters** (`SearchFilters`, server-rendered GET form, same no-JS pattern as the category sort): on `lg`, a 256px left column; below `lg`, a `<details>` "Filters" disclosure above the grid. Contents: Category (Design-System `Select`: "All categories" + top-level categories with their children indented as in the admin tree), Price (two `Input`s, "Min Rs." / "Max Rs.", `inputMode="numeric"`), Apply (primary) and "Clear all" (text link).
   - **Toolbar**: result count ("128 products", `aria-live="polite"` region), active-filter chips (each a link that removes that filter, with an accessible name "Remove filter: Earrings"), and a sort control reusing the category page's pattern (`Select`, `router.replace`, Apply button only without JS). "Relevance" appears only when there is a query.
   - **Grid**: the category page grid and `ProductCard` with `WishlistSoonButton` / `ChooseOptionsLink`, unchanged.
   - **Pagination**: Previous / Next plus "Page 2 of 6", real `<a>` links, `rel="prev"/"next"`, disabled state as text. Out-of-range page → shows the empty state with a "Back to page 1" link, not a 404.
   - **Empty state** (dashed card like the category page): `No products match "{q}"`, a hint to check spelling or remove filters, "Clear filters" when filters are active, and "Browse all categories".
   - **Metadata**: title `Search: {q}` / "Shop all"; `robots: { index: false }` for query/filter variations (thin/duplicate content), indexable for bare `/search`.
   - `loading.tsx`: skeleton grid (neutral-100 blocks, no shimmer under reduced motion).

5. **Header**: the header search input shows the current `q` when on `/search`? No: the header is a server component shared by every page, and making it read the URL would add a client boundary. The page's own search form is the editable one. Header behaviour is unchanged.

6. **Tokens only**: container `max-w-7xl px-4 md:px-8`, gaps 16/24/32, radius `md` controls and `lg` cards, no off-scale values. Icons from `components/ui/icons.ts` (add `X`/`Funnel` there if not already listed).

## Files expected to change

```text
supabase/migrations/<ts>_storefront_search.sql        new: search_products + grants
src/types/database.ts                                 regenerated (npm run db:types)
src/lib/validation/search.ts                          new: sanitizeSearch (moved)
src/features/admin/search-input.ts                    re-exports sanitizeSearch
src/features/search/params.ts (+ params.test.ts)      new: URL parse/normalise/build
src/features/search/queries.ts                        new: RPC + ratings + mapping, cached
src/features/search/mappers.ts (+ test)               new: RPC row -> ProductSummary
src/app/(store)/search/page.tsx                       new
src/app/(store)/search/loading.tsx                    new
src/components/store/search/search-filters.tsx        new (server form)
src/components/store/search/search-sort.tsx           new, "use client"
src/components/store/search/active-filters.tsx        new
src/components/store/search/pagination.tsx            new
src/components/store/search/__tests__/*.test.tsx      sort control, filters, pagination
src/components/ui/icons.ts                            + any icon needed
tests/db/search.test.ts                               new
worklog.md                                            mark Search done
```

## Database / migration impact

- Additive: one function, no tables, no data change.
- Apply order: `npm run test:db` (PGlite) → `npm run db:push` (hosted dev) → `npm run db:types`.
- Rollback: `drop function public.search_products(...)` and revert the commit.

## Auth / RLS

- Public read. `security invoker`, so the anon role's existing RLS (active products, active categories, media of active products) is the guard; the function also filters by status. No service role, no `auth()`.
- `anon` and `authenticated` get `execute` explicitly; `public` is revoked.

## Validation and security

- All inputs are parsed and bounded in TypeScript (`params.ts`) and again clamped in SQL.
- The query is passed as an RPC parameter, never concatenated into PostgREST filter syntax or SQL. `websearch_to_tsquery` never raises on odd input; the prefix query is built only from `[a-z0-9]` words inside SQL.
- Price parsing is integer-only (no floats); paisa = rupees × 100 with a max of Rs 10,000,000.

## DB tests (`tests/db/search.test.ts`, as `anon`)

- Exact title ranks first ("Pearl Choker" → Pearl Choker is result 1).
- Prefix: "earr" returns earrings.
- Typo: "jhumkaa" / "earings" still return the jhumkas / earrings.
- Category word: "necklace" includes products from the Necklaces category.
- Draft and archived products never appear (flip one product to draft inside the test transaction).
- Category filter includes subcategories; price bounds are inclusive; sorts order correctly; `total_count` equals the unpaginated count; limit/offset clamps hold.
- Hostile input (`'); drop table products; --`, `%_`, `a:* & !b`, 5,000 chars) returns normally.
- `anon` can execute; the function exists with `search_path = ''`.

## Acceptance criteria

1. Typing "earrings" in the header and pressing Enter opens `/search?q=earrings` with earrings first and a correct count.
2. "Pearl Choker" returns Pearl Choker first; "jhumkaa" still finds the jhumkas.
3. Choosing a category and a price range, then Apply, updates the URL and the results; reload keeps them; each chip removes its filter.
4. Sort by price reorders and updates `?sort=`; Relevance is offered only with a query.
5. "New Arrivals" in the nav opens newest-first; footer "Shop" opens all products.
6. More than 24 results paginate; `?page=999` shows the empty state with "Back to page 1".
7. No results: helpful empty state with clear/browse actions.
8. With JavaScript off, search, filters, sort and pagination all work.
9. Keyboard: every control reachable with visible focus; chips and pagination have accessible names.
10. 375px: filters collapse into the disclosure, no horizontal scroll.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run db:push && npm run db:types
npm run build
npm run dev   # scratchpad playwright-core script: the acceptance list at 1280 and 375px, JS on and off
```

## Manual test steps

1. `npm run dev`, open `/`, search "earrings" in the header.
2. Search "Pearl Choker", then "jhumkaa".
3. Open Filters, choose Jewelry, min 1000, max 5000, Apply. Reload. Remove each chip.
4. Change sort to "Price: Low to High".
5. Click "New Arrivals", then footer "Shop"; page to 2 and back.
6. Search "zzzzqq" for the empty state; open `/search?page=999`.
7. Disable JavaScript in DevTools and repeat 1, 3 and 4.
8. Resize to 375px.

## Rollback

Revert the commit; drop the function (additive, no data affected).

## Changes made during execution

- **No `loading.tsx`.** A route loading boundary streams the real page into a hidden `<div>` that only JavaScript swaps in, which broke acceptance criterion 8 (no-JS). Removed; the page renders in one pass like the category page.
- **`scripting:` variant.** The `[.js_&]:hidden` class on the category page's no-JS "Apply" button never applied, because nothing sets a `.js` class since the inline script was replaced by `@media (scripting: enabled)`. Added `@custom-variant scripting` to `globals.css` and switched both the category and search sort controls to `scripting:hidden`. The category page's Apply button is now correctly hidden when JavaScript runs.
- **`ProductGrid`** (`src/components/store/product-grid.tsx`) extracted from the category page and reused by search (collections and offers will reuse it too).
- The page search form and the filters use `next/form` (client-side navigation, plain GET without JS). An empty price box still submits `min=`; the parser ignores it.
- Header search is unchanged, as planned.

### Verification

- `npm run typecheck`, `npm run lint` pass.
- `npm test`: 65 files, 480 tests. `npm run test:db`: 11 files, 251 tests (23 new in `tests/db/search.test.ts`).
- `npm run db:push` applied `20260930090000_storefront_search.sql` to hosted dev; `npm run db:types` regenerated `search_products`.
- `npm run build` passes; `/search` is dynamic.
- Scratchpad `playwright-core` script against `npm run dev`: 21/21 checks (header search, exact/typo ranking, filters + reload + chips, sort, New Arrivals, Shop, pagination, past-end page, empty state, chip focus ring, 375px no overflow, mobile filter disclosure, no-JS filter and sort submits, no console errors).
