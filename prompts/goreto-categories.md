# Implement the Goreto.store categories pages

## Goal

Make the category links that already exist on the storefront work, with two simple pages built strictly from the Design System and the patterns already in the codebase:

1. **`/categories`**: every category as a tile grid. Linked from the header "Categories", the homepage "View All Categories", the rail's "More" circle, the featured "Accessories" tab and the footer.
2. **`/categories/[slug]`**: one category's products in a grid, with a sort select. Linked from every homepage category circle and from the product page breadcrumb.

There is no screenshot for these pages. They reuse the homepage's section header, the product card grid and the Design System select, so they look like part of the same store.

Data comes from the typed **development seed catalog**, served only outside production, like the homepage and product page. A later Supabase task replaces the function bodies without changing the pages.

## Non-goals

- Supabase schema, migrations, RLS, generated types, the NDJSON seed in `supabase/`.
- Filters (price, size, colour), subcategories, pagination. The dev seed has at most 2 products per category. Pagination comes with the Supabase reads.
- Header active state for "Categories" (the header is a server component with no current-path logic yet).
- Quick view, wishlist, add-to-cart from cards (cards keep the existing "choose options" link).
- GSAP motion.

## What I inspected

- `AGENTS.md` §3 (tokens, buttons, inputs, cards), §7 (routes), §8 (URL state for sort), §13 (search/sort in the URL), §22 (a11y), §25 (images), §26.
- `designs/Goreto-designsystem.png` (§08 Select "Most Relevant", §12 product card, §13 navigation), `designs/goreto-home.png` (category rail, featured grid).
- `prompts/goreto-product-details.md` (conventions, seed gating).
- `src/features/catalog/{types,dev-seed,homepage,product-detail,featured-tabs}.ts`.
- `src/components/store/home/{category-rail,featured-products}.tsx`, `src/components/store/product/breadcrumbs.tsx`, `src/components/store/product-card-actions.tsx`, `src/app/(store)/products/[slug]/{page,not-found}.tsx`.
- `src/components/ui/{product-card,section-heading,media-frame,card,select,nav-item,index}.tsx`, `src/config/site.ts`, `src/app/layout.tsx` (`.js` class), `src/app/globals.css` tokens.
- Next docs: `03-file-conventions/page.md` (`searchParams` is a Promise and opts into dynamic rendering), `dynamic-routes.md`, `04-functions/{generate-static-params,generate-metadata,not-found}.md`.
- Seed product counts: dresses 1, jewelry 1, bags 1, shoes 1, sunglasses 1, tops 0, outerwear 1, hats 2, scarves 1, boots 1.

## Decisions

1. **Data layer** in `src/features/catalog/categories.ts` (server):
   - `getCategories(): CategorySummary[]` — slug, title, tile image, `productCount`. Seed order.
   - `getCategoryBySlug(slug)` — `CategoryDetail | null` (slug, title, description). Wrapped in `cache()` so metadata and page share one read.
   - `getCategoryProducts(slug, sort)` — `ProductSummary[]` (with rating), sorted.
   - `getCategorySlugs()` for `generateStaticParams`.
   - All return empty / `null` in production, like the existing reads.

2. **Sort** in `src/features/catalog/category-sort.ts` (client-safe, like `featured-tabs.ts`):
   - Options: `featured` (default, catalog order), `price-asc` ("Price: Low to High"), `price-desc` ("Price: High to Low"). No "Newest" because the seed has no dates.
   - `parseCategorySort(value)` accepts `string | string[] | undefined`; anything unknown falls back to `featured`. `sortProducts(products, sort)` is pure and stable, comparing integer paisa.
   - The value lives in `?sort=`. The default is not written to the URL.

3. **Seed.** `dev-seed.ts` gets one `seedCategoryList` (slug, title, description, Picsum id). `seedCategories` (the homepage's 160px `HomeCategory[]`) is derived from it, so the homepage is unchanged. Category tiles use a 480px version of the same photo. Short, factual descriptions (e.g. "Dresses for everyday and occasion wear.").

4. **`/categories` page** (server component):
   - Breadcrumbs: Home › Categories.
   - Header: `SectionHeading` with eyebrow "Shop by category", title "All Categories", description "Explore our curated collections designed for your everyday style." `SectionHeading` gets an optional `as?: "h1" | "h2"` prop (default `h2`), so the page title is a real `h1` with the same style.
   - Grid: 2 columns on phones, 3 from `sm`, 4 from `md`, 5 from `lg`, gap 16px.
   - Tile (`CategoryCard`, in `components/store/category/`): `Card interactive` surface, square `MediaFrame` image, then 12px padding with the title (Heading 3, `text-h3`) and a caption (Small, `text-neutral-500`): "3 products", "1 product", or "Coming soon" when empty. The whole tile is one link (stretched link, the same technique as `ProductCard`), with a visible focus ring. Images are decorative (`alt=""`) because the title names the tile.
   - Empty: "Categories are coming soon." (same copy as the homepage rail).

5. **`/categories/[slug]` page** (server component, dynamic because it reads `searchParams`):
   - Breadcrumbs: Home › Categories › {Title}.
   - Header: `SectionHeading as="h1"` with eyebrow "Category", the category title, and its description.
   - Toolbar row: product count on the left ("2 products", `aria-live` not needed because sort does not change the count), sort control on the right.
   - Sort control (`CategorySort`, small client component): a GET form with a visible "Sort by" label and the Design System `Select`. Changing it submits the form (`requestSubmit`). An "Apply" secondary button is shown only without JavaScript (hidden under `.js`), so sorting still works with JS off.
   - Grid: the homepage featured grid (2 / 3 / 5 columns), `ProductCard` with rating, `WishlistSoonButton` and `ChooseOptionsLink`, exactly as in the related rail.
   - Empty category: the featured grid's dashed empty state: "No products in {Title} yet." with a text link "Browse all categories".
   - Unknown slug → `notFound()`, with `categories/[slug]/not-found.tsx` copying the product not-found layout: "Category not found" + "Browse all categories".
   - `generateStaticParams` is not used: the page is dynamic because of `searchParams`.

6. **Metadata.** `/categories`: title "Categories". Category page: title = category title, description = category description.

7. **Tokens only.** Container `max-w-7xl px-4 md:px-8`, page padding `pt-6 pb-16`, section gaps 24 / 32px. Radii `lg` for cards, shadows `sm` → `md` on hover. No off-scale values.

## Files expected to change

```text
src/app/(store)/categories/page.tsx                 new: all categories
src/app/(store)/categories/[slug]/page.tsx          new: category products + sort
src/app/(store)/categories/[slug]/not-found.tsx     new: category 404
src/features/catalog/categories.ts (+ test)         new: reads
src/features/catalog/category-sort.ts (+ test)      new: sort options, parse, sort
src/features/catalog/types.ts                       + CategorySummary, CategoryDetail
src/features/catalog/dev-seed.ts                    seedCategoryList; seedCategories derived
src/components/ui/section-heading.tsx               + `as` prop
src/components/store/category/category-card.tsx    new
src/components/store/category/category-sort.tsx    new, "use client"
src/components/store/category/__tests__/category-sort.test.tsx
```

## Database, auth, RLS

None. Public, read-only pages; no proxy change (the routes are already public).

## Security and validation

- `slug` is only compared against seed slugs; unknown values 404.
- `sort` is whitelisted; any other value is ignored. Nothing reaches SQL.

## Acceptance criteria

- Every existing category link (header, homepage rail, "View All Categories", "More", Accessories tab, footer, product breadcrumb) opens a working page.
- `/categories` shows 10 tiles with correct counts; Tops says "Coming soon".
- `/categories/hats` shows 2 products; sorting by price reorders them and updates `?sort=`; reload keeps the order.
- `/categories/hats?sort=junk` renders the default order.
- `/categories/tops` shows the empty state. `/categories/nope` shows the category not-found page with a 404 status.
- Tiles and cards are reachable by keyboard with a visible focus ring; the sort select has a visible label.
- 375px: no horizontal page scroll.
- Production build: `/categories` shows the empty message and every category URL 404s.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run dev   # scratchpad playwright-core script: click through the links above, screenshots at 1280 and 375, sort + keyboard checks
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/`, click "View All Categories". Check 10 tiles and their counts.
2. Click "Hats". Check breadcrumbs, the title, 2 products.
3. Change "Sort by" to "Price: High to Low". The order and the URL change. Reload.
4. Open `/categories/tops` (empty state) and `/categories/nope` (not found).
5. Back on the homepage, click each category circle and the Accessories tab's empty-state link.
6. On a product page, click the category breadcrumb.
7. Tab through `/categories` and a category page; check focus rings.
8. Resize to 375px.

## Rollback

Additive apart from the `seedCategories` derivation and the `SectionHeading` prop (default unchanged). Revert the commit. No data impact.

## Changes made during execution

- `getCategorySlugs()` was dropped. The category page is dynamic because it reads `searchParams`, so nothing uses it.
- `productCountLabel()` lives in `category-card.tsx` and is shared by the tile caption and the category page count.
- The sort control is named `CategorySortControl`, because `CategorySort` is already the type name. It uses `router.replace` with `{ scroll: false }`, so changing the sort does not add history entries.

### Verification

`npm run typecheck`, `npm run lint`, `npm test` (22 files, 128 tests) and `npm run build` all pass. The build lists `/categories` as static and `/categories/[slug]` as dynamic.

I ran a scratchpad `playwright-core` script against the dev server, and all 28 checks passed:
- navigation: "View All Categories", a tile click, a rail circle, the product breadcrumb, the category breadcrumb, and a product card click;
- counts, including "Coming soon" for Tops;
- the tile focus ring;
- sort: price ascending and descending, the default leaving the URL, order surviving a reload, and `?sort=junk` falling back to Featured;
- no-JS sorting through the Apply button;
- the empty state and the 404;
- no horizontal page scroll at 375px.

The only console errors are the intended 404 and the existing dev-only script-tag warning from the root layout.
