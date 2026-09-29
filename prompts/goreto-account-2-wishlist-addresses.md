# Account phase 2: wishlist (with the storefront heart) + addresses

Second of three customer-account phases (AGENTS §4.9, worklog §4.3): 1. shell + overview + orders + tracking + billing ✅ → **2. Wishlist (incl. the storefront heart) + addresses** → 3. Reviews + Profile & security.

## Goal

- **Storefront heart**: the inert "coming soon" heart on product cards, the product gallery and quick view becomes a real save/unsave toggle.
- **Wishlist** `/account/wishlist`: saved products with current price, stock state, Add to Cart (or Choose options) and Remove.
- **Addresses** `/account/addresses`: list, add, edit, delete and set a default Nepal address. Checkout already prefills the default (`features/checkout/prefill.ts`), so this makes that prefill reachable.
- Nav gains a **Saved** group: Wishlist, Addresses.

## Non-goals

- Reviews, profile & security (phase 3); guest-order claiming.
- A saved-address picker or "save this address" checkbox at checkout. Checkout keeps prefilling the default only.
- "Use current location" on the account address form (checkout keeps it). Coordinates of an edited address are kept as they are; new addresses save none.
- Guest (signed-out) wishlist in local storage, wishlist sharing, price-drop alerts.
- No change to storefront caching: product pages stay static/ISR.

## What I inspected

- `AGENTS.md` §4.9, §8, §9, §11.4, §11.6, §15.3, §15.5, §16, §22; `worklog.md` §4.3; `prompts/goreto-account-1-orders-billing.md`.
- `supabase/migrations/20260924144035_engagement.sql`: `customer_addresses` (own CRUD + staff read RLS, one-default partial unique index, hierarchy/ward validation trigger) and `wishlist_items` (own select/insert/delete, `unique (user_id, product_id)`); `harden_grants`; `clerk_profile_sync` (deleted users lose addresses and wishlist); `account_reads`.
- `src/components/store/product-card-actions.tsx` (`WishlistSoonButton`) and its users: `product-grid.tsx`, `home/featured-products.tsx`, `product/product-gallery.tsx` (also in quick view), `products/[slug]/page.tsx` (related), `design-system/page.tsx`; `header-auth.tsx` (heart → `/account/wishlist`, sign-in modal when signed out).
- `src/features/catalog/{queries,mappers,variants,types}.ts` (cards carry `slug`, not id; `variantPrice`, `stockState`, `maxPurchasable`), `src/features/cart/store.ts` (`addLine`, line snapshot).
- `src/features/checkout/{prefill,schemas,actions}.ts`, `src/components/delivery/nepal-address-fields.tsx`, `src/features/delivery/nepal-address{,-data}.ts`, `src/lib/validation/phone.ts`.
- `src/features/account/{nav,queries}.ts`, `src/components/store/account/*`, `src/app/(account)/account/*`, `src/lib/auth/profile.ts`, `src/components/ui/icons.ts`.
- Next docs: `01-getting-started/07-mutating-data.md` (Server Functions are for mutations and are dispatched one at a time), `02-guides/client-side-data-fetching/index.md`, `01-getting-started/15-route-handlers.md`.

## Decisions

1. **Heart without making the storefront dynamic.** Pages stay cached, so the saved state loads in the browser:
   - `GET /api/account/wishlist` (route handler, `Cache-Control: private, no-store`) returns `{ slugs: string[] }` for the signed-in user through `getUserSupabase()`; 401 when signed out. A route handler rather than a Server Action because it's a read (docs: Server Functions are for mutations).
   - A small non-persisted Zustand store (`src/features/wishlist/store.ts`) holds the saved slugs, loaded once per Clerk `userId` and cleared on sign-out. No new library.
   - `WishlistButton` (client, replaces `WishlistSoonButton`, same look): `aria-pressed`, accessible name "Save/Remove {title} from wishlist", filled heart in `primary-500` when saved (filled weight = selected state, §3.6), optimistic toggle that reverts on failure with a polite live-region message.
   - Signed out: opens the Clerk sign-in **modal** (like the header heart). The pending slug is kept in the store and saved once the session appears, so "save → sign in" ends saved without a second click.
2. **Mutations are Server Actions** in `src/features/wishlist/actions.ts`: `saveToWishlist(slug)` / `removeFromWishlist(slug)`. Zod-validated slug, `requireProfile()`, product id resolved from an **active** product, insert with `on conflict do nothing` (idempotent), delete by `(user_id, product_id)`. RLS enforces ownership underneath. Both revalidate nothing shared (the wishlist page is dynamic).
3. **Wishlist page** reads `wishlist_items` with embedded `products(… product_variants, cover media)` through the Clerk-token client, `.eq("user_id", profile.id)`, newest first, mapped to a view model in `features/wishlist/mappers.ts`:
   - price: lowest active variant price via `variantPrice` ("From Rs." when variants differ); stock via `stockState` over active variants (In stock / Low stock / Sold out, text + tone);
   - action: exactly one active variant with stock → **Add to Cart** (client, `addLine` with the usual snapshot, capped by `maxPurchasable`); several variants → **Choose options** (product page); sold out → disabled "Sold out";
   - a product that is no longer active (draft/archived/deleted from view) shows "No longer available" with Remove only;
   - **Remove** per item; empty state "Nothing saved yet" + "Browse products".
   - Grid of the existing `ProductCard` look (2 / 3 columns), no pagination; the list is capped (below).
4. **Addresses: one migration** `supabase/migrations/20261002090000_account_addresses_wishlist.sql`:
   - `account_save_address(p_id uuid, p_label, p_recipient_name, p_phone_e164, p_province_code, p_district_code, p_municipality_code, p_ward, p_street_landmark, p_postal_code, p_make_default boolean) returns uuid` — insert when `p_id` is null, otherwise update the caller's own row (not found → `P0002`). Making it default clears the previous default in the same transaction (the partial unique index makes a two-request swap fail). The first address is always the default.
   - `account_set_default_address(p_id uuid)`; `account_delete_address(p_id uuid)` — deleting the default promotes the most recently updated remaining address.
   - All `security invoker`, `set search_path = ''`, filtering on `public.current_profile_id()`, so RLS applies too. `revoke … from public, anon; grant execute … to authenticated`.
   - Caps enforced by triggers so direct PostgREST inserts can't bypass them: **10 addresses** and **200 wishlist items** per profile (`23514`, mapped to a friendly message).
5. **Address UI**:
   - `/account/addresses`: cards with label, Default badge, recipient, formatted phone (`formatNepalPhone`), address lines (`formatAddressLines`), and Edit / Set as default / Delete (delete asks for confirmation in the existing dialog pattern). "Add address" disabled with a note at 10. Empty state "No saved addresses" + "Add address".
   - `/account/addresses/new` and `/account/addresses/[id]/edit`: one `AddressForm` (React Hook Form + Zod) reusing `NepalAddressFields`: label (Home/Work/Other + free text, max 40), recipient name, +977 phone (`requiredNepalPhoneSchema`), Province → District → Municipality → Ward, street/landmark, postal code, "Use as my default address" checkbox. Server Action parses the same schema, calls the RPC, then redirects to the list. An unknown or someone else's id → `notFound()`.
6. **Nav**: `ACCOUNT_NAV` gains `{ label: "Saved", items: Wishlist (heart), Addresses (map pin) }` between Orders and the future Profile group. Header and mobile-menu wishlist links now land on a real page.
7. **Every page calls `requireProfile()`**; pages add their own loading-safe empty states and use the shell's `loading.tsx`/`error.tsx`.
8. **Tokens only**; icons from `icons.ts` (heart, map pin, pencil, trash, plus, check — all already exported).

## Files expected to change

```text
supabase/migrations/20261002090000_account_addresses_wishlist.sql   new: address RPCs, caps
src/types/database.ts                                             regenerated (npm run db:types)
src/app/api/account/wishlist/route.ts                             new: GET saved slugs
src/features/wishlist/{store,actions,queries,mappers}.ts (+ tests) new
src/features/account/addresses.ts (+ test)                        new: schema, queries, error mapping
src/features/account/address-actions.ts                           new: save / set default / delete
src/features/account/nav.ts (+ test)                              Saved group
src/components/store/wishlist-button.tsx (+ test)                 new, replaces WishlistSoonButton
src/components/store/product-card-actions.tsx                     drop WishlistSoonButton
src/components/store/{product-grid,home/featured-products,product/product-gallery}.tsx   use WishlistButton
src/app/(store)/products/[slug]/page.tsx, src/app/design-system/page.tsx                 use WishlistButton
src/components/store/account/account-nav.tsx                      icons for new items
src/components/store/account/{wishlist-grid,address-card,address-form}.tsx (+ tests)     new
src/app/(account)/account/wishlist/page.tsx                       new
src/app/(account)/account/addresses/page.tsx                      new
src/app/(account)/account/addresses/new/page.tsx                  new
src/app/(account)/account/addresses/[id]/edit/page.tsx            new
tests/db/account-addresses-wishlist.test.ts                       new
worklog.md                                                        mark phase 2 done
```

## Database / migration impact

Three functions and two cap triggers. No table, column, policy or data change. Verify with `npm run test:db`, then `npm run db:push` to hosted dev and `npm run db:types`. Rollback: drop the three functions, the two triggers and their trigger functions.

## Auth / RLS

- `/account(.*)` is session-protected in `src/proxy.ts`; `/api/account/wishlist` checks the session itself (401) — the proxy only protects page paths.
- All reads and writes use `getUserSupabase()` (Clerk token). No service role.
- Existing own-row RLS on both tables stays the authority; RPCs are invoker and filter on `current_profile_id()` again, so staff with `customers.read` can't edit another customer's address through them.
- Storefront pages stay public and cached; no user data is rendered on the server there.

## Validation and security

- Slugs validated (`^[a-z0-9-]{1,120}$`) before any query; only active products can be saved.
- Address schema: recipient 2–100, label 1–40, street 2–200, 5-digit postal code or empty, ward 1–99; phone normalised to E.164 with libphonenumber; hierarchy and ward checked again by the existing DB trigger.
- `p_id`/`[id]` must be a UUID; not-owned ids behave like missing ones (no existence leak).
- Add to Cart from the wishlist is a preview like any card: checkout re-prices on the server.

## Tests

- **DB** (PGlite, rolled back): save inserts and makes the first address default; switching default leaves exactly one; deleting the default promotes another; the 11th address and 201st wishlist item fail; a customer can't save/update/delete/default another customer's address; staff with `customers.read` can read but not change others' addresses; `anon` can't execute the functions or touch `wishlist_items`; duplicate wishlist insert is a no-op; a customer can't insert a wishlist row for another profile.
- **Unit**: wishlist mapper (price from, stock states, unavailable, action choice); address schema; RPC error mapping; wishlist store (load per user, clear on sign-out, pending save).
- **Components**: `WishlistButton` (pressed state, optimistic revert, signed-out opens sign-in); wishlist grid (actions, empty state); address card (default badge, actions); address form (cascade reuse, inline errors); nav shows the Saved group.
- **Route**: `/api/account/wishlist` 401 signed out.

## Acceptance criteria

1. Signed out, the card heart opens the sign-in modal; after signing in the product is saved and the heart is filled, without a reload.
2. Signed in, tapping a heart fills it; tapping again clears it; the state is the same on the homepage, listings, product page, quick view and after a reload.
3. `/account/wishlist` shows saved products newest first with current price and stock; single-variant items add to the cart; multi-variant items link to the product page; Remove updates the list.
4. A product archived in admin shows "No longer available" with Remove.
5. `/account/addresses`: add an address → it becomes the default; add a second with "default" ticked → only it is default; delete it → the first becomes default again.
6. Checkout prefills the current default address.
7. Editing another customer's address id → 404.
8. Empty states on both pages; nav shows Saved → Wishlist, Addresses with `aria-current`; no horizontal scroll at 375px; everything keyboard-reachable with visible focus.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run db:push && npm run db:types
npm run build
npm run dev   # signed-out checks by script; signed-in pass needs a Clerk test user
```

## Manual test steps

1. `npm run dev`, signed out: tap a heart on the homepage → sign-in modal → sign in → heart filled.
2. Open the product page and quick view for that product → heart filled; unsave there, go back → heart empty.
3. `/account/wishlist`: add a single-variant item to the cart; open a multi-variant item via Choose options; remove one.
4. In admin, archive a saved product → wishlist shows it as no longer available.
5. `/account/addresses`: add, add a second as default, set the first as default again, edit, delete.
6. Go to `/checkout` → the default address is prefilled.
7. Resize to 375px and tab through both pages.

## Rollback

Revert the commit and drop the functions and triggers above. Saved addresses and wishlist rows created meanwhile stay valid under the old schema.

## Changes made during execution

- The address form schema and error mapping live in `src/features/account/address-schema.ts` (client-safe), separate from the server-only reads in `addresses.ts`. The edit page finds the address in the caller's own list, so there is no single-address query.
- Editing an address to a different municipality clears its saved coordinates; they are kept only while the municipality is unchanged.
- The cap errors use SQLSTATE `54000` (program limit exceeded), so they can't be confused with the hierarchy check's `23514`.
- `WishlistSoonButton` is removed. `ProductGallery` takes a `productSlug` prop. `parseOptionValues` is now exported from `features/catalog/mappers.ts` for the wishlist mapper.
- Tests of the storefront surfaces that show the heart mock it with `src/test/fakes/wishlist-button.tsx`; the real button has its own test with Clerk and the actions mocked.
- On the "only address" form there is no default checkbox (a disabled checkbox would submit no value); a note explains it's the default.

### Verification

- `npm run typecheck` and `npm run lint` pass.
- `npm test`: 78 files, 550 tests. `npm run test:db`: 14 files, 281 tests (15 new in `tests/db/account-addresses-wishlist.test.ts`).
- `npm run db:push` applied `20261002090000_account_addresses_wishlist.sql` to the hosted dev DB; `npm run db:types` regenerated `src/types/database.ts`.
- `npm run build` passes. `/` and `/products/[slug]` are still static/SSG; the new account routes and `/api/account/wishlist` are dynamic.
- On the dev server, signed out: `/account/wishlist`, `/account/addresses` and `/account/addresses/new` redirect to `/sign-in` with the right `redirect_url`; `/api/account/wishlist` returns 401 with `Cache-Control: private, no-store`; the homepage renders the real hearts ("Save … to wishlist", no "coming soon").
- **Not run:** the signed-in browser pass (acceptance 1–8). There is no Clerk test user or sign-in token in this environment.
