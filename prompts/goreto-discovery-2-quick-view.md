# Discovery phase 2: product quick view

Second of five discovery phases (worklog §4.2): 1. Search ✅ → **2. Quick view** → 3. Collections → 4. Offers → 5. Product-page reviews. Each phase gets its own prompt and approval.

## Goal

AGENTS §4.3: clicking a product on a discovery surface (homepage featured grid, category grid, search results, "You May Also Like" rail, and later collections/offers) opens a **quick-view modal** over the current page. The address bar shows the canonical `/products/[slug]`, so:

- refresh, a shared link or a new tab opens the **full product page** (never the modal);
- Back closes the modal, Forward reopens it;
- the full page stays the canonical, SEO-indexed page. The modal is never the only way in.

In the modal the shopper can pick the variant, see price/stock/photos follow the choice, set quantity, Add to Cart or Buy Now, and open the full details.

## Non-goals

- A separate "Quick view" eye button. The whole card and its bag icon ("Choose options for …") both open the quick view; the bag icon's promise ("choose options") is now kept without leaving the listing.
- Reviews, specs, accordions or the AR card inside the modal (full page only).
- Changing the document title while the modal is open.
- Quick view from admin pages (admin has its own layout, so no interception there).

## What I inspected

- `AGENTS.md` §4.2, §4.3, §8, §22, §25; `worklog.md` §4.2; `prompts/goreto-product-details.md`, `prompts/goreto-discovery-1-search.md`.
- Next 16 docs: `03-file-conventions/intercepting-routes.md`, `parallel-routes.md` (modal example, `default.js`, slots keep their state on soft navigation), `default.md`, `04-functions/revalidatePath.md` (works on route files, not URLs).
- `src/app/(store)/layout.tsx`, `src/app/(store)/products/[slug]/page.tsx` (ISR 60 s, `generateStaticParams`).
- `src/components/store/product/{product-purchase,product-gallery}.tsx` (+ tests), `src/components/ui/product-card.tsx` (stretched title link), `src/components/store/{product-grid,product-card-actions}.tsx`, `src/components/store/home/featured-products.tsx`, `src/components/store/cart/cart-line-row.tsx`.
- `src/features/catalog/product-detail.ts` (`getProductBySlug`, React `cache` only), `src/features/admin/actions/helpers.ts` (`revalidateStorefrontCatalog`: `CATALOG_CACHE_TAG` with `expire: 0` + `revalidatePath`).
- Design references: `Goreto-products page.png` and `Goreto-designsystem.png` (no quick-view screenshot exists, so the modal reuses the product page's purchase column and design-system tokens).

## Decisions

1. **Intercepting + parallel routes** (the pattern AGENTS §4.3 asks for when supported):
   - `src/app/(store)/@modal/default.tsx` returns `null` (hard loads, and every route that isn't intercepted).
   - `src/app/(store)/@modal/(.)products/[slug]/layout.tsx` renders the modal shell; `loading.tsx` a skeleton inside it; `page.tsx` the content. The shell stays mounted while the content streams in, so the dialog opens instantly and doesn't re-open (and lose focus) when data arrives.
   - `(store)/layout.tsx` renders `{modal}` after the footer.
   - Every soft navigation to `/products/[slug]` from a storefront page opens the modal. That includes the cart line title (a quick look, then Close returns to the cart); I'm not special-casing it.

2. **Modal shell** (`src/components/store/quick-view/quick-view-modal.tsx`, client):
   - Native `<dialog>` opened with `showModal()`: the browser traps focus, and Escape fires `cancel`.
   - Close button (X, "Close quick view"), Escape and a backdrop click all call `router.back()`, so history stays correct.
   - Renders nothing once `usePathname()` is no longer this product's URL. Parallel slots keep their last state on soft navigation, so without this the modal would stay open after "View cart" or "Buy Now".
   - On close, focus returns to the element that opened it (the card link is still on the page underneath).
   - Page scroll is locked while open with a CSS rule, `html:has(dialog[data-scroll-lock][open]) { overflow: hidden }`, in `globals.css`.
   - Size: `w-full max-w-5xl`, 16 px viewport margin, `max-h` of the viewport minus 32 px, with the content scrolling inside; radius `xl`, `shadow-xl`, `backdrop:bg-neutral-900/60`; padding 16 / 24 / 32 by breakpoint.
   - `aria-labelledby="quick-view-title"` (the product title heading).

3. **Content**: `ProductPurchase` gains `variant?: "page" | "quick-view"` (default `page`, so the product page is unchanged):
   - `quick-view`: the title is an `h2#quick-view-title` at `text-h1` (Playfair) and never bumps to Display 2, because the page underneath keeps its own `h1`.
   - Gallery gets `compact`: horizontal thumbnail rail under the image at every width (no 528 px vertical rail), `sizes` for a ~480 px column, no `priority`.
   - Under the purchase buttons: a **"View full details"** text link with an arrow to `/products/[slug]`. This link is a plain `<a>` on purpose: a client navigation to the URL already shown would be intercepted again, while a full load renders the canonical page.
   - Option selection, stock, quantity, Add to Cart, Buy Now, the "Added … View cart" status and the assurances row are all reused as-is.
   - Unknown or no-longer-active product: the modal shows "This product isn't available any more" with "Browse all products" (`/search`), instead of a 404 inside a slot.

4. **Freshness**: the product page's ISR entry is revalidated by path, but the intercepted route is a different route file. So the quick view reads through a new `getQuickViewProduct(slug)` in `product-detail.ts`: `unstable_cache` keyed by slug, 60 s, tag `CATALOG_CACHE_TAG`. Admin edits already expire that tag at once (`expire: 0`), so a product staff just hid never appears in a quick view. The intercepted page itself is dynamic; this doesn't change the product page's static/ISR rendering.

5. **Scroll**: opening the modal must not jump the page underneath. If the browser pass shows Next scrolling to the new segment, I'll add `scroll={false}` to the card links (`ProductCard` title link, `ChooseOptionsLink`) and note it here.

6. Tokens and icons only (`XIcon`, `ArrowRightIcon` already exist in `icons.ts`); no new dependencies.

## Files expected to change

```text
src/app/(store)/layout.tsx                                   render the @modal slot
src/app/(store)/@modal/default.tsx                           new: null
src/app/(store)/@modal/(.)products/[slug]/layout.tsx         new: modal shell
src/app/(store)/@modal/(.)products/[slug]/loading.tsx        new: skeleton
src/app/(store)/@modal/(.)products/[slug]/page.tsx           new: quick-view content / unavailable state
src/components/store/quick-view/quick-view-modal.tsx         new, "use client"
src/components/store/quick-view/__tests__/quick-view-modal.test.tsx   new
src/components/store/product/product-purchase.tsx            variant prop, full-details link
src/components/store/product/product-gallery.tsx             compact prop
src/components/store/product/__tests__/product-purchase.test.tsx      quick-view variant cases
src/features/catalog/product-detail.ts                       getQuickViewProduct (tagged cache)
src/app/globals.css                                          dialog scroll lock
worklog.md                                                   mark Quick view done
```

## Database / auth

None. Public catalog reads through the existing anon client; no `auth()`, no migration.

## Tests

- `quick-view-modal.test.tsx` (router and pathname mocked): opens as a modal with the right accessible name; Close button, Escape (`cancel`) and backdrop click each call `router.back()` once; a click inside the content doesn't close it; renders nothing when the pathname moves away; focus returns to the opener on unmount.
- `product-purchase.test.tsx`: `variant="quick-view"` renders the title as an `h2` with `id="quick-view-title"` and a "View full details" link to the canonical URL; the default variant still renders an `h1` and no such link. Variant selection and add to cart are already covered.

## Acceptance criteria

1. On `/`, `/categories/[slug]` and `/search`, clicking a product card or its bag icon opens the quick view; the URL becomes `/products/[slug]`; the page underneath doesn't move.
2. Choosing a different option updates price, stock and photos; Add to Cart updates the header badge and shows "Added … View cart".
3. Close, Escape, a backdrop click and browser Back each close the modal and return focus to the card; Forward reopens it.
4. Reloading while the modal is open shows the full product page with breadcrumbs, specs and related products.
5. "View full details" opens the full product page; "View cart" and "Buy Now" close the modal and navigate.
6. On the full product page, a "You May Also Like" card opens a quick view over it.
7. Tab stays inside the modal; every control has a visible focus ring; the page behind doesn't scroll.
8. At 375 px the modal fits with 16 px margins, scrolls internally, and there's no horizontal scroll.
9. A product archived in admin no longer opens in the quick view (the unavailable state shows).
10. With JavaScript off, card links go straight to the full product page.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build            # confirm /products/[slug] is still ISR and the intercepted route builds
npm run dev              # scratchpad playwright-core script: criteria 1-8 and 10 at 1280 and 375 px
```

## Manual test steps

1. `npm run dev`, open `/`, click a featured product card.
2. Change colour/size, Add to Cart, check the header badge.
3. Press Escape; reopen via the bag icon; click the backdrop; reopen; press browser Back, then Forward.
4. With the modal open, reload the page.
5. Open a quick view, click "View full details". On that page, click a "You May Also Like" card.
6. Repeat step 1 on `/search?q=earrings` and a category page, then at 375 px width.
7. Disable JavaScript and click a card.

## Rollback

Delete the `@modal` folder and revert the commit. No data or schema involved.

## Changes made during execution

- **Sticky modal header.** The close button now sits in a sticky "Quick view" header row, not floating over the content. On a phone the gallery comes first, so a floating X would have covered the image's wishlist heart. It also stays in reach while the modal scrolls.
- **`QUICK_VIEW_TITLE_ID` lives in `components/store/quick-view/ids.ts`.** A server component that imports a non-component export from a `"use client"` module gets a client reference, not the string.
- **No `scroll={false}` (decision 5).** The browser pass first reported the homepage moving 950 → 510 px on open. The cause was the check itself: it measured while the homepage's GSAP reveal was still running. After the reveal settled, the page stayed put on `/` and `/search`, so the links are unchanged.
- The "Tab stays inside" check counts the browser chrome (`body`) as allowed, because native modal dialogs cycle focus through it. Focus never reached the page behind the modal.

### Verification

- `npm run typecheck`, `npm run lint` pass. `npm test`: 66 files, 488 tests (8 new).
- `npm run build` passes. `/products/[slug]` is still SSG/ISR (1m), and `/` and `/categories` are still static.
- A scratchpad `playwright-core` script ran against `npm run dev` on the final code (no `scroll={false}`): 25/25 checks for acceptance criteria 1–8 and 10, plus the unavailable state, at 1280 and 375 px. The page stayed at 950 → 950 px on open, and there were no console errors.
