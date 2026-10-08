# Poppins typeface, smaller hero, category heroes, sponsored products

## Goal

Client feedback after the 2026-10-04 production launch: the current type (Inter body, Playfair Display headings) makes the site feel "too white". Changes:

1. **Poppins everywhere**: storefront, admin, Clerk components and the dev `/design-system` page. It replaces both Inter and Playfair Display.
2. **Product details**: make the description text smaller.
3. **Homepage hero**: about half its current height.
4. **Category heroes**: each category gets its own hero (image, title, text) that the owner edits in admin. Opening a category (e.g. Dresses, Glasses) shows that hero.
5. **Sponsored products** (revised after the client answered): staff mark a product as sponsored when adding or editing it. On the storefront a sponsored product carries a tick badge, like a blue checkmark, and the homepage gets a separate section listing them. Shoppers never see the word "sponsored".
6. **Design-system docs**: update AGENTS.md §3.2, CLAUDE.md, the design-system page and the earlier prompt so they no longer name Inter or Playfair.

## Non-goals

- No colour, spacing, radius or shadow changes. The type scale (sizes, line heights, weights) stays the same; only the family changes.
- No component overhaul beyond what is listed. The broader design-system overhaul the client mentioned will be planned per component in later prompts.
- No changes to the homepage hero's content source. It stays static copy, not database-driven.
- No sponsor tiers, sponsor billing or click tracking.

## Inspected

- `src/app/layout.tsx`: loads Inter and Playfair through `next/font/google` as `--font-inter` and `--font-playfair`.
- `src/app/globals.css` `@theme`: `--font-sans` → Inter, `--font-display` → Playfair. The type scale tokens are `text-display-1` through `text-small`.
- `font-display` is used in about 30 files (headings, logo, KPI cards, accordions). Only the token is remapped, so those files don't change.
- `src/lib/auth/clerk-appearance.ts`: hard-codes `var(--font-inter)`.
- `src/components/store/home/hero.tsx`: `lg:min-h-[560px]`, `py-12 lg:py-16`, title `text-display-2 md:text-display-1`, trust row inside the hero, and the portrait bleeds 46% on the right.
- `src/components/store/product/product-purchase.tsx:180`: short description is `text-body-lg` (16/24). `product-accordions.tsx`: the accordion body is already `text-body`, and the titles are `font-display text-h2`.
- `src/app/(store)/categories/[slug]/page.tsx`: plain breadcrumbs plus `SectionHeading`, with no hero.
- `categories` table (`catalog.sql`): title, slug, description, `image_path`, sort, active. `collections` already has `hero_image_path` and `hero_image_alt`, which is the pattern to copy.
- `src/components/admin/category-form.tsx` and `features/admin/actions/categories.ts` / `catalog-images.ts`: signed uploads into `product-media`, with bytes verified on save.
- `/admin/content` page (content.manage): homepage merchandising (Featured, Bestseller) and the newsletter. A Sponsored column will be added here.
- `designs/Goreto-designsystem.png` and `designs/goreto-home.png`.
- Local docs: `node_modules/next/dist/docs/` → `next/font` (Google fonts that aren't variable need explicit `weight`).

## Decisions and assumptions

- **Poppins** comes from `next/font/google` with weights 400, 500, 600 and 700 and the latin subset. It is exposed as `--font-poppins`. Both `--font-sans` and `--font-display` point at it, so existing `font-display` classes keep working with no churn. `font-display` stays as a semantic hook for display headings in case the client wants a separate display face later.
- Poppins runs wider than Inter at the same size. If a heading wraps badly in the manual pass (product title, hero), I'll adjust that one spot and note it.
- **PDP description**: the short description changes from `text-body-lg` to `text-body` (14/20). The accordion description is already 14px, so it keeps its size and changes only its font.
- **Hero "half size"**: on desktop the minimum height goes from 560px to 280px. Padding changes to `py-8 lg:py-10`, the title to `text-display-2` (36/44) at every breakpoint, and the body copy to `text-body`. The three-item trust row moves out of the hero into a slim strip directly below it, which matches item 3 of the homepage contract (§4.1). On mobile the portrait changes from 4/3 to a 16/9 band. The phone mockup is already hidden in production (`features.arTryOn`).
- **Category hero** (my reading of "clicking a category shows that category's hero"): `/categories/[slug]` opens with that category's hero banner, using the same visual language as the homepage hero at the new smaller size: the image on the right, the eyebrow, title, text and a "Shop now" button that jumps to `#products`. If a category has no hero image, the page keeps today's plain heading, so nothing breaks before the owner fills it in. Subcategories have their own hero. They don't inherit the parent's hero.
- **Sponsored products**: a new `products.is_sponsored` flag is set in the product form's status-flags group (next to Featured and Bestseller), and with toggles on `/admin/content` and the product view page. Bulk add does not offer it; tick it in the editor afterwards. The storefront shows a filled blue tick (`SealCheck`, info-500) after the title on product cards, the quick view and the product page. Its accessible name and tooltip read "Goreto Pick", never "Sponsored", as the client asked. A homepage section, "Goreto Picks", lists active sponsored products between Featured and Collections and is hidden when there are none. In admin the flag is labelled "Sponsored" honestly. **Risk to raise with the client:** undisclosed paid placement can count as misleading advertising under Nepal's Consumer Protection Act 2075. The label is one string, so it can change later.

## Files expected to change

Phase A (type, PDP, hero, docs):
- `src/app/layout.tsx`: switch to Poppins.
- `src/app/globals.css`: `--font-sans` and `--font-display` point to `--font-poppins`.
- `src/lib/auth/clerk-appearance.ts`: font family.
- `src/components/store/home/hero.tsx`: smaller hero; the trust strip becomes a `HeroTrustStrip` export.
- `src/app/(store)/page.tsx`: render the trust strip after the hero, plus the Goreto Picks section (Phase C).
- `src/components/store/product/product-purchase.tsx`: description size.
- `src/app/design-system/page.tsx`: type specimen labels.
- `AGENTS.md` §3.2, `CLAUDE.md`, `prompts/goreto-design-system.md` (a note that Poppins superseded it), `worklog.md`.
- Tests that assert font names or hero copy, if any.

Phase B (category heroes):
- `supabase/migrations/<ts>_category_heroes.sql`: add the columns to `categories`.
- `src/types/database.ts`: regenerated, not hand-edited.
- `src/features/admin/catalog-forms.ts`: Zod fields; `features/admin/actions/categories.ts`: save the fields and verify the hero image's bytes like `image_path`.
- `src/components/admin/category-form.tsx`: a new "Category hero" section (progressive: image, eyebrow, title, text, alt).
- `src/features/catalog/categories.ts` and `types.ts`: map the hero view model.
- `src/components/store/category/category-hero.tsx` (new) and `src/app/(store)/categories/[slug]/page.tsx`.
- Tests: the mapper, the category page render with and without a hero, and the form schema.

Phase C (sponsored products):
- `supabase/migrations/<ts>_product_sponsored.sql`: `products.is_sponsored boolean not null default false`, plus a partial index. `search_products` is dropped and re-created to return `is_sponsored` (return type change). `admin_save_product` is left untouched: `saveProductAction` writes `is_sponsored` in a second update under the same catalog.write policy, which avoids copying a 300-line function for one column.
- `src/types/database.ts` (regenerated).
- `features/admin/product-form/schema.ts`, `detail-sections.tsx`, `quick-product.ts`, `duplicate.ts`, `schemas.ts` (flag enum), `actions/catalog.ts` and the `/admin/content` table column.
- `features/catalog/queries.ts`, `mappers.ts`, `types.ts` and `homepage.ts`: an `isPick` view-model field and a sponsored-products query.
- `components/ui/pick-badge.tsx` (new), the product card, quick view and product-purchase title.
- `components/store/home/goreto-picks.tsx` (new) and the homepage.
- Tests: mapper, badge, product-form schema round trip, DB test that only `catalog.write` can set it.

## Database impact

Phase B: `alter table categories add column`:
- `hero_image_path text` (null, or a storage path that isn't a URL; same check as collections);
- `hero_image_alt text not null default ''`;
- `hero_eyebrow text not null default ''` (≤ 40);
- `hero_title text not null default ''` (≤ 80; empty means use the category title);
- `hero_text text not null default ''` (≤ 240).

The change only adds columns with defaults, so it's safe on prod and there's nothing to backfill. The existing category grants and RLS cover the new columns. The migration re-checks the column grants for anon (read).

Phase C: `products.is_sponsored boolean not null default false` (additive), and `search_products` gains an `is_sponsored` output column. Anon can read the column like the other product flags. The tick is public anyway; only the wording is neutral.

## Auth and RLS

- `categories` writes stay `catalog.write`. Hero fields ride the existing policy.
- `is_sponsored` is written by the product editor and the flag toggle, both catalog.write (the same rule as Featured and Bestseller).
- DB tests cover: a `catalog.write` staff member can set category hero fields and `is_sponsored`; a customer can't.

## Validation and security

- Zod: length limits as above.
- Image uploads use the existing signed-upload flow with the byte-signature check (JPEG, PNG, WebP or AVIF; SVG isn't accepted because of script risk). The limit is 10 MB for a category hero.
- The database stores storage paths, never URLs (§26.8).

## UI references

- `designs/Goreto-designsystem.png` for tokens. The client has overridden the typeface to Poppins, and AGENTS.md §3.2 will be updated so it stays the source of truth.
- `designs/goreto-home.png` for hero composition at the reduced height and the order of homepage sections.
- The category hero reuses the homepage hero layout. The Goreto Picks section reuses `SectionHeading` and the product grid, like Featured.

## Acceptance criteria

1. The whole site, including the admin, Clerk modals and `/design-system`, renders in Poppins. No Inter or Playfair request appears in the network tab.
2. On the product page, the short description is 14/20.
3. The desktop homepage hero is about 280px tall (it was 560px). The trust row sits directly below it. Mobile has no horizontal scroll.
4. In admin, the owner can set a hero image, eyebrow, title, text and alt on a category. `/categories/<slug>` shows that hero. A category without a hero image shows the old heading.
5. Ticking "Sponsored" on a product shows the blue "Goreto Pick" tick on its card, quick view and product page, and lists it under Goreto Picks on the homepage. Unticking removes both. The word "sponsored" appears nowhere on the storefront.
6. Typecheck, lint, `npm test`, `npm run test:db` and `npm run build` pass.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`. Manual pass in the browser at 1440px and 390px.

## Manual test steps

1. `npm run dev` and open `/`. The font is Poppins in DevTools → Computed, and the hero is short with the trust strip below it.
2. Open a product. The description is smaller, and the title and accordions are in Poppins.
3. Open `/admin/categories`, edit "Dresses", fill in the Category hero section, upload an image and save. Open `/categories/dresses` and check the hero. Then open a category with no hero and check the plain heading.
4. Edit a product, tick Sponsored and save. On the homepage, check the Goreto Picks section and the tick on the card. Open the product page to see the tick next to the title, and hover it to read "Goreto Pick". Untick it and check that both are gone.
5. Sign in through the modal and check that the Clerk UI is in Poppins.

## Rollout

Apply migrations to dev with `npm run db:push`, then regenerate types. For prod, `node --env-file=.env.production.local … --dry-run` comes first, then the push, then the merge to `production`. Both migrations are additive. To roll back, drop the new columns and restore the previous `admin_save_product`. No existing data is touched.

## Implementation notes (2026-10-04)

- Shared `HeroBanner` (`src/components/store/hero-banner.tsx`) serves the homepage and category heroes. The decorative AR phone mockup was dropped from the homepage hero: it didn't fit at half height and was already hidden in production (`features.arTryOn`).
- The orphaned-upload cleanup (`admin_orphaned_storage_objects`) now also keeps `categories.hero_image_path`. Without that, the cleanup button would have deleted hero photos.
- Deleting a category leaves its hero photo for the cleanup button (`admin_delete_category` returns only the tile image).
- `next build` in the main checkout loads `.env.production.local`, so prerendering reads **prod**. Until prod has these migrations, a local build fails on `/categories`. To verify against dev, run the build with `.env.local` loaded into `process.env` first.
- `scripts/seed/seed.test.ts` "is exactly what the generator produces" fails on the base commit too, and its result changes between runs. It isn't caused by this work.
- The signed-in admin screens (category hero section, Sponsored checkbox and toggles) were covered by component and DB tests, not by a signed-in browser pass.
