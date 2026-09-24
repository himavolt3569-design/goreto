# Implement the Goreto.store product details page

## Goal

Build the canonical product details page at `/products/[slug]` from `designs/Goreto-products page.png`. Every product card on the storefront (the homepage featured grid and this page's "You May Also Like" rail) opens it.

Like the homepage, the data comes from the typed **development seed catalog**, which is served only outside production. A later Supabase catalog task replaces the bodies of the data functions without changing the page.

## Non-goals

- Supabase schema, migrations, RLS, generated types.
- Quick-view modal (AGENTS §4.3). The request is "click opens the details page"; the canonical page comes first.
- The pages behind other links: `/categories/[slug]`, `/try-on`, `/cart`, `/checkout`. They 404 until their own tasks ship.
- Real AR, reviews list, wishlist persistence.
- Variant in the URL (`?variant=`). Variant choice is local UI state for now.
- GSAP motion on this page.

## What I inspected

- `AGENTS.md` §3 (tokens), §4.2 (product details contract), §7 (routes), §8 (state), §14 (AR is capability-based), §22 (a11y), §26 (fake AR, browser trust, money).
- `prompts/goreto-homepage.md` and `prompts/goreto-design-system.md`.
- `src/features/catalog/{types,dev-seed,homepage,featured-tabs}.ts` and tests. The seed is gated by `NODE_ENV !== "production"`.
- `src/components/ui/*`: `ProductCard`, `MediaFrame`, `Rating` (single-star only), `Badge`, `Button`/`buttonClasses`, `IconButton`/`iconButtonClasses`, `StatusIndicator` (in stock / low stock / sold out), `Card`, `SectionHeading`, `icons.ts`.
- `src/components/store/home/featured-products.tsx`: cards already link to `/products/${slug}`, but the route does not exist, so every click 404s today.
- `src/app/(store)/layout.tsx`, `src/app/layout.tsx` (title template `%s | Goreto.store`), `next.config.ts` (picsum `remotePatterns`), `globals.css` tokens.
- `package.json`: Next 16.3.6, React 19.2.8, Tailwind 4, Vitest 4, npm. No `zustand`. No `cacheComponents`.
- Local Next docs: `03-file-conventions/dynamic-routes.md` (`params` is a Promise; `PageProps<'/products/[slug]'>`), `04-functions/generate-static-params.md`, `04-functions/not-found.md`, `03-file-conventions/not-found.md`, `04-functions/generate-metadata.md`.
- Picsum photos reviewed on a contact sheet (628, 7, 325, 64, 21, 26, 836, 669, 823, 758, 604, 1005, 996) to name new seed products after what they show.

## Decisions

1. **Route.** `src/app/(store)/products/[slug]/page.tsx`, a Server Component.
   - `generateStaticParams` returns the seed slugs (empty in production).
   - `generateMetadata` sets the title and description from the product.
   - Unknown slug → `notFound()`. A `not-found.tsx` beside it shows "Product not found" with a link back to the shop.

2. **Data layer.** `src/features/catalog/product-detail.ts`:
   - `getProductBySlug(slug)`: returns `ProductDetail | null`. Returns `null` in production.
   - `getRelatedProducts(product, limit = 8)`: same category first, then others; never the product itself. Five show per page on desktop, and the rail arrows scroll to the rest.
   - `getProductSlugs()`.
   - View models live in `types.ts`: `ProductDetail`, `ProductVariant`, `ProductOption`, `ProductMedia`, `ProductSpec`, `ProductTryOn`. Money stays in integer paisa.

3. **Seed catalog grows from 5 to 10 products.** One detailed list, `seedProducts`, in `dev-seed.ts`. `seedFeaturedProducts` is derived from it, so the homepage shows the same 5 products in the same order. New products, named after their photos:

   | Product | Category | Picsum |
   | --- | --- | --- |
   | Knit Slouch Beanie (Grey / Red variants, each with its own photo) | hats | 669, 823 |
   | Felt Fedora | hats | 836 |
   | Aztec Blanket Scarf | scarves | 758 |
   | Leather Moto Jacket | outerwear | 1005 |
   | Suede Ankle Boots | boots | 604 |

   Seed ratings, badges, specs and care text are dev-only, like the homepage testimonials.

4. **Variants are real.** Each product has `options` (e.g. Color or Size) and `variants` (SKU, option values, optional price override, stock).
   - Choosing an option switches the purchasable variant: price, stock status, SKU and, when the variant has its own photos (the beanie), the gallery.
   - Swatches show the variant photo when one exists, otherwise a colour chip or a text pill (sizes).
   - Sold-out variants stay selectable (so shoppers can see them), are marked "Sold out", and disable Add to Cart / Buy Now.
   - Pure logic in `src/features/catalog/variants.ts` (client-safe): `findVariant`, `selectOption`, `stockState`, `variantPrice`, `mediaForVariant`.
   - Products with a single variant show no selector.

5. **Layout (desktop, matching the reference).**
   - Breadcrumbs: Home › Category › Product (`nav aria-label="Breadcrumb"`, `aria-current="page"`).
   - Two columns: gallery (vertical thumbnail rail + main image, about 55%) and the info column.
   - Full-width "Try It On in AR" card.
   - Two cards side by side: Product Details spec table, and the accordions.
   - "You May Also Like" rail with previous/next buttons.
   - Mobile: everything stacks; thumbnails become a horizontal row under the main image.

6. **Gallery** (`ProductGallery`, client).
   - Thumbnails are buttons with `aria-current` on the selected one; the main image follows.
   - Main image uses `priority` (it is the LCP).
   - Wishlist heart on the image: same inert "coming soon" control as the homepage.
   - Expand button opens a native `<dialog>` lightbox (focus trapped by the browser, Escape closes, focus returns to the button).
   - The down-caret scroll control shows only when there are more than 5 thumbnails.

7. **Info column** (`ProductPurchase`, client, owns the selected variant and renders the gallery too).
   - Badge (BESTSELLER / NEW), title in Playfair (`font-display text-display-2`, as in the reference), star rating, price, stock status (`StatusIndicator`: "In Stock", "Only N left", "Sold Out"), short description, option selector, quantity stepper, Add to Cart, Buy Now.
   - Option selector: native radio inputs in a `fieldset` with a `legend`, so arrow keys work for free.
   - Quantity: `QuantityStepper` in `components/ui` (−, number input, +), clamped to 1…stock (max 10 per line).
   - Buy Now uses the secondary button with the reference's soft fill (`bg-primary-100 border-primary-200`), set via `className` and commented.

8. **Add to Cart and Buy Now.** You chose **A** at approval time.
   - **A (chosen): minimal cart store now.** Add `zustand` and `src/features/cart/store.ts` (persisted to `localStorage`, `skipHydration` + rehydrate on mount to avoid a hydration mismatch). Lines are keyed by variant id and hold a display snapshot (title, variant label, image, unit price, quantity). Totals in the store are a **preview only**; checkout recalculates on the server (AGENTS §8, §26.4).
     - Add to Cart adds the variant and quantity, then announces "Added to cart" in a live region with a "View cart" link.
     - Buy Now adds the line and navigates to `/checkout`.
     - The header cart badge shows the real line-quantity count (new `HeaderCart` client wrapper around `CartButton`).
     - `/cart` and `/checkout` 404 until their tasks ship.
   - **B: no cart yet.** Both buttons render `aria-disabled` with "Cart coming soon", like the homepage wishlist.

9. **Rating.** Add `variant?: "compact" | "stars"` to `Rating`. `stars` draws five stars with a partial fill for the fraction (4.8 → 4 full + 80%). Same accessible label. "(120 reviews)" is plain text, not a link, because no reviews section exists yet.

10. **Reassurance row (business rules override the screenshot).** The reference says "Free Delivery / All over Nepal" and "Secure Payment / 100% safe checkout". Delivery fees are configurable and payment is COD only, so those claims would be false. I'll show:
    - Truck: "Delivery across Nepal" / "Fees shown at checkout"
    - Arrow: "Easy Returns" / "7-day returns"
    - Money: "Cash on Delivery" / "Pay when it arrives"
    These strings live in `siteConfig.productAssurances` so you can edit them. **Please confirm the 7-day returns policy** (it is taken from the reference).

11. **Try It On in AR** (AGENTS §14, capability-based).
    - Renders only when the product has a `tryOn` capability. The seed gives one to Aviator Sunglasses (face, live camera) and Beaded Wrist Stack (wrist, live camera). Other products show no AR card.
    - The copy follows the modes: camera → "Use your camera…"; photo → "…or upload a photo." No product claims photo upload, because no provider exists.
    - The button links to `/try-on?product=<slug>`, which 404s until the AR task ships. No fake result is shown.
    - The card image is decorative, with the reference's corner-bracket frame.

12. **Spec table and accordions.**
    - Specs are a semantic `<table>` (`th scope="row"`) with striped rows.
    - Accordions are native `<details>`/`<summary>` (work without JS, keyboard-accessible). Description is open by default.
    - Shipping & Delivery and Returns & Refunds use store-level copy from `siteConfig` (truthful: courier options and fees at checkout, COD). Care Instructions come from the product.

13. **"You May Also Like".** Server-rendered `ProductCard`s with rating, inside a small client `ProductRail` (horizontal scroll-snap row; previous/next buttons scroll one page and disable at the ends). The cart action links to the product page, the same as on the homepage.

14. **New icons** in `icons.ts`: `ArrowCounterClockwiseIcon`, `MoneyIcon`, `MinusIcon`, `PlusIcon`, `ClockCounterClockwiseIcon`, `CaretUpIcon`. The partial star is a clipped overlay, so no half-star icon is needed.

## Files expected to change

```text
src/app/(store)/products/[slug]/page.tsx           route, metadata, static params
src/app/(store)/products/[slug]/not-found.tsx      product 404
src/features/catalog/types.ts                      + ProductDetail and related view models
src/features/catalog/dev-seed.ts                   seedProducts (10); seedFeaturedProducts derived
src/features/catalog/product-detail.ts (+ test)    getProductBySlug, getRelatedProducts, getProductSlugs
src/features/catalog/variants.ts (+ test)          variant resolution, stock state, media per variant
src/config/site.ts                                 productAssurances, shipping/returns copy
src/components/ui/rating.tsx (+ test)              "stars" variant
src/components/ui/quantity-stepper.tsx (+ test)    new primitive (+ index.ts export)
src/components/ui/icons.ts                         + icons above
src/components/store/product/breadcrumbs.tsx
src/components/store/product/product-purchase.tsx  "use client" gallery + info, owns variant
src/components/store/product/product-gallery.tsx   "use client" thumbnails + lightbox
src/components/store/product/option-selector.tsx   swatches / size pills
src/components/store/product/try-on-card.tsx
src/components/store/product/product-specs.tsx
src/components/store/product/product-accordions.tsx
src/components/store/product/product-rail.tsx      "use client" related scroller
src/components/store/product/__tests__/*.test.tsx  purchase panel + gallery

Only with cart option A:
package.json / package-lock.json                   + zustand
src/features/cart/store.ts (+ test)                persisted cart store
src/components/store/header-cart.tsx               "use client" live count; used in store-header.tsx
src/components/store/store-header.tsx              CartButton → HeaderCart
```

## Database, auth, and RLS impact

None. No persistence beyond the shopper's own `localStorage` (option A).

## Security and validation

- `slug` comes from the URL. It is only compared against seed slugs; unknown values 404. Nothing reaches SQL.
- Cart prices are display snapshots and are never trusted (checkout will recalculate server-side).
- Quantity is clamped client-side for UX only; stock truth stays with the future `place_order` RPC.
- No secrets, no new remote image hosts.

## UI reference and constraints

- `designs/Goreto-products page.png` for composition; Design System tokens only (colours, `text-*`, 4px spacing, radii, shadows); Phosphor icons.
- Container `max-w-7xl px-4 md:px-8`, as on the homepage.
- Off-scale value: main image `aspect-[7/8]` to match the reference's portrait frame.
- Header and footer stay the shared store components; the reference's slightly different nav labels are not copied.

## Acceptance criteria

- Clicking any homepage featured card (image, title, or cart button) opens `/products/<slug>` with that product. Clicking any "You May Also Like" card opens that product.
- At about 1280px the page matches the reference: breadcrumbs, gallery + info, AR card (for AR-capable products), specs + accordions, related rail.
- Changing a variant updates price, stock status and (for the beanie) the gallery. A sold-out variant disables purchase.
- Quantity cannot go below 1 or above the available stock (max 10).
- Thumbnails switch the main image; the lightbox opens, traps focus, closes with Escape, and returns focus.
- Accordions open and close with the keyboard. The spec table is a real table.
- `/products/does-not-exist` shows the product not-found page with a 404 status.
- At 375px everything stacks with no horizontal page scroll (only the related rail scrolls).
- Option A: Add to Cart updates the header badge and survives a reload; Buy Now goes to `/checkout`.
- A production build has no seed products, so every product URL 404s there.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run dev   # scratchpad playwright-core script: click every featured card, screenshot /products/<slug> at 1280 and 375, keyboard checks
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/`, click each featured product's image, title and bag button. Each opens its product page.
2. On `/products/beaded-wrist-stack`, compare with `designs/Goreto-products page.png`.
3. Click the thumbnails; press the expand button, then Escape.
4. Open `/products/knit-slouch-beanie`, switch Grey ↔ Red; the gallery, price and stock follow.
5. Open `/products/white-lace-sundress`, choose the sold-out size; Add to Cart and Buy Now disable.
6. Use − / + on the quantity; it stops at 1 and at the stock limit.
7. Tab to the accordions and toggle them with Enter / Space.
8. Use the related rail's arrows, then click a related product.
9. Open `/products/nope` and check the not-found page.
10. Resize to 375px and check there's no horizontal page scroll.
11. (Option A) Add to cart, check the header badge, reload, the badge persists.

## Rollback

Additive apart from the seed refactor and the `Rating` / header changes. Revert the commit. No data impact.

## Changes made during execution

- The seed's featured flag became an ordered `FEATURED_SLUGS` list, so the homepage still shows the same 5 products in the same order.
- The inert wishlist heart and the card's "choose options" bag link moved into `src/components/store/product-card-actions.tsx`. The homepage grid, the gallery and the related rail all use them.
- The spec table and accordions are server components. Only the purchase area, gallery, option selector, stepper and related rail are client components.
- Buy Now's soft style lives in `src/components/store/product/classes.ts` (`SOFT_SECONDARY`), shared with Try in AR.
- When the cart is already at a line's limit, Add to Cart shows a warning message instead of a success message.

### Verification

`npm run typecheck`, `npm run lint`, `npm test` (18 files, 87 tests) and `npm run build` all pass. The build prerenders no product pages in production, as intended.

I ran a scratchpad `playwright-core` script against the dev server, and every check passed:
- title, image and bag clicks on all 5 homepage cards
- lightbox focus and Escape
- thumbnails
- accordion opening with the keyboard
- cart badge updating and surviving a reload
- beanie variant switching its gallery
- sold-out size disabling purchase
- no AR card on products without try-on
- a click on a related product
- Buy Now going to `/checkout`
- a 404 for an unknown slug
- no horizontal overflow at 375px

One dev-only console warning appears on 404 pages: "Encountered a script tag while rendering React component". It is not new. It comes from the root layout's inline `js`-class script, which was added in the homepage task.
