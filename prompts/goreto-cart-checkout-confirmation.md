# Cart, checkout, order confirmation and tracking

_Status: approved 2026-09-27, implemented · Branch: new `feat/cart-checkout` from `feat/admin-media-ar`_

## Goal

A shopper can go from cart → checkout → placed COD order → confirmation page → tracking page, with every price, fee, discount and stock check done in the database.

User decisions (2026-09-27):
- Build **Cart + Checkout** first (ahead of WhatsApp orders).
- Build the **full confirmation + tracking** page now (AGENTS §4.5), not a simple thank-you page.
- **Real map** with OpenStreetMap tiles for "Use Current Location" (and for the delivery-address pin on tracking).
- **Cash on Delivery only** for now, and **follow `designs/goreto-checkout.png` and `designs/goreto-order confirm.png` closely, with the design system** (review feedback on this prompt). The only departures are the ones business rules force, listed under "UI references and constraints".

## Non-goals

- No online payment. The reference shows eSewa/Khalti/cards; only **Cash on Delivery** is built (AGENTS §4.4, §26.1).
- No fake courier location, route line or moving truck on the tracking map (§4.5, §26.3). The map shows only the shopper's own delivery pin, and only when they shared coordinates.
- No "View Invoice" or "Change Address" buttons from the tracking reference: there's no invoice or post-order address edit yet.
- No saving the checkout address to the account (that's the Account → Addresses feature). Signed-in shoppers do get their existing default address prefilled.
- No guest-order claiming after sign-up (§9.1). Separate task.
- No full 753-municipality dataset. Checkout uses the 76 already in the DB (worklog §4.7), so some real addresses can't be picked yet.
- No emails/SMS. Nothing is sent after ordering.
- No WhatsApp order flow. But `place_order`'s pricing core is written so the WhatsApp manual-entry task can reuse it.

## What I read

- AGENTS.md §4.4, §4.5, §8, §9.1, §10.2, §11.6–11.9, §12, §15, §16, §18, §26; CLAUDE.md; worklog.md.
- Next docs: `02-guides/forms.md`, `02-guides/server-actions.md` (actions are public POST endpoints: validate, authorize, shape the return).
- References: `designs/goreto-checkout.png`, `designs/goreto-order confirm.png`, `designs/Goreto-designsystem.png`.
- Schema: `orders`, `order_items`, `shipments`, `shipment_events` (`…_orders.sql`), couriers/services/zones/rates/coupons (`…_delivery_promotions.sql`, `…_admin_coupons_delivery.sql`), `nepal_*`, `store_settings` (`…_foundation.sql`), `customer_addresses` (`…_engagement.sql`), `product_variants`, `admin_transition_order` / `admin_assign_courier` (`…_admin_operations.sql`), `harden_grants`.
- Seed snapshot shapes: `scripts/seed/types.ts` (`AddressSnapshot`, `DeliverySnapshot`, order number `GT` + NPT date + digits).
- Code: `src/features/cart/store.ts`, `product-purchase.tsx` (Buy Now → `/checkout`), `header-cart.tsx` (→ `/cart`), `catalog/variants.ts` (`MAX_QUANTITY_PER_LINE = 10`), `admin/schemas.ts` (`nepalPhoneSchema`), `admin/queries/orders.ts` (snapshot readers), `lib/supabase/{public,server}.ts`, `components/ui/*`, `next.config.ts`.

## Decisions

**Pricing lives in SQL, once.** A private helper `checkout_price(items, municipality, service, coupon, email)` does all the maths. Two public functions call it:
- `checkout_quote(...)`: read-only. The cart and checkout summary use it to show fresh prices, stock, delivery options and totals.
- `place_order(...)`: the same maths inside a transaction, plus locks, writes and stock decrement (§12 steps 1–11).

The browser sends only variant ids, quantities, address codes, the chosen service id, a coupon code and contact details. Never prices.

**Stock.** `place_order` locks the variant rows `for update` in id order (no deadlocks), checks product `active` + variant active + stock + the 10-per-line cap, then decrements. If anything changed it fails with a structured error listing the affected lines, and the checkout refreshes those cart lines.

**Delivery.** Options = active rates in the zone whose `district_codes` contains the address district, for active services of active couriers, honoring `min_order_paisa` and weight bounds. Variants without a weight don't block a rate. No match → "We don't deliver to this area yet".

**Coupons.** Active, in date window, under `usage_limit` and `usage_limit_per_customer` (by profile for signed-in, by lower-cased contact email for guests), `min_order_paisa` on the subtotal, percent rounded down, capped by `max_discount_paisa` and by the subtotal. `times_used` increments under a row lock.

**COD rules.** `store_settings.cod_enabled = false` closes checkout with a clear message. `cod_max_order_paisa` rejects larger orders.

**Order row.** Number = settings prefix + NPT `YYMMDD` + 6 random digits, retried on collision (matches the existing check constraint). Status `pending_confirmation`, payment `cod`/`pending`. Address and delivery snapshots use the exact `AddressSnapshot` / `DeliverySnapshot` shapes the admin already reads. One shipment (`awaiting_assignment`, estimated dates in NPT) and one `shipment_events` row "Order placed" (`source = system`).

**Who can call it.** `place_order` and `checkout_quote` are `security definer`, executable by `anon` and `authenticated`. Signed-in orders get `user_id = current_profile_id()` from the token, never from input.

**Guest access to the order.** The server action creates a 192-bit random tracking secret; SQL stores only its sha256 (`guest_tracking_hash` already exists).
- After placing, the action sets an httpOnly, `SameSite=Lax`, secure cookie scoped to that order's paths, then redirects to `/order-confirmation/[orderNumber]`.
- The confirmation page shows a copyable tracking link `/track/[orderNumber]?code=…`. Opening it sets the same cookie in a route handler and redirects to the clean URL, so the code doesn't stay in the address bar. Tracking pages send `Referrer-Policy: no-referrer`.
- `/track/[orderNumber]` without access shows a small "Enter your tracking code" form.
- A new `get_order_tracking(order_number, secret)` function returns only the safe payload. Signed-in owners of the order read it through RLS instead; no secret needed.

**Location + map.**
- "Use Current Location" asks the browser only on click. Denied or unavailable is a normal message; the manual fields always work.
- `/api/geocode/reverse` (server route, validated lat/lng inside Nepal) returns the **nearest municipality from our own dataset** (district + province come with it). The shopper confirms or corrects every field; ward and street are never guessed.
- Map: **Leaflet** (new dependency, ~40 KB gzip), lazy-loaded only when the map is shown, never on other pages. Tiles from OpenStreetMap by default via `NEXT_PUBLIC_MAP_TILE_URL`, with the required attribution. The pin is draggable and updates the coordinates.
- No Nominatim or other paid/rate-limited geocoder in this task.

**Cart.** Stays in Zustand/localStorage. The store gains `setQuantity` and `refreshLines` (applies server quote: new price, lower max, or removal of unavailable items, with a notice). Prices shown are labelled as a preview until checkout.

**Forms.** Checkout uses React Hook Form + Zod on the client for inline errors, and the same Zod schema again in the server action. Phone uses the existing `nepalPhoneSchema` (libphonenumber) with a fixed `+977` prefix so the code isn't typed twice (§15.3).

**Tracking content (§4.5).**
- Header: order number, placed date (Asia/Kathmandu), status banner (placed / confirmed / canceled…).
- Info tiles: order ID, date, payment "Cash on Delivery", estimated delivery range.
- Stepper: Placed → Confirmed → Packed → Shipped → Out for delivery → Delivered, with real timestamps; future steps show "Expected …" only from the shipment's estimated dates. Canceled shows a canceled state with the reason.
- Event timeline from `shipment_events`, newest first.
- Courier card only after assignment: courier name, service, tracking number (copy), "Call courier" only if the courier has a support phone.
- Delivery address, ordered items (from snapshots), totals, delivery details.
- Help card only shows contact actions for the support email/phone actually set in store settings.
- Map card only when the address snapshot has coordinates, labelled "Delivery location", no courier position.

## Files expected to change

New:
- `supabase/migrations/20260928090000_checkout_place_order.sql`: `checkout_price` (private), `checkout_quote`, `place_order`, `get_order_tracking`, `nearest_municipality`; explicit revoke/grant per `harden_grants`.
- `src/features/checkout/`: `schemas.ts` (+ test), `quote.ts` (server reads), `actions.ts` (`quoteCartAction`, `placeOrderAction`), `errors.ts` (map SQL errors → messages/line fixes, + test), `tracking-access.ts` (secret, hashing, cookie helpers, + test).
- `src/features/orders/`: `tracking.ts` (load order for owner or guest → view model), `stepper.ts` (status/events → steps, + test).
- `src/features/delivery/nepal-address.ts`: province/district/municipality/ward option loading and cascade helpers (+ test).
- `src/app/(store)/cart/page.tsx`
- `src/app/(store)/checkout/page.tsx`
- `src/app/(store)/order-confirmation/[orderNumber]/page.tsx`
- `src/app/(store)/track/[orderNumber]/page.tsx`, `src/app/(store)/track/[orderNumber]/access/route.ts`
- `src/app/api/geocode/reverse/route.ts`
- `src/components/store/cart/*`: cart lines, summary, empty state.
- `src/components/store/checkout/*`: checkout form (5 numbered sections), contact, address (cascade + location button), map (Leaflet, dynamic import), delivery options, payment (COD only), notes, order summary (sticky, with coupon), place-order button.
- `src/components/store/orders/*`: status banner, info tiles, stepper, event timeline, courier card, address card, items, totals, help card, map card.
- Tests next to each component with behaviour worth testing (cascade, delivery selection, coupon apply, cart quantity/refresh, stepper).
- `tests/db/checkout.test.ts`

Changed:
- `src/features/cart/store.ts` (+ test): `setQuantity`, `refreshLines`.
- `src/components/ui/icons.ts`: any new icons.
- `src/types/database.ts`: regenerated with `npm run db:types`, never hand-edited.
- `package.json` / `package-lock.json`: `leaflet`, `@types/leaflet`.
- `.env.example`: `NEXT_PUBLIC_MAP_TILE_URL`, plus missing `NEXT_PUBLIC_SITE_URL`.
- `worklog.md`: tick off §4.1 items.

## Database / RLS impact

- One new migration. **No table changes**; functions only. No existing data touched.
- New functions: `checkout_price` (no grants, internal), `checkout_quote` and `place_order` and `get_order_tracking` and `nearest_municipality` (execute to `anon, authenticated`, revoked from `public`). All `security definer`, `set search_path = ''`.
- `anon` still has **no** direct select/insert on `orders` and related tables; guests reach their order only through `get_order_tracking` with the secret.
- Rollback: drop the five functions. Orders already placed stay valid rows the admin can manage as usual.
- Apply to hosted dev with `npm run db:push` after `npm run test:db` passes; then `npm run db:types`.

## Security checklist

- Browser prices, totals, fees, discounts and user ids are never trusted (§26.4).
- Server action re-validates with Zod, reads identity from Clerk, returns only `{ orderNumber }` or a shaped error.
- Tracking secret: random, only the hash stored, httpOnly cookie, no-referrer, code stripped from URL.
- Geolocation only after a click; reverse route validates input and uses no third-party service.
- Known limit (not solved here): anonymous shoppers can place orders without rate limiting, so someone could tie up stock with fake COD orders. Staff can cancel them (restocks). Worth a later task: rate limit or phone verification.

## UI references and constraints

- Checkout: `designs/goreto-checkout.png`. Two columns on desktop, sticky summary on the right, numbered sections 1–5, stacked on mobile. The payment section shows only the COD card. "Secure payment" trust tile is reworded truthfully (as on the product page).
- Confirmation/tracking: `designs/goreto-order confirm.png`, same layout, cards, stepper, order summary, delivery details, help card and "You're in good hands" panel.
- Forced departures from the two designs (everything else is matched):
  1. Payment section: only the Cash on Delivery card; the eSewa/Khalti and card options are not drawn.
  2. Tracking map: shows the delivery address pin only, never a courier route, truck or "Live location" banner, because no courier sends real positions.
  3. "View Invoice" and "Change Address" buttons are left out until those features exist.
  4. Trust tiles say what's true: e.g. "Cash on delivery" instead of "100% safe & secure transactions".
- Cart: no reference. Built from the checkout summary's line style and design-system cards.
- Tokens only (colors, 4px spacing, radii, shadows), Phosphor icons via `icons.ts`, 44px controls, visible focus, statuses with text not color alone, reduced motion respected.

## Acceptance criteria

1. `/cart` lists lines, changes quantity (max = stock and 10), removes lines, shows refreshed prices and flags changed/unavailable items; empty state links to shopping.
2. Header cart badge and "View cart" no longer 404.
3. `/checkout` with an empty cart shows an empty state, not a form.
4. Province → District → Municipality → Ward cascade works with keyboard, and resets children when a parent changes.
5. "Use Current Location" asks permission on click, shows the map with a draggable pin, prefills province/district/municipality for review; denial shows a message and manual entry still works.
6. Delivery options update from the address and show real fees and day ranges; none available → clear message and Place Order disabled.
7. Coupon: valid code shows the discount; invalid/expired/limit reached show a specific message.
8. Place Order creates the order with DB-calculated totals, decrements stock, clears the cart and lands on the confirmation page.
9. A stock change between cart and submit shows which lines changed and fixes them; nothing is ordered.
10. Guests see their order on the confirmation page and via the tracking link on another browser; a wrong/missing code shows the code form and no order data.
11. A signed-in shopper sees the order without a code; another signed-in user can't.
12. The new order appears in `/admin/orders` as pending; admin confirm/assign/ship/deliver updates the tracking page stepper and timeline.
13. No eSewa/Khalti/card options, no fake courier location anywhere.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
npm run test:db     # includes new tests/db/checkout.test.ts
npm run build
npm run db:push     # hosted dev, after test:db passes
npm run db:types
```

`tests/db/checkout.test.ts` covers: quote matches place_order totals; browser-sent prices are impossible (not in the signature); stock decrement and oversell refusal; inactive product/variant refusal; 10-per-line cap; delivery zone match/no match; min order and weight rules; coupon valid/expired/usage limit/per-customer/min order/cap; COD disabled and COD max; guest order via `anon` gets `user_id` null; signed-in order gets the caller's profile; `anon` cannot select `orders`; `get_order_tracking` with right/wrong secret; customer isolation; grants on new functions.

Manual browser check (dev server): the full journey as a guest and as a signed-in customer, location allow and deny, mobile width, keyboard-only pass through checkout, then advance the order in admin and watch tracking update. Compare against both reference images.

## Manual test steps (for the report)

1. Add two products to the cart, open the cart badge, change a quantity, remove one.
2. Go to checkout, fill contact info, click "Use Current Location", allow, check the map and prefilled fields, correct the ward and street.
3. Pick a delivery option, apply a coupon from `/admin/coupons`, place the order.
4. Check the confirmation page, copy the tracking link, open it in a private window.
5. In `/admin/orders`, confirm, assign a courier and ship the order; reload the tracking page.
6. Repeat signed in; confirm another account can't open that order.
