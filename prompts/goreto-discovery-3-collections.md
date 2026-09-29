# Discovery phase 3: collections (`/collections`, `/collections/[slug]`)

Third of five discovery phases (worklog §4.2): 1. Search ✅ → 2. Quick view ✅ → **3. Collections** → 4. Offers → 5. Product-page reviews. Each phase gets its own prompt and approval.

## Goal

Make the collection links work. The header/mobile nav "Collections" link (`src/config/site.ts`) and every homepage carousel "Explore the Collection" button point to `/collections` and `/collections/[slug]`, and both 404 today.

- `/collections`: every live collection (active and inside its `starts_at`/`ends_at` window) as a card with its photo, eyebrow, title, description and product count.
- `/collections/[slug]`: the collection banner, then its products in the **curated order** staff set in the admin collection editor, with the same sort control and grid as a category page. Product cards open the quick view (phase 2) like every other grid.
- Admin edits to a collection (content, schedule, product list) show on the storefront at once, like categories.

## Non-goals

- No migration, no new RPC. The existing tables, RLS and grants cover the reads.
- No pagination on a collection page. The admin editor caps a collection at 200 products (`admin_save_collection`); seed collections hold about 12.
- No filters beyond sort, no "ends in N days" countdown, no collection SEO fields.
- No change to the homepage carousel's behaviour or look.
- `collection_products` is readable by `anon` with `using (true)`, so a link to a draft product exposes that product's uuid (never its data). It's pre-existing and out of scope; noted under "Needs your attention".

## What I inspected

- `AGENTS.md` §3, §4.1, §4.3, §8, §18.7, §22, §25; `worklog.md` §4.2; `prompts/goreto-discovery-1-search.md`, `goreto-discovery-2-quick-view.md`, `goreto-categories.md`, `goreto-admin-categories-collections.md`.
- `designs/goreto-home.png` (collection banner) and `Goreto-designsystem.png` (cards, badges). There is no collections screenshot.
- Migrations: `catalog` (`collections`, `collection_products`, "collections: public read live" RLS with the schedule window, "collection_products: public read"), `harden_grants`, `admin_categories_collections` (`admin_save_collection`, 200-product cap).
- Seed: 6 collections. `teej-collection` has already ended, `dashain-edit` is live until 25 Oct, the others are unscheduled.
- `src/features/catalog/{queries,mappers,categories,category-sort,types,homepage}.ts`, `src/features/search/queries.ts`.
- `src/components/store/home/collection-carousel.tsx`, `src/components/store/{product-grid,category/category-card,category/category-sort}.tsx`, `src/components/ui/{media-frame,card,section-heading}.tsx`, `src/app/(store)/categories/**`, `src/app/(store)/@modal/**`.
- `src/features/admin/actions/{helpers,collections}.ts` (`revalidateStorefrontCatalog`).
- `src/test/fakes/catalog-queries.ts`, `src/test/fixtures/catalog-rows.ts`, `src/features/catalog/categories.test.ts`.
- Next docs: `04-functions/unstable_cache.md` (superseded by `use cache` under Cache Components, which this project hasn't enabled; the catalog and search reads use `unstable_cache`, so I stay consistent), `03-file-conventions/page.md`, `04-functions/revalidatePath.md`.

## Decisions

1. **Reads** (`src/features/catalog/queries.ts`, anon client, RLS restated in filters):
   - `fetchLiveCollections()` gains `id` in its select. RLS already hides inactive and out-of-window rows.
   - New `fetchCollectionBySlug(slug)`: one live collection or `null`.
   - New `fetchCollectionProductCounts(collectionIds)`: `collection_products(collection_id, products!inner(id))` with `products.status = 'active'`, counted in TS. Draft/archived products don't count.
   - New `fetchCollectionProductCards(collectionId)`: `collection_products(sort_order, products!inner(<CARD_SELECT>))`, ordered by the link's `sort_order`, cover photo limited to the first by `sort_order`. One request from the link side, so a 200-product collection never builds a long `in (...)` URL.

2. **Feature module** `src/features/catalog/collections.ts` (mirrors `categories.ts`):
   - `getCollections(): CollectionSummary[]` for the index.
   - `getCollectionBySlug(slug)` (React `cache`, invalid slug → `null` without a query) and `getCollectionProducts(slug, sort)`.
   - The listing (header + products + ratings) is cached with `unstable_cache`, 60 s, tag `CATALOG_CACHE_TAG`, keyed by slug. Sorting runs after the cache with the existing `sortProducts`, so every `?sort=` shares one entry. "Featured" keeps the curated order.
   - A scheduled collection can therefore appear or disappear up to 60 s late. That matches the rest of the catalog and doesn't affect checkout.
   - New view models in `types.ts`: `CollectionSummary` (slug, eyebrow, title, description, `image: MediaImage | null`, productCount) and `CollectionDetail` (slug, eyebrow, title, description, image). Mappers `toCollectionSummary` / `toCollectionDetail` next to `toHomeCollection`. Unlike the homepage carousel, the index and page keep collections without a photo and show the neutral `MediaFrame` placeholder.

3. **Shared banner**: extract the carousel slide's composition (primary-100 surface, photo on the right 3/5 with the fade, eyebrow / Playfair title / description on the left) into `src/components/store/collection-banner.tsx`.
   - Props: `collection`, `headingLevel` (`h1` on the page, `h3` in the carousel), optional `action` (the carousel passes its "Explore the Collection" link) and `priority` for the page's LCP image.
   - The carousel keeps its own slide wrapper, ARIA and `data-slide-image` / `data-slide-copy` GSAP hooks, so it looks and animates exactly as before. Its existing test must pass unchanged.
   - With no photo, the banner renders copy-only on the primary-100 surface.

4. **`/collections`** (`src/app/(store)/collections/page.tsx`, ISR `revalidate = 60` like `/categories`):
   - Breadcrumbs Home › Collections; `SectionHeading as="h1"`, eyebrow "Curated edits", title "Collections", one-line description.
   - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, gap 16/24. New `CollectionCard` (`src/components/store/collection/collection-card.tsx`): `Card interactive`, `MediaFrame` at 4:3 (decorative, the title names the card), eyebrow (small, uppercase, primary-500), title (`text-h3`), description (2 lines, clamped), product count via the existing `productCountLabel`. The title link stretches over the card, as in `CategoryCard`.
   - Empty state: "New collections are coming soon." with a "Shop all products" link to `/search`.

5. **`/collections/[slug]`** (dynamic, since it reads `searchParams`):
   - Unknown, inactive, not-yet-started or ended collection → `notFound()`.
   - Breadcrumbs Home › Collections › {title}; `CollectionBanner` with an `h1`.
   - Toolbar: product count plus the existing `CategorySortControl` (Featured / Price ↑ / Price ↓, `?sort=`, works without JS). It is already path-generic, so I reuse it rather than copy it.
   - `ProductGrid` unchanged, so cards and the bag icon open the quick view.
   - Empty state (dashed card as on category pages): "No products in {title} yet." plus "Browse all collections".
   - `generateMetadata`: title and description from the collection, and the hero photo as `openGraph.images` when present.

6. **Revalidation**: `revalidateStorefrontCatalog()` also calls `revalidatePath("/collections")`. Collection pages are dynamic and read tagged data, so the existing `revalidateTag(CATALOG_CACHE_TAG)` already covers them. Product and category edits use the same helper, so a product going to draft drops out of collections too.

7. **Tokens only**: container `max-w-7xl px-4 md:px-8`, gaps 16/24/32, radius `lg` cards and `xl` banner, existing type scale. No new icons expected.

## Files expected to change

```text
src/features/catalog/queries.ts                          + 3 reads, id in fetchLiveCollections
src/features/catalog/mappers.ts (+ mappers.test.ts)      + CollectionLinkRow, toCollectionSummary, toCollectionDetail
src/features/catalog/types.ts                            + CollectionSummary, CollectionDetail
src/features/catalog/collections.ts (+ .test.ts)         new: cached reads
src/test/fakes/catalog-queries.ts                        + fakes for the new reads
src/test/fixtures/catalog-rows.ts                        + ids and collection link fixtures
src/components/store/collection-banner.tsx               new (extracted)
src/components/store/home/collection-carousel.tsx        uses CollectionBanner
src/components/store/collection/collection-card.tsx      new
src/components/store/collection/__tests__/*.test.tsx     card + banner
src/app/(store)/collections/page.tsx                     new
src/app/(store)/collections/[slug]/page.tsx              new
src/features/admin/actions/helpers.ts                    + revalidatePath("/collections")
tests/db/storefront-collections.test.ts                  new (anon reads)
worklog.md                                               mark Collections done
```

## Database / migration impact

None. No schema, function, grant or data change. `src/types/database.ts` is unchanged.

## Auth / RLS

- Public reads through the anon client (`public.ts`), with no `auth()`, so the pages stay cacheable.
- The guard is the existing RLS: "collections: public read live" (active + schedule window), "products: public read active" (the `!inner` embed drops links to draft/archived products), and "product_media: public read active".
- No service role, no new policy.

## Validation and security

- `slug` passes `isValidSlug` before any query; `sort` goes through the whitelist in `parseCategorySort`.
- No user text reaches a filter string: the slug is a bound `.eq()` value.

## Tests

- **Unit** (`collections.test.ts`, fakes): index lists collections with active-product counts and keeps photo-less ones; unknown or malformed slug → `null` without a query; products come back in curated order; price sorts; the empty collection returns `[]`.
- **Mappers**: summary/detail mapping, including a null photo.
- **Components**: `CollectionCard` (link name, count label, decorative image); `CollectionBanner` renders the heading at the requested level, with and without a photo and action. The existing carousel test still passes.
- **DB** (`tests/db/storefront-collections.test.ts`, PGlite as `anon`, rolled back): an ended collection (`teej-collection`) and an inactive one are invisible; a future-scheduled one is invisible; a collection's product embed drops a product flipped to `draft`; `anon` cannot write `collections` or `collection_products`.

## Acceptance criteria

1. Header "Collections" opens `/collections` with the five live seed collections in admin order; the ended Teej collection is absent.
2. Each card shows its photo, eyebrow, title, description and a correct product count, and the whole card is clickable.
3. A homepage carousel "Explore the Collection" opens `/collections/<slug>` with the banner and the products in curated order.
4. Sort by price reorders and updates `?sort=`; reload keeps it; it also works with JavaScript off.
5. Clicking a product card opens the quick view; closing it returns to the collection.
6. `/collections/teej-collection` and `/collections/nope` show the 404 page.
7. Turning a collection off, or removing a product from it, in the admin shows on the storefront on the next load.
8. The homepage carousel looks and animates as before.
9. Keyboard: cards, sort and grid are reachable with visible focus. At 375px there's no horizontal scroll and the banner stacks photo over text.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
npm run dev   # scratchpad playwright-core script: acceptance 1–9 at 1280 and 375px, JS on and off
```

## Manual test steps

1. `npm run dev`, click "Collections" in the header. Check five cards, and that Teej is missing.
2. Open "The Pashmina Edit". Compare its product order with `/admin/promotions` → the collection's editor.
3. Change "Sort by" to "Price: Low to High", reload, then set it back to Featured.
4. Click a product card: the quick view opens. Press Escape.
5. From the homepage carousel, go to the next slide and click "Explore the Collection".
6. Open `/collections/teej-collection` and `/collections/nope`: both 404.
7. In `/admin/promotions`, turn "Layer Up" off, save, then reload `/collections`: it's gone. Turn it back on.
8. Disable JavaScript and repeat step 3. Resize to 375px.

## Rollback

Revert the commit. No data or schema is affected.

## Changes made during execution

- None to scope. The DB test builds its own inactive, future-scheduled and ended cases inside the rolled-back transaction, so it doesn't depend on today's date (the seeded Dashain window ends 25 Oct).
- The banner shows the eyebrow and description only when they're non-empty.

### Verification

- `npm run typecheck` and `npm run lint` pass.
- `npm test`: 68 files, 500 tests. `npm run test:db`: 12 files, 255 tests (4 new in `tests/db/storefront-collections.test.ts`).
- `npm run build` passes: `/collections` is ISR (1m), and `/collections/[slug]` is dynamic.
- A scratchpad `playwright-core` script against the dev server passed 17 of 17 checks: nav to the index, 5 live collections with Teej absent, counts, h1 banner, price sort plus reload, quick view open and close, both 404s, the carousel CTA on slide 2, card focus, no horizontal scroll at 375px, the no-JS sort submit, and no console errors.
