# Put the seed into Supabase and serve the storefront from it

## Goal

Stand up the Goreto.store database on the **hosted development Supabase project** whose credentials the user adds to `.env.local`, load `supabase/seed.ndjson` into it, and switch every storefront surface that exists today to read from Supabase instead of the 10-product `dev-seed.ts`:

- homepage: category rail, "Handpicked Just for You" grid and tabs, collection carousel, testimonials;
- `/categories` and `/categories/[slug]`;
- `/products/[slug]`: gallery, variants, stock, rating, specs, care, try-on card, related products.

The seed must be **removable later** without touching data the owner adds: a purge script deletes exactly the rows and storage objects the seed created.

## Non-goals

- No checkout, `place_order` RPC, cart persistence, account area, admin UI, tracking pages or search page. Their **tables and RLS** are created (so the whole seed loads), but no pages read them yet.
- No Clerk ↔ Supabase third-party auth wiring in app code (`lib/supabase/server.ts` with the Clerk token). Nothing in this task reads user data. The dashboard step is listed under "Needs your attention" so the next task can use it.
- No real owner bootstrap (mapping `user_seed_owner` to a real Clerk user). Separate task.
- No subcategory filter chips or new UI. Existing components are reused; the only visual change is an initials avatar fallback on testimonials (reviews have no photos).
- No changes to the seed generator or `seed.ndjson` shape.

## What I inspected

- `AGENTS.md` §5, §7–§12, §16–§18, §24, §26, §28.
- `prompts/goreto-seed-data.md` and `supabase/seed.ndjson`: 26 tables, column shapes and types derived from every row (e.g. `products.options/specs/tags` JSONB, `delivery_zones.district_codes` array, `dev.placeholder_url` on categories/collections/product_media, `dev.tracking_secret` on guest orders).
- Catalog stats: 177 active products, 15 featured, 12 top-level + 26 sub-categories, 14 distinct product placeholder photos.
- `src/features/catalog/{types,dev-seed,homepage,categories,product-detail,featured-tabs,category-sort}.ts` + tests, `src/app/(store)/**` pages, `testimonials.tsx`, `media-frame.tsx`, `badge.tsx`, `next.config.ts`, `.env.example`, `.gitignore` (`.env*` ignored).
- `hero.tsx` and `how-it-works.tsx` still use Picsum, so `picsum.ts` and its remote pattern stay.
- Skills: `supabase`, `supabase-postgres-best-practices`.
- Supabase changelog: **tables are no longer exposed to the Data API automatically** (2026-04-28), so every table gets explicit `GRANT`s alongside RLS.
- Next.js 16.3.6 local docs: `02-guides/caching-without-cache-components.md` (`cacheComponents` is off; `fetch` is uncached by default; route `revalidate` sets ISR), `generate-static-params.md`, `12-images.md`, `environment-variables.md`.
- Versions: `@supabase/supabase-js` 2.117.1, `supabase` CLI 2.117.0. No Supabase CLI, client or `config.toml` exists yet. Docker Desktop is installed (needed only for type generation via `--db-url`).

## Decisions

1. **Environment variables** (names added to `.env.example`, values only in `.env.local`, which I never read or print):

   | Name | Where | Use |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | app + scripts | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app + scripts | Publishable (`sb_publishable_…`) or legacy anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | scripts only | Secret (`sb_secret_…`) or legacy service-role key. Used by the seed loader/purge only. Never imported by `src/`. |
   | `SUPABASE_DB_URL` | scripts only | Postgres connection string for `db push` and type generation |
   | `GORETO_DATA_ENV` | scripts only | Must equal `development` or the loader and purge refuse to run |

   Scripts load `.env.local` with Node's `--env-file-if-exists`. Secrets are passed to the Supabase CLI through a small Node wrapper, never echoed.

2. **Migrations** (imperative, created with `supabase migration new`, applied with `supabase db push --db-url`):
   1. `foundation`: `pg_trgm`, enums (AGENTS §11), `set_updated_at()` trigger, `profiles`, `staff_permissions`, helpers `current_profile_id()`, `is_owner()`, `has_permission(key)` (`security definer`, `stable`, `search_path = ''`, return only facts about the caller), `store_settings`, Nepal geography tables.
   2. `catalog`: `categories`, `products` (+ generated `search_vector` with GIN and trigram index on title), `product_variants`, `product_media`, `product_ar_assets`, `collections`, `collection_products`.
   3. `delivery_promotions`: `couriers`, `courier_services`, `delivery_zones`, `delivery_rates`, `coupons`.
   4. `orders`: `orders`, `order_items`, `shipments`, `shipment_events` (append-only: no update/delete policies).
   5. `engagement`: `customer_addresses`, `reviews`, `wishlist_items`, `newsletter_subscribers`.
   6. `storefront_reads`: `product_rating_summaries` view (`security_invoker = true`, published reviews only) and `storefront_testimonials(limit)` function returning only quote, "First L." name and product title for published, verified 4–5★ reviews.
   7. `storage`: public `product-media` bucket (catalog, category and collection images); insert/update/delete on its objects only for owner or `catalog.write` staff.

   Constraints: FKs with explicit `on delete`, unique slugs/SKUs/order numbers/coupon codes, `check` on money ≥ 0 and totals (`total = subtotal − discount + delivery`), rating 1–5, ward ≥ 1, one default address per user (partial unique index), indexes on every FK and on the columns the storefront queries filter/sort by.

3. **RLS (AGENTS §16)** — enabled on every table, `to anon` / `to authenticated` clauses, never `auth.uid()`:
   - Public read: active categories, active products and their active variants/media/AR assets, active collections within their window, geography, active couriers/services/zones/rates, published reviews (through the view/function), non-secret `store_settings`.
   - Owner / permitted staff: draft/archived catalog read and all catalog writes (`catalog.write`), inventory (`inventory.write`), orders (`orders.read/write`), customers (`customers.read`), reviews (`reviews.manage`), coupons (`promotions.manage`), delivery (`delivery.manage`), settings (`settings.manage`), staff permissions (owner only).
   - Customer (own profile via `current_profile_id()`): own profile (no `role` change — column-level `update` grant excludes `role`, `clerk_user_id`, `deleted_at`), own addresses, wishlist, reviews (create/read own), own orders + items + shipments + events.
   - Coupons, guest tracking hashes, newsletter rows: never readable by `anon`.

4. **Loader** `scripts/seed/load.ts` (`npm run seed:load`):
   - Refuses unless `GORETO_DATA_ENV=development`.
   - Streams `seed.ndjson` in file order (already FK order), upserts `data` by primary key in batches of 500 with the service-role client. Idempotent; reruns update in place.
   - `--media` (default on): downloads each distinct `dev.placeholder_url` once and uploads it to `product-media` at the row's `storage_path` / `image_path` / `hero_image_path`. Category photos are fetched at 480×480 (the tile size) instead of the 160 rail size.
   - Prints per-table counts and checks them against `_meta.counts`.

5. **Purge** `scripts/seed/purge.ts` (`npm run seed:purge`, `--dry-run` supported):
   - Deletes every row whose id appears in `seed.ndjson`, in **reverse** FK order, plus the storage objects the loader uploaded.
   - Keeps reference data by default: `nepal_*` tables and `store_settings`.
   - If owner-created rows reference seeded rows (e.g. an owner product in a seeded category), the delete fails for that row and the script lists them instead of cascading.

6. **App data access**:
   - `src/lib/supabase/public.ts` (`server-only`): an anon-key client with no session, used for public catalog reads. It doesn't call `auth()`, so catalog pages stay cacheable.
   - `src/lib/media/storage.ts`: `productMediaUrl(path)` builds the public `product-media` object URL. `next.config.ts` allows that host (derived from `NEXT_PUBLIC_SUPABASE_URL`).
   - `src/features/catalog/queries.ts` does the Supabase selects with nested embeds (one request per surface, no N+1). `mappers.ts` turns rows into the **existing** view models. `homepage.ts`, `categories.ts` and `product-detail.ts` keep their exported names and return shapes.
   - `dev-seed.ts` and the `NODE_ENV === "production"` seed gates are removed. The data now lives in the database, and production will simply have the owner's data.

7. **Mapping rules**:
   - Category rail and `/categories`: top-level active categories by `sort_order`. Product count includes subcategory products.
   - `/categories/[slug]`: the category's products plus its subcategories' products. For a subcategory, breadcrumbs show the parent.
   - `HomeProduct.categorySlug` is the **top-level** slug, so the existing homepage tabs (dresses/jewelry/bags/accessories) keep working with subcategories.
   - Featured grid: active `is_featured` products (15), newest first.
   - Badge priority: `limited` → `bestseller` → `new` (published within 30 days). None otherwise.
   - Rating: from `product_rating_summaries`, rounded to 1 decimal. `null` when there are no published reviews.
   - Variants: active only. `options[].values[].swatch_hex` → `swatchHex`.
   - Try-on: present only with an active `live_2d`/`live_3d` asset → `modes: ["live"]` with the asset's placement. The preview image is the product's first photo.
   - Collections: active and inside `starts_at`/`ends_at` at request time.
   - Testimonials: 3 from `storefront_testimonials`. `Testimonial.avatar` becomes optional, and the card shows initials in a neutral circle when it's missing.
   - Related products: same top-level category first, then others, up to 8, excluding the product.

8. **Caching**: home, category and product pages export `revalidate = 60` (ISR). `generateStaticParams` prerenders only the featured product slugs. Others render on demand (`dynamicParams` default). Stock shown on pages is display-only; checkout will re-validate against the database.

9. **Types**: `src/types/database.ts` is generated by `supabase gen types typescript --db-url` (needs Docker running). If Docker is unavailable, fallback is `--project-id` after `supabase login`, which I'll ask about before using.

## Files expected to change

```text
package.json / package-lock.json     + @supabase/supabase-js 2.117.1, supabase 2.117.0 (dev), server-only;
                                       scripts db:push, db:types, seed:load, seed:purge, test:db
.env.example                         + Supabase + GORETO_DATA_ENV names
supabase/config.toml                 NEW (supabase init)
supabase/migrations/*.sql            NEW 7 migrations (decision 2)
src/types/database.ts                NEW generated
scripts/db/supabase.ts               NEW CLI wrapper (loads env, runs push / gen types)
scripts/seed/load.ts, purge.ts,
scripts/seed/lib/env.ts, lib/ndjson.ts NEW
src/lib/supabase/public.ts           NEW
src/lib/media/storage.ts (+ test)    NEW
src/features/catalog/queries.ts      NEW
src/features/catalog/mappers.ts (+ test) NEW
src/features/catalog/homepage.ts, categories.ts, product-detail.ts   rewritten bodies, same exports
src/features/catalog/types.ts        Testimonial.avatar optional
src/features/catalog/dev-seed.ts     DELETED
src/features/catalog/{homepage,categories,product-detail}.test.ts   rewritten against a mocked query layer
src/components/store/home/testimonials.tsx   initials fallback
src/app/(store)/page.tsx, categories/page.tsx, categories/[slug]/page.tsx, products/[slug]/page.tsx
                                     revalidate = 60; parent breadcrumb for subcategories
next.config.ts                       + Supabase storage remote pattern
tests/db/*.test.ts, vitest.db.config.mts   NEW live-DB checks (npm run test:db)
prompts/goreto-supabase-seed-wiring.md     this prompt
```

## Database, auth and RLS impact

- Creates the full schema on the **dev** project only. Nothing touches production.
- `profiles.role` can't be written through any user-context path (column grants + no role in the update policy).
- The service-role key is used only by the Node scripts in `scripts/`. `src/` imports only the anon client. A test asserts no `src/` file references `SUPABASE_SERVICE_ROLE_KEY`.
- Authenticated/staff RLS paths are written now but can only be exercised once Clerk third-party auth is configured (next task). This task verifies the `anon` role.

## Validation and security

- Slugs from the URL are validated (`^[a-z0-9-]{1,120}$`) before querying. Invalid slugs → 404.
- Query results are mapped to small view models. No row objects reach client components.
- Coupons, orders, profiles, addresses and newsletter rows return nothing to `anon`.
- Seed emails/phones stay in the DB, never rendered on public pages. Testimonials show "First L." only.

## UI references

Homepage, Product Details and Design System references. No layout changes. The pages render the same components with more data. The testimonial initials avatar uses `neutral-100` surface, `neutral-700` Inter Medium initials, full radius, 48px.

## Acceptance criteria

- `npm run db:push` applies all migrations to the dev project. A rerun reports nothing to apply.
- `npm run seed:load` loads every table. Counts equal `_meta.counts`. A rerun changes nothing (upsert).
- Storefront shows seeded data: 12 categories on the rail and `/categories` with correct counts, 15 featured products with working tabs, 6 collections (those in their window), 3 testimonials, product pages for any active slug (e.g. `pearl-drop-earrings`, `beaded-wrist-stack`) with variants, stock states, ratings, specs and try-on only where AR assets exist.
- Draft/archived product slugs 404. Unknown category slugs 404.
- `anon` checks (`npm run test:db`): can read active catalog; can't read draft products, orders, profiles, addresses, coupons, newsletter; can't insert/update catalog rows.
- `npm run seed:purge -- --dry-run` lists what would be deleted and deletes nothing.
- typecheck, lint, unit tests and production build pass.

## Checks to run

```bash
npm run db:push
npm run db:types
npm run seed:load
npm run typecheck
npm run lint
npm test
npm run test:db
npm run seed:purge -- --dry-run
npm run build
```

Plus a manual browser pass on `npm run dev`.

## Manual test steps

1. Fill `.env.local` with the five variables above. Run `npm run db:push`, then `npm run seed:load`.
2. `npm run dev` → `/`: the category rail shows 12 categories. Switch the Featured tabs (All / Dresses / Jewelry / Bags / Accessories). The carousel and testimonials render.
3. `/categories` → counts on tiles. Open `Jewelry` → 33 products. Sort by price both ways.
4. `/categories/earrings` → breadcrumbs `Home / Categories / Jewelry / Earrings`.
5. `/products/beaded-wrist-stack` → switch Tan/Black. Black shows low stock. The try-on card is visible.
6. Open a product with a sold-out variant and confirm Add to Cart is disabled for it.
7. Supabase dashboard → Table editor: row counts match `_meta.counts`. Storage → `product-media` has the images.
8. `npm run seed:purge -- --dry-run` → the summary lists the seeded rows only.

## Implementation notes (changes from the plan, found while executing)

- **Security fix: `harden_grants` migration.** Supabase Cloud's default privileges gave `anon`/`authenticated` ALL on every new public table, including TRUNCATE and UPDATE on `profiles.role`, which overrode the column grant. RLS still hid all rows, and nobody could sign in yet, so it was not exploitable. The migration revokes the defaults, re-grants exactly what each policy needs, and adds a `guard_profile_identity` trigger so role/Clerk id/email/deleted_at can never change from a user-context role. Future migrations must grant explicitly.
- **`dev-seed.ts` moved, not deleted**, to `src/test/fixtures/catalog.ts`: component tests use it as sample data. A boundary test fails if app code imports `@/test/*` or mentions the service-role key.
- **`npm run test:db` runs on PGlite** (in-process Postgres 17, devDependency `@electric-sql/pglite`) with the real migrations, the full seed and shims that mimic Supabase Cloud's roles/defaults. It covers anon, customer, catalog staff, fulfilment staff and owner. This replaces the planned live-anon-only tests, because Docker/WSL is disabled on this machine. Live anon behaviour was checked once over the hosted REST API.
- **`db:types` uses `--project-id`** (Management API, needs `SUPABASE_ACCESS_TOKEN` or `supabase login`) because `--db-url` type generation needs Docker. `src/types/database.ts` was generated by postgres-meta (the CLI's generator) against the migrated schema.
- The homepage rail shows the first 10 top-level categories + "More". "Watches" joined the Accessories tab. 5 collections are live today (Dashain started 24 Sep, Teej ended 20 Sep).

## Rollback

- App: revert the commit. `dev-seed.ts` returns with it.
- Database (dev only): `npm run seed:purge` removes the seed rows. To drop the schema entirely, reset the dev project from the dashboard (Database → Reset) or drop the created tables. Never run any of this against production.
