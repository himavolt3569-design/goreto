# Generate the Goreto.store development seed (`seed.ndjson`)

## Goal

Create a large, realistic, internally consistent **development seed** for the whole store, as one NDJSON file: `supabase/seed.ndjson`. It is the data the upcoming Supabase schema and loader will import, and it is big enough to exercise every surface in the references: catalog and search, product details and variants, checkout delivery options, order tracking, the customer account area (§4.9), and the admin dashboard KPIs, charts and tables (§4.6).

The file is produced by a **deterministic generator** committed to the repo, so it can be rebuilt byte-for-byte and extended when the schema changes.

## Non-goals

- No SQL migrations, RLS policies, generated types, Supabase project or loader. Those are the next task ("Database"). The seed's row shapes are written to match AGENTS §11 so the migration can follow them.
- No changes to the running app. `src/features/catalog/dev-seed.ts` and the pages keep working as they are.
- No `try_on_jobs` rows. They need real private storage objects and expire after 24 hours anyway.
- No complete Nepal municipality dataset (753 local levels). See decision 6.
- No real photos. See decision 8.

## What I inspected

- `AGENTS.md` §4 (page contracts), §9 (roles, permissions), §11 (data model), §12 (checkout maths), §14 (AR capabilities), §15 (Nepal rules), §16 (RLS intent), §26 (traps: fake data, money floats, fake GPS).
- `designs/goreto-admin.png`: KPIs (sales, orders, active products, customers), revenue per day for a month, recent orders with Pending / Processing / Shipped / Delivered / Canceled, product table with stock and Low Stock.
- `designs/goreto-checkout.png`: Standard Rs. 100 (3–5 days), Express Rs. 200 (1–2 days), Pickup Point Rs. 50 (2–4 days); coupon discount; Nepal address with ward and postal code.
- `designs/goreto-order confirm.png`: order number format `GT2503187294`, stepper timestamps (Confirmed, Packed, Shipped, Out for Delivery, Delivered), courier "Pathao", tracking number `PTH…`, address snapshot.
- `src/features/catalog/{types,dev-seed,product-detail,homepage,featured-tabs}.ts`: the view models the seed must be able to feed (options with swatch hex, variants with price override and stock, per-variant media, specs, care text, try-on placement, collections, testimonials).
- `src/lib/money/format.ts` (integer paisa), `src/lib/media/picsum.ts`, `next.config.ts` (picsum `/id/**` only), `src/config/site.ts` (7-day returns, COD), `src/components/ui/badge.tsx` (new / bestseller / limited / ar-ready).
- `src/features/newsletter/*`: no subscribers table yet.
- `package.json` (npm, Vitest 4), `tsconfig.json`, `vitest.config.mts`, Node v24.19 (runs `.ts` directly). No Supabase CLI or `supabase/` folder yet.
- Next.js docs: not relevant, no Next code changes.

## Decisions

1. **File and format.** `supabase/seed.ndjson`, UTF-8, one JSON object per line:

   ```json
   {"table":"products","data":{"id":"…","slug":"pearl-drop-earrings", "...": "..."}}
   {"table":"product_media","data":{…},"dev":{"placeholder_url":"https://picsum.photos/id/628/840/960"}}
   ```

   - `table` is the target table. `data` is exactly the row to insert, with snake_case columns.
   - `dev` (optional) holds loader-only hints that must never become columns: placeholder image URLs, and the plaintext guest tracking secret.
   - Line 1 is `{"table":"_meta", …}`: format version, PRNG seed, the fixed "now" (`2026-09-24T12:00:00+05:45`), row counts per table, and notes.
   - Lines are in **foreign-key order**, so a loader can stream-insert top to bottom. The geography tables come first because `store_settings` references a municipality.

2. **Deterministic ids.** UUIDv5 from a Goreto namespace plus a natural key (`product:pearl-drop-earrings`, `order:GT2609241234`). Reruns give the same ids, so loads are idempotent upserts. A seeded PRNG (no `Math.random`) and a fixed "now" make the file reproducible.

3. **Money and time.** All money is integer paisa. Prices end in 99 rupees, like the references (Rs. 2,499 → `249900`). Timestamps are UTC ISO strings. They are generated in Nepal time (store hours, evening peaks), then converted.

4. **Tables and volumes (approximate).**

   | Table | Rows | Notes |
   | --- | ---: | --- |
   | `store_settings` | 1 | Singleton: name, NPR, Asia/Kathmandu, COD on, 7-day returns, feature flags. Support email/phone and social links are null, not invented. No secrets. |
   | `nepal_provinces` | 7 | All provinces. |
   | `nepal_districts` | 77 | All districts with their province. |
   | `nepal_municipalities` | 76 | Metros, sub-metros and the towns the seed addresses use, with ward counts. |
   | `profiles` | 604 | 1 owner, 3 staff, ~600 customers. `clerk_user_id` = `user_seed_…` (fake). |
   | `staff_permissions` | 17 | Catalog manager, fulfilment, support presets (AGENTS §9.2 keys). |
   | `customer_addresses` | 758 | Home/Office/Parents' addresses, one default per customer. |
   | `categories` | 38 | The current 10 slugs plus Ethnic Wear and Watches, with 26 subcategories (earrings, necklaces, kurta sets, sarees…). |
   | `products` | 195 | 177 active, 10 draft, 8 archived. |
   | `product_variants` | 1,153 | Colour/size/metal options, SKUs, price overrides, stock (including sold-out and low-stock). |
   | `product_media` | 589 | Ordered gallery, alt text, some variant-specific photos. |
   | `product_ar_assets` | 29 | Live 2D/3D only, for sunglasses, earrings, necklaces, bracelets, watches, rings. |
   | `collections`, `collection_products` | 6, 74 | The 3 existing homepage collections, plus Dashain, Teej and Pashmina edits. |
   | `couriers`, `courier_services` | 5, 8 | See decision 7. |
   | `delivery_zones`, `delivery_rates` | 4, 10 | Every district in exactly one zone. |
   | `coupons` | 10 | Active, expired, scheduled, exhausted and disabled examples. |
   | `orders` | 2,209 | Mid-Sep 2025 to 24 Sep 2026, growing month over month, with Dashain/Tihar and Teej bumps. |
   | `order_items` | 3,391 | Immutable snapshots: title, SKU, variant text, image path, unit price. |
   | `shipments`, `shipment_events` | 2,209, 11,651 | Append-only history. No coordinates (see decision 7). |
   | `reviews` | 1,296 | Mostly verified purchases; published / pending / rejected. |
   | `wishlist_items` | 1,216 | |
   | `newsletter_subscribers` | 410 | Subscribed and unsubscribed. |

   Actual output: about 26,000 lines and 13.4 MB (counts updated after generation; the exact numbers are in `_meta.counts`).

5. **The catalog is hand-written, not lorem ipsum.**
   - The current 10 dev-seed products keep their slugs, SKUs, prices, options and Picsum photos, so the existing pages match the database later.
   - The reference products are included: Pearl Drop Earrings (Rs. 2,499), Classic Top Handle Bag (Rs. 3,999), Floral A-Line Dress (Rs. 2,899), Minimal Gold Bracelet (Rs. 1,799, low stock), Classic Leather Handbag (Brown, Rs. 3,799).
   - Nepal-relevant lines are added: pote bead necklaces, tilhari pendants, jhumkas, glass bangle sets (2.4 / 2.6 / 2.8 sizes), Dhaka topi, pashmina shawls, kurta suruwal sets, sarees, allo (Himalayan nettle) and felt bags.
   - Each product gets a short description, a full description, specs, care instructions, tags, package weight, and badge flags (`is_featured`, `is_bestseller`, `is_limited_edition`). "New" comes from `created_at`.
   - Options are stored like the current view model: `options` JSONB `[{name, values:[{value, label, swatch_hex}]}]`, with `option_values` on each variant.

6. **Nepal geography.**
   - Provinces and all 77 districts are complete.
   - Municipalities are a **seed subset** (76) with ward counts and common postal codes. The complete 753-local-level dataset needs a verified source and belongs in `src/data/nepal/` as its own task (AGENTS §6, §15.5). The subset is marked `"source": "dev-seed-subset"` in `_meta`.
   - Addresses reference stable codes (`province_code`, `district_code`, `municipality_code`, slug style, e.g. `bagmati` / `kathmandu` / `kathmandu-metropolitan-city`). Wards stay within the municipality's ward count. Landmarks are real neighbourhoods (Thamel, Baneshwor, Lakeside, Narayangarh…).
   - About 40% of addresses have lat/lng near their municipality's centre, as a "location detected" example.

7. **Delivery is truthful.**
   - Couriers: Pathao, Nepal Can Move, Upaya City Cargo, and Goreto Valley Riders (in-house). All are `integration_mode: manual`, with support phone and website set to null. I won't invent contact details.
   - Zones: Kathmandu Valley, Major Cities, Rest of Nepal, Remote Himalayan. Zones match on district codes.
   - Rates follow the checkout reference: Valley Standard Rs. 100 / Express Rs. 200 / Pickup Rs. 50. Other zones cost more and offer fewer services; Remote gets Standard only. `delivery_rates` carries optional `estimated_min_days` / `estimated_max_days` overrides, because the same service is slower outside the valley.
   - Shipment events carry status, a user-facing message and a timestamp, but **no coordinates**, because no courier API supplies them (AGENTS §26.3). Tracking numbers look like the reference (`PTH…`, `NCM…`).

8. **Images are placeholders, alt text is real.**
   - Picsum has only ~15 photos that fit fashion (reviewed in the homepage task). So `product_media.storage_path` holds the future canonical key (`products/<slug>/01.jpg`), and `alt_text` describes the product.
   - `dev.placeholder_url` points to a vetted Picsum photo from the same category. Photos repeat across products in dev and will not always match the alt text. Only the 10 existing products have exact photo matches.

9. **Orders follow the real checkout rules (AGENTS §12).**
   - Unit prices come from the variant or base price at order time.
   - Coupons apply only inside their window, above their minimum, and up to their cap, and each coupon's usage count matches the orders that used it.
   - The delivery fee comes from the zone and service of the address.
   - `total = subtotal − discount + delivery`, all in paisa.
   - About 70% of orders are from signed-in customers, with a repeat-buyer long tail. About 30% are guest orders, each with a `guest_tracking_hash` (SHA-256 of a secret kept in `dev.tracking_secret` so you can test guest tracking).
   - Order numbers are `GT` + YYMMDD (Nepal date) + 4 random digits, unique, like the reference.
   - Status follows the order's age:
     - last few hours: `pending_confirmation`;
     - within a day: `confirmed` / `processing` / `packed`;
     - within a few days: `shipped`;
     - older: ~88% `delivered` + `collected`, ~6% canceled before dispatch, ~3% failed delivery (shipment `returned`, payment `failed`), ~3% delivered then `refunded`.
   - Orders carry `confirmed_at`, `packed_at`, `shipped_at`, `delivered_at`, `canceled_at` and `cancellation_reason`, which the tracking stepper needs.
   - Current `stock_quantity` is the stock left after all seeded orders. Some variants are sold out, and some are below the low-stock threshold.

10. **People are fictional.**
    - Names are drawn from a varied pool of Nepali first names and surnames (Shrestha, Gurung, Tamang, Rai, Limbu, Magar, Thapa, Yadav, Jha, Tharu, Sherpa, Bajracharya…).
    - Emails use the reserved `example.com` / `.net` / `.org` domains, so nothing is deliverable.
    - Phones are E.164 `+97798…`-style mobiles. Because they could match real numbers, `_meta` states they must never be messaged.
    - The owner row uses a placeholder Clerk id, and the loader task will swap in the real owner.

11. **Reviews and AR.**
    - Review text is built from category-specific phrase pools (fit, finish, delivery town, festival use), rated 1–5 with a positive skew.
    - Verified reviews link to a delivered `order_item`. Rejected ones are spam or off-topic.
    - AR assets exist only for placements the live mode can anchor (ear, face, neck, wrist, hand). There is no `photo_ai` asset, because no provider is configured (AGENTS §14.2). Asset files (`ar/<slug>/overlay.png`, `.glb`) do not exist yet, which `_meta` also notes.

12. **Generator layout** (TypeScript, run directly by Node 24):

    ```text
    scripts/seed/generate.ts         entry: builds rows in FK order, writes supabase/seed.ndjson
    scripts/seed/lib/random.ts       seeded PRNG (mulberry32) + pick/weighted/int helpers
    scripts/seed/lib/ids.ts          UUIDv5
    scripts/seed/lib/time.ts         NPT <-> UTC, fixed "now"
    scripts/seed/data/nepal.ts       provinces, districts, municipality subset, landmarks, centroids
    scripts/seed/data/people.ts      name pools
    scripts/seed/data/catalog.ts     categories, products, collections, AR placements
    scripts/seed/data/delivery.ts    couriers, services, zones, rates
    scripts/seed/data/commerce.ts    coupons, store settings, review phrase pools
    scripts/seed/build/*.ts          profiles, catalog, orders/shipments, reviews/wishlist
    scripts/seed/seed.test.ts        integrity tests over the generated file
    ```

    - `package.json` gets `"seed:generate": "node scripts/seed/generate.ts"`.
    - `tsconfig.json` gets `allowImportingTsExtensions: true`, which is needed for Node's `.ts` import specifiers (safe because `noEmit` is already true).
    - `vitest.config.mts` gets `scripts/**/*.test.ts` in `include`.

## Files expected to change

```text
supabase/seed.ndjson                 NEW  generated seed (~10–14 MB)
scripts/seed/**                      NEW  generator + integrity test
package.json                         + seed:generate script
tsconfig.json                        + allowImportingTsExtensions
vitest.config.mts                    + scripts/**/*.test.ts
prompts/goreto-seed-data.md          this prompt
```

## Database, auth and RLS impact

None yet. No database exists. The seed fixes the column names and enums the migration will use (AGENTS §11, plus the documented additions: geography tables, `options`/`specs`/`care_instructions`/`tags`/`weight_grams` on products, order lifecycle timestamps, rate day overrides, `collections`, `newsletter_subscribers`). Any row shape can change in the migration task by editing the generator and regenerating.

## Security and privacy

- No real people, emails, secrets, API keys or live URLs besides `picsum.photos` placeholders.
- Clerk ids are obviously fake (`user_seed_…`), so they cannot collide with real Clerk users.
- The seed is **development-only** and must never be loaded into production. `_meta.environment = "development"` states this, and the loader task will refuse production.

## Acceptance criteria

- `npm run seed:generate` writes `supabase/seed.ndjson`. Running it twice gives identical bytes.
- Every line parses. Every `table` is known. Line order satisfies foreign keys.
- Integrity tests pass:
  - ids unique per table, and unique slugs, SKUs, order numbers and coupon codes;
  - every foreign key resolves;
  - enums match AGENTS §11;
  - money values are non-negative integers;
  - order maths: line total = unit × qty, subtotal = Σ lines, total = subtotal − discount + delivery;
  - discounts obey coupon rules and each coupon's usage count equals its orders;
  - delivery fee = the rate for the address zone + service;
  - `payment_status = collected` only on delivered orders;
  - shipment events are chronological and match the order's status;
  - every district belongs to exactly one zone; wards are within the ward count;
  - one default address per customer;
  - verified reviews point to the reviewer's own delivered items;
  - no stock is negative; timestamps are ≤ "now";
  - emails use example domains only.
- The existing 10 dev products appear with their current slugs, SKUs and prices.

## Checks to run

```bash
npm run seed:generate
npm run typecheck
npm run lint
npm test
```

No build is needed, because no app code changes.

## Manual test steps

1. Run `npm run seed:generate` twice. Confirm `git diff --stat supabase/seed.ndjson` shows no change after the second run.
2. Open `supabase/seed.ndjson` and read line 1 (`_meta`): the counts, the fixed "now" and the notes.
3. Search for `"slug":"beaded-wrist-stack"` and confirm it matches the current product page.
4. Pick any order line (`"table":"orders"`), then find its `order_items`, `shipments` and `shipment_events` by `order_id` / `shipment_id`. Check that the totals and timeline read correctly.

## Rollback

Delete `supabase/seed.ndjson` and `scripts/seed/`, and revert the three config lines. No data is affected.
