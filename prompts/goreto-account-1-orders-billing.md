# Account phase 1: shell, overview, orders, tracking, billing

First of three customer-account phases (AGENTS §4.9, worklog §4.3): **1. Shell + overview + orders + tracking + billing** → 2. Wishlist (incl. the storefront heart) + addresses → 3. Reviews + Profile & security (Clerk `<UserProfile />`). Each phase gets its own prompt and approval.

## Goal

Replace the `/account` stub with a real account area for any signed-in Clerk user:

- **Shell**: grouped account navigation, shared by every account page, with loading and error states.
- **Overview** `/account`: greeting, profile summary, three stat cards (total orders, orders in progress, total billed to date), plus the latest 3 orders.
- **Orders** `/account/orders`: the customer's own orders, newest first, 10 per page (`?page=`), with order number, date, item count, status and total.
- **Order detail** `/account/orders/[orderNumber]`: the same snapshot + stepper + shipment-event timeline as §4.5, for the customer's own orders only.
- **Tracking history** `/account/tracking`: shipment events across the customer's orders, newest first (latest 50).
- **Billing** `/account/billing`: total billed to date, pending COD shown separately, and a per-order breakdown.

## Non-goals

- Wishlist, addresses (phase 2), reviews and profile/security (phase 3). The nav shows only built sections, so there are no dead links. The header wishlist heart keeps pointing at `/account/wishlist`, which still 404s until phase 2 (pre-existing).
- Guest-order claiming (§9.1). Orders placed as a guest don't appear in the account.
- Order filters/search, reorder, invoice PDFs, cancel-by-customer.
- No change to `/order-confirmation` or `/track` behaviour.

## What I inspected

- `AGENTS.md` §4.5, §4.9, §7, §8, §9, §10.8, §15, §16, §22, §23.3; `worklog.md` §4.1, §4.3; `prompts/goreto-cart-checkout-confirmation.md` (tracking), `goreto-discovery-3-collections.md` (format).
- Migrations: `orders` (RLS: "orders: read own" **and** "orders: staff read" — so a plain `select` by an owner/staff returns every order; account reads must filter on the caller's own profile), `engagement`, `harden_grants`, `admin_operations` (billed/pending rules in `admin_customers`), `admin_aggregate_counts` (security-invoker aggregate pattern), `checkout_place_order` (`get_order_tracking`: owner by session or secret).
- `src/app/(account)/{layout,account/page}.tsx`, `src/proxy.ts` (`/account(.*)` already protected), `src/lib/auth/profile.ts` (`requireProfile`).
- `src/features/orders/{tracking,tracking-model,stepper,format}.ts`, `src/components/store/orders/{order-access-page,order-tracking-view,order-stepper,panel}.tsx`.
- `src/features/admin/nav.ts`, `src/components/admin/{sidebar-nav,admin-ui,kpi-card}.tsx`, `src/app/(admin)/admin/{layout,error}.tsx`, `src/app/(admin)/admin/customers/[id]/page.tsx` (billing figures).
- `src/components/ui/{status,nav-item,card,section-heading}.tsx`, `src/components/store/search/pagination.tsx`, `src/features/admin/queries/shared.ts` (page helpers).
- `tests/db/harness.ts` and existing DB test files.
- Next docs: `03-file-conventions/{layout,loading,error,not-found}.md` (`error.tsx` uses the stable `retry` prop in 16.3).

## Decisions

1. **SQL aggregates, scoped to the caller** — new migration `supabase/migrations/20261001090000_account_reads.sql`, both functions `security invoker`, `stable`, `set search_path = ''`, and every query filters `o.user_id = public.current_profile_id()` explicitly (RLS alone would give staff everyone's orders):
   - `account_summary()` → one row: `order_count`, `in_progress_count` (status not `delivered`/`canceled`), `billed_paisa` + `billed_order_count` (`payment_status = 'collected'`), `pending_paisa` + `pending_order_count` (`payment_status = 'pending'` and status ≠ `canceled`). Refunded, failed and canceled orders are never in either total. No profile → zeros.
   - `account_tracking_events(p_limit integer default 50)` → `order_number, status, message, location_label, occurred_at`, newest first, limit clamped to 1–100.
   - Grants: `revoke execute … from public, anon; grant execute … to authenticated`.
2. **Order list** via the Clerk-token client: `orders` with `.eq("user_id", profile.id)`, `count: "exact"`, `.range()`, embedding `order_items(quantity)` for the item count (a quantity sum for display, not money). 10 per page; `?page=` parsed with the existing `pageNumber` helper (moved from `features/admin/queries/shared.ts` to `src/lib/pagination.ts`, admin re-imports it). A page past the end shows the empty-page state with a link to page 1.
3. **Order detail** reuses `get_order_tracking` **without** the tracking secret, so only the signed-in owner of the order sees it (a guest order this browser has a cookie for doesn't leak into the account). Not found / not yours → `notFound()`. Rendered with the existing `OrderTrackingView`, given a new `variant="account"`: heading "Order #…", no "save your tracking link" block, "Back to orders" instead of "Continue Shopping". Confirmation and tracking pages are unchanged.
4. **Feature module** `src/features/account/`: `queries.ts` (server-only reads above, throwing on error), `nav.ts` (groups + `isAccountNavActive`), `billing.ts` (view-model mapping; paisa stay integers, no browser sums).
5. **Navigation** (grouped, extensible — phase 2/3 add items without restructuring):
   - *Overview*: Overview
   - *Orders*: Orders, Tracking, Billing
   - Later: *Saved* (Wishlist, Addresses), *Profile* (Reviews, Profile & security).
   - Desktop (`lg+`): left column like the admin sidebar (group labels, icon + label, `aria-current`, primary-100 active). Mobile: a horizontally scrollable row of `NavItem` pills above the content, no page overflow. Client component only for `usePathname`.
6. **Layout**: `src/app/(account)/account/layout.tsx` renders the shell (each page keeps its own breadcrumbs and heading): container `max-w-7xl px-4 md:px-8`, grid `lg:grid-cols-[16rem_minmax(0,1fr)]`, gap 32. The layout itself does not authorize (layouts don't re-run on client navigation); **every page calls `requireProfile()`**.
7. **States**: `account/loading.tsx` (skeleton cards on neutral-100, `motion-safe:animate-pulse`), `account/error.tsx` (same pattern as admin: message, digest, "Try again" via `retry`), and per-page empty states: no orders → "You haven't placed an order yet" + "Start shopping"; no events → "Tracking updates appear here once you place an order"; billing with no collected orders → "Nothing billed yet" (still shows pending COD if any).
8. **Stat cards**: promote the admin `StatCard` to `src/components/ui/stat-card.tsx`; `admin-ui.tsx` re-exports it, so admin pages don't change. Overview uses it with icons already in `icons.ts` (`FileTextIcon`, `ClockCounterClockwiseIcon`, `MoneyIcon`). Status uses the existing `OrderStatusPill`; payment status gets a small text+tone pill (colour never the only signal).
9. **Staff/owner**: the account shows only their own customer orders; the Overview keeps the role badge and "Open admin" link.
10. **Tokens only**: existing type scale, 4px spacing, `lg` card radius, `shadow-sm`. Dates via `formatOrderDateTime` (Asia/Kathmandu), money via `formatNpr`.

## Files expected to change

```text
supabase/migrations/20261001090000_account_reads.sql      new: account_summary, account_tracking_events + grants
src/types/database.ts                                      regenerated (npm run db:types), not hand-edited
src/features/account/{queries,nav,billing}.ts (+ tests)    new
src/lib/pagination.ts (+ test)                             pageNumber/pageRange/toPage moved here
src/features/admin/queries/shared.ts                       re-imports pagination helpers
src/components/ui/stat-card.tsx                            moved from admin-ui
src/components/admin/admin-ui.tsx                          re-export StatCard
src/components/store/account/account-nav.tsx (+ test)      new
src/components/store/account/{order-list,tracking-feed,billing-table,account-pagination,payment-status-pill}.tsx (+ tests)
src/components/store/orders/order-tracking-view.tsx        + variant "account"
src/app/(account)/account/layout.tsx                       new shell
src/app/(account)/account/{loading,error}.tsx              new
src/app/(account)/account/page.tsx                         overview (replaces stub)
src/app/(account)/account/orders/page.tsx                  new
src/app/(account)/account/orders/[orderNumber]/page.tsx    new
src/app/(account)/account/tracking/page.tsx                new
src/app/(account)/account/billing/page.tsx                 new
tests/db/account.test.ts                                   new
worklog.md                                                 mark items done
```

## Database / migration impact

Two new read-only functions. No table, column, policy or data change. Verify with `npm run test:db`, then `npm run db:push` to the hosted dev DB and `npm run db:types`. Rollback: `drop function public.account_summary(); drop function public.account_tracking_events(integer);`.

## Auth / RLS

- `/account(.*)` is already session-protected in `src/proxy.ts`; every page also calls `requireProfile()`.
- All reads use `getUserSupabase()` (Clerk token). No service role.
- Ownership is enforced twice: explicit `user_id = current_profile_id()` in SQL / `.eq("user_id", profile.id)` in TS, and RLS underneath. `get_order_tracking` without a secret returns only the caller's own order.
- `anon` cannot execute the new functions.

## Validation and security

- `orderNumber` passes `isOrderNumber` before the RPC; `page` is an integer 1–10,000.
- Money is summed only in SQL; the browser receives formatted integers.
- Pages are dynamic (`auth()`), with `robots: noindex` inherited from an account metadata template.

## Tests

- **DB** (`tests/db/account.test.ts`, PGlite, rolled back):
  - a customer's `account_summary` counts only their own orders; billed includes collected only; pending excludes canceled; refunded is in neither;
  - staff with `orders.read` gets only their own figures (not the store's);
  - a profile with no orders gets zeros; `anon` cannot execute either function;
  - `account_tracking_events` returns only own events, newest first, and clamps the limit;
  - `get_order_tracking` without a secret returns null for another customer's order.
- **Unit**: nav active matching; billing view model; pagination helpers (moved tests).
- **Components**: account nav (`aria-current`, groups); order list (row content, empty state); tracking feed (labels, empty); billing table (billed vs pending separated); `OrderTrackingView` `account` variant hides the tracking-link block.

## Acceptance criteria

1. Signed out, `/account/orders` redirects to sign-in; after signing in it lands back there.
2. `/account` shows the greeting, profile card and three stat cards whose numbers match the DB (`account_summary`), and the latest 3 orders.
3. The nav highlights the current section on desktop and mobile; there's no horizontal page scroll at 375px.
4. `/account/orders` lists only my orders, newest first, paginated at 10; a new order placed at checkout while signed in appears at the top.
5. Opening an order shows the stepper, timeline, address and item snapshots and totals; another customer's order number (or a guest order) 404s.
6. `/account/tracking` shows my shipment events newest first, each linking to its order.
7. `/account/billing` shows billed-to-date (collected only) and pending COD separately, plus a per-order table; canceled/refunded orders appear with their status but aren't counted.
8. A new account with no orders sees clear empty states on every page.
9. An owner's account pages show only the owner's personal orders, not the store's.
10. Keyboard: nav, pagination and order links are reachable with visible focus.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run db:push && npm run db:types
npm run build
npm run dev   # scratchpad playwright-core script, signed in via a Clerk testing token where possible; otherwise manual
```

## Manual test steps

1. `npm run dev`, sign in, open `/account`. Check the three stat cards and recent orders.
2. Place a COD order at `/checkout` while signed in, then return to `/account/orders`: it's first, status Pending.
3. Open it: stepper at "Order Placed", timeline shows "Order placed. Cash on delivery."
4. In `/admin/orders`, accept and move it through to Delivered. Reload `/account/tracking` (new events) and `/account/billing` (moves from pending to billed).
5. Cancel a second order in admin: it shows as Canceled in billing and isn't counted.
6. Open `/account/orders/<someone else's order number>` from `/admin/orders`: 404.
7. Resize to 375px and tab through the nav.

## Rollback

Revert the commit and drop the two functions (above). No data is changed.

## Changes made during execution

- The pagination helpers live in `src/lib/pagination/page.ts` (the repo's `lib/<domain>/` layout) rather than `src/lib/pagination.ts`; `features/admin/queries/shared.ts` re-exports them, so admin imports are unchanged.
- Shipment event labels moved from `order-tracking-view.tsx` to `src/features/orders/shipment-labels.ts`, shared with the account tracking feed.
- Account building blocks are in one file, `src/components/store/account/account-ui.tsx` (page header, empty state, payment pill, pagination), plus `order-list`, `tracking-feed` and `billing-list`.
- In the account variant, the order detail switches to two columns at `xl` (not `lg`), because the account sidebar takes 16rem.

### Verification

- `npm run typecheck` and `npm run lint` pass.
- `npm test`: 72 files, 516 tests. `npm run test:db`: 13 files, 266 tests (11 new in `tests/db/account.test.ts`).
- `npm run db:push` applied `20261001090000_account_reads.sql` to the hosted dev DB; `npm run db:types` regenerated `src/types/database.ts`.
- `npm run build` passes; the five account routes are dynamic.
- On the dev server, all five account URLs redirect a signed-out request to `/sign-in` with the right `redirect_url`.
- **Not run:** the signed-in browser pass (acceptance 2–10). There is no Clerk test user or sign-in token in this environment, so the manual steps above still need a signed-in run.
