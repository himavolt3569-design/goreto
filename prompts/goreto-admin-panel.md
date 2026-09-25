# Goreto admin panel

## Goal

Build the admin area from `designs/goreto-admin.png`:

- The dashboard matches the reference composition.
- Every link in the panel opens a real page. That covers the sidebar, header search, notifications, Quick Actions, profile menu, "View All" links, Quick Settings cards and row menus.
- Every number, row and chart comes from the hosted Supabase dev database, read under the signed-in user's RLS or through permission-checked SQL functions.

Scope was agreed as **core operations**:

- Each section gets real list/detail pages.
- Each section gets the day-to-day actions staff need:
  - order status, courier assignment, tracking updates and COD payment;
  - stock adjustment;
  - product status;
  - review moderation;
  - active toggles;
  - featured/bestseller flags;
  - store settings;
  - staff permission toggles.

## Non-goals

- Creation or edit forms that need uploads or invitations are out of scope. That includes:
  - new/edit product with variants and media;
  - media upload;
  - AR asset upload;
  - new coupon, courier, zone, rate or collection;
  - Clerk staff invitations or role changes.

  These get follow-up tasks. **Their buttons are left out rather than shown dead.**
- No online payment gateways (AGENTS §4.4, §26.1). The reference's "Payment Gateways" card and "Payments" page are re-scoped to COD (see decisions 12 and 13).
- No Playwright or E2E setup (not installed in the repo). Manual browser checks are listed below.
- No storefront changes, except:
  - an "Open admin" link on `/account` for owner/staff;
  - the Clerk avatar host added to `next.config.ts`.
- No new chart dependency (see decision 9).

## What I inspected

- `AGENTS.md` §3 (tokens), §4.6 (dashboard contract), §4.8 (settings), §7 (routes), §9 (roles/permissions), §10.7, §11 (data model), §12, §16 (RLS), §18.7 (revalidation), §22 (a11y), §26.16 (vanity data), §26.17 (admin congestion).
- `designs/goreto-admin.png` and `designs/Goreto-designsystem.png`.
- Migrations: `foundation`, `catalog`, `delivery_promotions`, `orders`, `engagement`, `storefront_reads`, `storage`, `harden_grants` (explicit grants only), `verified_review_purchases`, `clerk_profile_sync`.
- `scripts/seed/build/orders.ts`: the order lifecycle and shipment-event conventions the admin actions must follow.
  - Delivered orders are `collected`.
  - Canceled orders are payment `failed`.
  - Events use sources `system`, `staff` and `courier_manual`.
- Auth: `src/proxy.ts` (`/admin(.*)` already requires a session), `src/lib/auth/profile.ts` (`requireProfile`, `requirePermission`, `requireOwner`, `authorize`), `permissions.ts`.
- Supabase clients: `server.ts` (Clerk-token client), `public.ts`, `admin.ts` (service role). `boundaries.test.ts` allows only `profile-sync.ts` to import `admin.ts`. The admin panel will **not** use the service role.
- UI: `globals.css` tokens, `components/ui/*` (Button, Card, Badge, OrderStatusPill, StatusIndicator, Select, SearchInput, Input, Field, NavItem, Logo, ProgressBar), `icons.ts` (curated Phosphor set), `money/format.ts` (`formatNpr`), `media/storage.ts` (`productMediaUrl`), `config/site.ts`.
- Tests: `tests/db/harness.ts` (PGlite with migrations and seed, `runAs` with Clerk claims), `tests/db/rls.test.ts` (seed users `user_seed_owner`, `user_seed_staff_catalog_manager`, `user_seed_staff_fulfilment`).
- Next.js 16.3.6 local docs:
  - `getting-started/07-mutating-data.md`;
  - `guides/forms.md`;
  - `guides/server-actions.md` (`refresh`, `revalidatePath`, `updateTag`);
  - `api-reference/03-file-conventions/page.md` (`searchParams` is a Promise);
  - `error.md` (error boundary prop is `retry`);
  - `04-functions/refresh.md`.
- Skills: `supabase` (security invoker by default, definer only with an explicit caller check and locked grants), `supabase-postgres-best-practices` (`security-rls-performance`, `security-privileges`, `data-pagination`), `clerk-nextjs-patterns`.
- Memory: the hosted dev DB has no Docker. Migrations go out with `npm run db:push`, and tests run on PGlite.

## Decisions

1. **Access.**
   - New `requireAdmin()` in `lib/auth/profile.ts`: signed out goes to sign-in; `customer` gets 404; `owner`/`staff` pass.
   - The admin layout calls it.
   - Each page also calls `requirePermission(<key>)` (owner-only pages call `requireOwner()`).
   - Each Server Action calls `authorize(<key>)`, validates input with Zod, and relies on RLS as the final check.
   - The sidebar, Quick Actions and Quick Settings show only items the user may open. That is UX only; the checks above are the enforcement.

2. **Data access.**
   - All admin reads and writes use the **user-context client** (`getUserSupabase()`), so RLS applies.
   - No service role. `boundaries.test.ts` stays unchanged.
   - Queries live in `src/features/admin/queries/*.ts` (`server-only`). Actions live in `src/features/admin/actions/*.ts` (`"use server"`).

3. **Migration `supabase/migrations/<ts>_admin_operations.sql`.** Every function has `set search_path = ''`, `revoke … from public, anon`, and `grant execute … to authenticated` (per `harden_grants`).
   - **Aggregates:** `security definer`, raise `42501` unless the caller has the permission, return aggregates only.
     - `admin_dashboard_kpis(p_from date, p_to date)` needs `analytics.read`. Returns jsonb with current and previous-period totals plus a daily series:
       - Sales: `sum(total_paisa)` of orders not canceled and not refunded.
       - Orders: count of orders placed.
       - Active products: products whose `published_at` is at or before the day and whose `archived_at` is null or later.
       - Customers: customer profiles, not deleted, with `created_at` at or before the day.
       - Days are Asia/Kathmandu dates.
       - Definer is needed because `analytics.read` alone can't see orders or profiles under RLS, and it must not expose order PII.
     - `admin_revenue_series(p_from date, p_to date, p_bucket text)` needs `analytics.read`. Bucket is `day` or `month`. Returns sales and orders per bucket, with zero-filled gaps.
     - `admin_analytics_breakdown(p_from date, p_to date)` needs `analytics.read`. Returns:
       - status counts;
       - payment-status totals;
       - top 10 products by revenue (from order-item snapshots);
       - sales by top-level category;
       - sales by province (address snapshot);
       - AOV;
       - repeat-customer share.
     - `admin_customer_summaries(p_search text, p_limit int, p_offset int)` needs `customers.read`. Returns profile fields plus order count, billed total (`collected` only, per §4.9), pending COD, last order date and total row count.
       - Search is `ilike` on name/email with escaped wildcards.
       - Limit is capped at 100.
   - **Operations:** `security invoker`, so RLS enforces `orders.write`, `inventory.write` and `catalog.write`. Each raises `P0002` when the row isn't visible or updatable and `22023` on an invalid transition. Each runs in one transaction.
     - `admin_transition_order(p_order_id uuid, p_status order_status, p_reason text)` uses the state machine below.
       - It sets the matching `*_at` timestamp.
       - It keeps the shipment row and append-only events in step, using `source = 'staff'` and the seed's message style.
       - On `delivered`: shipment `delivered`, payment `collected` with `payment_collected_at`. The seed's COD convention is that cash is taken at the door.
       - On `canceled`: payment `failed`, reason required, and the order's variants are **restocked** (`stock_quantity + quantity`, rows locked).
       - Cancel after shipping also sets shipment `returned` with an event.
     - `admin_assign_courier(p_order_id, p_courier_id, p_tracking_number)`:
       - sets the shipment courier, tracking number and `assigned`/`assigned_at`;
       - appends an event;
       - is not allowed once the order is delivered or canceled.
     - `admin_add_shipment_event(p_order_id, p_status, p_message, p_location)` accepts only `in_transit`, `out_for_delivery` or `exception`, only while the order is `shipped`. It updates the shipment status. No coordinates are ever written (§26.3).
     - `admin_mark_refunded(p_order_id, p_note)` changes a delivered `collected` order to `refunded` and sets `refunded_at`. It does not restock; staff inspect returns and adjust stock by hand.
     - `admin_adjust_stock(p_variant_id uuid, p_delta int)` is an atomic `stock_quantity + delta`. It refuses a result below 0 and `|delta| > 100000`, and returns the new quantity.
     - `admin_set_product_status(p_product_id, p_status)`. `active` sets `published_at = coalesce(published_at, now())` and clears `archived_at`. `archived` sets `archived_at = now()`.
     - `admin_attention_counts()` (invoker) returns pending-confirmation orders, pending reviews, and low-stock or sold-out active variants. Each count is what the caller's RLS lets them see, so it's 0 without permission.
   - **RLS gaps closed** (additive policies):
     - `product_ar_assets: ar.manage read` (today inactive assets are visible only with `catalog.read`);
     - `collections: content.manage read` (same gap for inactive collections).
   - **Indexes:**
     - `reviews (created_at) where status = 'pending'`;
     - `orders (payment_status, created_at desc)`;
     - `product_variants (stock_quantity)` for the low-stock filter, only if `EXPLAIN` on the dev DB shows a seq scan that matters. Otherwise skipped and noted.

4. **Order state machine** (SQL is the authority; `features/admin/order-transitions.ts` mirrors it only to decide which buttons to show):
   - `pending_confirmation` → `confirmed` | `canceled`
   - `confirmed` → `processing` | `canceled`
   - `processing` → `packed` | `canceled`
   - `packed` → `shipped` (requires an assigned courier) | `canceled`
   - `shipped` → `delivered` | `canceled` (return)
   - `delivered` and `canceled` are terminal.

5. **Routes** (`src/app/(admin)/admin/…`). Each has `loading.tsx` at the admin root and an `error.tsx` boundary with Retry.

   | Sidebar group | Label (reference) | Route | Permission | Actions |
   | --- | --- | --- | --- | --- |
   | Overview | Dashboard | `/admin` | admin; sections gated per permission | Date range; revenue window |
   | Overview | Analytics | `/admin/analytics` | `analytics.read` | Date range |
   | Catalog | Products | `/admin/products`, `/admin/products/[id]` | `catalog.read` | Status change (`catalog.write`) |
   | Catalog | Categories | `/admin/categories` | `catalog.read` | Active toggle (`catalog.write`) |
   | Catalog | Inventory | `/admin/inventory` | `catalog.read` | Stock ± (`inventory.write`) |
   | Catalog | Media | `/admin/media` | `catalog.read` | none (filter: missing alt text) |
   | Sales | Orders | `/admin/orders`, `/admin/orders/[orderNumber]` | `orders.read` | Transitions, courier, tracking event (`orders.write`) |
   | Sales | Payments | `/admin/payments` | `orders.read` | Mark refunded (`orders.write`) |
   | Sales | Coupons | `/admin/coupons` | `promotions.manage` | Active toggle |
   | Customers | Customers | `/admin/customers`, `/admin/customers/[id]` | `customers.read` (orders on the detail page need `orders.read`) | none |
   | Customers | Reviews | `/admin/reviews` | `reviews.manage` | Publish / reject with note |
   | Customers | AR Try-On | `/admin/ar` | `ar.manage` | Asset active toggle |
   | Content | Promotions | `/admin/promotions` (collections/campaigns) | `content.manage` | Active toggle |
   | Content | Content Management | `/admin/content` (homepage merchandising + newsletter) | `content.manage` | Featured/bestseller toggles (`catalog.write`) |
   | System | Roles & Permissions | `/admin/staff` | owner | Toggle staff permissions |
   | System | Delivery & Courier | `/admin/delivery`, `/admin/delivery/zones`, `/admin/delivery/rates` | `delivery.manage` | Active toggles |
   | System | Settings | `/admin/settings` | `settings.manage` | Edit store settings |
   | System | Support | `/admin/support` | admin | none |
   | (header) | Search | `/admin/search?q=` | admin; result groups per permission | none |

   - The sidebar keeps the reference's grouping and order.
   - "Delivery & Courier" sits under System, as in the reference. AGENTS §3.11 lists a separate Delivery group; I'm following the page reference because it's higher authority for composition.
   - AR Try-On sits under Customers, as drawn.

6. **Dashboard** (reference order):
   - **Header:** "Admin Dashboard" (Playfair display, per reference) plus the subtitle. The date-range control sits top right.
     - The control is a button showing the range, e.g. "Sep 1, 2026 – Sep 30, 2026".
     - It opens a popover with presets (This month, Last month, Last 7/30/90 days, This year) and custom from/to date inputs.
     - URL params are `from`/`to` (Asia/Kathmandu dates). The default is the current month.
   - **KPI cards:** Total Sales, Orders, Active Products, Customers. Each has:
     - an orange icon tile;
     - the value;
     - an up/down arrow with % change in success/error colour plus text. The label is "vs last month" when the range is a calendar month, otherwise "vs previous period".
     - a sparkline of the daily series.
     - When the previous value is 0, the card shows "New" instead of a %.
   - **Revenue Overview:**
     - The window select (Last 7 days / Last 30 days / Last 90 days / Last 12 months, param `revenue`) is separate from the KPI range, as in the reference.
     - Headline total and % vs the previous window.
     - Area line chart with dots, axis ticks, and a hover/focus tooltip showing date and amount.
   - **Recent Orders:** the 5 newest orders. Columns:
     - first-item thumbnail;
     - `#<order_number>` and relative time;
     - customer as "Priya S.";
     - amount;
     - `OrderStatusPill`.

     Rows link to the order page. "View All" goes to `/admin/orders`.
   - **Product Management:** the 5 most recently updated products. Columns:
     - thumbnail;
     - name;
     - category;
     - total stock (red at or below the low-stock threshold, green above);
     - price;
     - status pill (Active / Draft / Archived / Low Stock / Out of Stock);
     - an accessible "⋯" menu: View details, View on store (active only), and Set status Active/Draft/Archived.

     "View All" goes to `/admin/products`.
   - **Quick Settings:** four cards.
     - AR Configuration → `/admin/ar`.
     - **Checkout & COD** → `/admin/settings#checkout`. This replaces "Payment Gateways"; the copy says Cash on Delivery.
     - Delivery & Courier → `/admin/delivery`.
     - Roles & Permissions → `/admin/staff`.
   - **Footer:** "© 2026 Goreto.store. All rights reserved." and "Help" → `/admin/support`.
     - The reference's Privacy Policy and Terms of Service links are **left out**, because `/privacy` and `/terms` don't exist yet and they would be dead links.
   - A staff member without a section's permission doesn't see that section.
   - A staff member with no permissions sees an empty state: "Ask the store owner for access."

7. **Header:**
   - **Search:** a GET form to `/admin/search`. ⌘K / Ctrl K focuses it, and the shortcut hint is shown.
     - Results are grouped: products (title or SKU), orders (order number, contact name or email), customers (name or email).
     - Input is trimmed and capped at 64 characters. PostgREST filter metacharacters are stripped before `ilike`, and wildcards are escaped. No `.or()` is built from raw text.
   - **Notifications bell:** a popover built from `admin_attention_counts()`. It links to the filtered list pages. The orange dot shows only when the total is above 0, and the button's accessible name includes the count.
   - **Quick Actions:** menu of Review pending orders, Restock low inventory, Moderate reviews, View storefront (`/`). Filtered by permission.
   - **Profile menu:** Clerk avatar (from `currentUser().imageUrl`), name, and role label (Store owner / Staff). The menu has Your account (`/account`), View storefront, and Sign out (Clerk `SignOutButton`).

8. **Layout and responsive.**
   - Fixed 256px sidebar from `lg` up. Below `lg`, it becomes a native `<dialog>` drawer opened from a menu button. That gives focus trapping, Escape to close and focus return.
   - Tables sit in horizontally scrollable wrappers inside their cards on small screens. The page itself never scrolls horizontally.
   - Tokens only: primary-100 active nav background, 12px controls, 16px cards, shadow-sm, the 4px spacing scale.

9. **Charts are hand-built SVG.** No Recharts. I'll read the `dataviz` skill before building them.
   - Sparklines are server components.
   - The revenue chart is a small client component that adds the tooltip, with keyboard focus on points.
   - Both have a visually hidden data table for screen readers.
   - Why no library: two chart types, and I need exact control to match the reference. Adding Recharts costs a dependency and bundle size for little gain.
   - Path maths live in a pure, tested `features/admin/charts.ts`.

10. **Lists.**
    - URL state: `q`, filters, `page`.
    - 20 rows per page, `range()` with `count: 'exact'`.
    - Every list has empty, error (boundary) and loading states.
    - Filters use native `<select>`s and a GET form, so they work without JavaScript and are refresh-safe.

11. **Mutations.**
    - Small `<form action>` Server Actions return `{ ok } | { ok: false, message }`.
    - Client wrappers use `useActionState` to show inline errors, and use pending states on buttons.
    - After success: `refresh()`, plus `revalidatePath` for storefront pages whose cached data changed. Product status, featured flags, categories and collections affect `/`, `/categories`, `/categories/[slug]` and `/products/[slug]`.
    - Cancel, refund and courier dialogs use native `<dialog>` with a required reason or tracking field.

12. **Payments = COD ledger.**
    - Summary cards for the date range: collected, pending COD (not canceled, not collected), failed, refunded. They use invoker SQL under `orders.read`.
    - A table of orders with payment status, filterable.
    - The only action is Mark refunded. Collection is recorded by "Mark delivered", matching the seed.

13. **Settings form** (`settings.manage`), sections per §4.8 that the `store_settings` table supports:
    - Store profile: name, tagline, support email, support phone (+977, normalised to E.164).
    - Nepal defaults: shown read-only (NPR, Asia/Kathmandu, +977 are fixed by DB checks).
    - Checkout & COD (`#checkout`): COD enabled, COD max order (Rs.), returns window (days), default low-stock threshold.

    Zod validates on the server. Secrets are never shown.

14. **Staff page (owner only).** Owner and staff profiles with a permission matrix of the 14 keys.
    - The owner row shows "All permissions" and can't be edited.
    - Staff rows have checkbox toggles that insert or delete `staff_permissions` (RLS: owner) with `granted_by` set.
    - Invitations and role changes: a note says they arrive in a follow-up. No button is shown.

15. **Support page:** real store support contacts from `store_settings`, shown only when set, plus operational status:
    - COD enabled;
    - active couriers are manual integrations;
    - AR photo provider configured, based on whether `AR_PROVIDER` is set (a server-only boolean; the value is never shown);
    - a keyboard-shortcut reference;
    - links to each admin section the user may open.

16. **Money and time.** All sums are integer paisa, computed in SQL. They display through `formatNpr`. Dates display in Asia/Kathmandu with `Intl.DateTimeFormat`. Relative times ("12 min ago") are computed on the server per request.

17. **Icons.** Add Phosphor icons to `icons.ts` and use only that set:
    - House, ChartBar, Cube, Stack, Image, FileText, CreditCard, SealPercent, Users, Star, CoatHanger, Megaphone, Article, LockSimple, Truck, GearSix, Lifebuoy;
    - Bell, CalendarBlank, ArrowUp, ArrowDown, SignOut, Storefront, ShieldCheck, Receipt.

## Implementation notes (after execution)

Differences from the plan above, and why:

- **Two migrations, not one.**
  - `20260925071716_admin_operations.sql` holds the functions, policies and indexes.
  - `20260925073500_admin_inventory_view.sql` adds `admin_inventory`, a `security_invoker` view. The inventory "low stock" filter compares each variant with its own product's threshold, which PostgREST filters can't express. The view is additive, and RLS applies through the caller.
- **Function count.** The migration has 13 admin functions plus two small helpers, `npt_day_start` and `admin_assert_range`. The invoker `admin_payment_summary` needs both helpers, so `authenticated` may execute them. They expose no data.
- **`admin_transition_order` is `security definer`, not invoker.** Canceling restocks variants. Fulfilment staff with `orders.write` but no `inventory.write` would otherwise cancel without restocking, and nothing would report it. The function checks `orders.write` explicitly first. The other operations stay invoker.
- **Nullable arguments.** Generated RPC types mark every SQL argument as a required string. Actions cast the args for the nullable ones (`p_reason`, `p_tracking_number`, `p_location`, `p_search`), the same pattern as `profile-sync.ts`.
- **New dependency: `libphonenumber-js`** (`/min` metadata, server-side only). It validates the support phone per AGENTS §15.3 instead of a hand-written regex.
- **Forms with typed text submit by hand.** The settings form and dialogs (cancel reason, tracking update, courier) use `startTransition(formAction(formData))` instead of `<form action>`. React 19 resets `<form action>` forms after every submission, which would wipe input on a validation error. Single-button forms keep `<form action>`.
- **Storefront cache.** Catalog-affecting actions call `revalidateTag("catalog", { expire: 0 })` plus targeted `revalidatePath`, so a product staff just archived is never served stale. Stock adjustments don't revalidate: product pages refresh every 60s, and checkout reads the database.
- **Customer detail totals** are summed on the server in integer paisa over all of that customer's orders. The list page uses the SQL function.
- **KPI grid** is four columns from `xl` up. At `xl`, the value steps down to `text-h2`, so "Rs. 14,65,650" fits beside the icon.
- **Pure helpers** live in `features/admin/states.ts` so tests can import them without `server-only`: stock state, coupon state, collection state.
- **Quick Actions** is hidden below `md`. Every item it links to is also reachable from the drawer nav and notifications.
- **Product detail** also has featured/bestseller toggles, so a product removed from Content Management can be flagged again.
- **Verification limits.** The dev DB's owner is still the seed placeholder `user_seed_owner`, so I couldn't render signed-in pages. Instead:
  - I ran every admin SQL function on the hosted dev DB with seed-owner and fulfilment-staff claims, inside rolled-back transactions.
  - I ran a static audit of all internal links against the app routes: 28 targets, 0 dead.
  - Signed-out `/admin*` requests on `next start` return 307 to sign-in.
  - Visual comparison with the reference is left to the manual steps.

## Files expected to change

New:

- `supabase/migrations/<ts>_admin_operations.sql`
- `src/app/(admin)/admin/layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`
- `src/app/(admin)/admin/{analytics,search,products,products/[id],categories,inventory,media,orders,orders/[orderNumber],payments,coupons,customers,customers/[id],reviews,ar,promotions,content,staff,delivery,delivery/zones,delivery/rates,settings,support}/page.tsx`
- `src/components/admin/`:
  - `admin-shell.tsx`, `sidebar-nav.tsx`, `mobile-nav.tsx`;
  - `header-search.tsx`, `notifications-menu.tsx`, `quick-actions-menu.tsx`, `profile-menu.tsx`, `menu.tsx` (shared accessible menu);
  - `page-header.tsx`, `kpi-card.tsx`, `sparkline.tsx`, `revenue-chart.tsx`, `date-range-picker.tsx`;
  - `data-table.tsx`, `pagination.tsx`, `filter-bar.tsx`, `empty-state.tsx`, `status-pills.tsx`;
  - `toggle-form.tsx`, `row-actions-menu.tsx`;
  - `order-actions.tsx`, `stock-adjust-form.tsx`, `settings-form.tsx`, `permission-matrix.tsx`, `review-moderation.tsx`;
  - `__tests__/*`
- `src/features/admin/`:
  - `nav.ts`, `date-range.ts`, `metrics.ts`, `charts.ts`, `order-transitions.ts`, `search-input.ts`, `schemas.ts`, `format.ts` (dates, relative time, short names);
  - `queries/{dashboard,analytics,catalog,orders,customers,reviews,promotions,delivery,staff,settings,search}.ts`;
  - `actions/{orders,catalog,inventory,reviews,promotions,delivery,staff,settings}.ts`;
  - unit tests alongside.
- `tests/db/admin.test.ts`

Changed:

- `src/lib/auth/profile.ts` (`requireAdmin`)
- `src/components/ui/icons.ts` (new icons)
- `src/types/database.ts` (regenerated)
- `next.config.ts` (`img.clerk.com` remote pattern for avatars)
- `src/app/(account)/account/page.tsx` ("Open admin" link for owner/staff)

## Database / RLS impact

- Additive only:
  - 12 functions;
  - 2 select policies;
  - 2 or 3 indexes.

  No table or column changes, and no data rewrites.
- Operation functions are `security invoker`, so existing write policies stay the enforcement.
- Aggregate functions are `security definer` with an explicit `has_permission` check, `search_path = ''`, and no `anon` execute. They return aggregates or summary fields only.
- Rollback: drop the 12 functions, 2 policies and indexes. No data loss. Stock changes made through the panel are real data and are not rolled back.
- Applied to the **hosted dev** project with `npm run db:push --dry-run` first, then `npm run db:push`, then `npm run db:types`.

## Security requirements

- Every page and every Server Action re-checks permission on the server. RLS is the final guard.
- No service role, no secrets in client bundles, and no roles read from Clerk metadata.
- Zod validates every action input: uuids, enums, bounded integers, trimmed strings with max lengths.
- Search text is sanitised. Nothing user-typed is concatenated into SQL or PostgREST filter strings.
- Shipment events never get coordinates.
- A customer who opens `/admin` gets a 404, so the admin panel isn't revealed.

## Acceptance criteria

1. As owner, `/admin` matches the reference layout, and all four KPIs, the revenue chart, recent orders and product table match direct SQL over the dev DB for the chosen range.
2. Changing the date range or revenue window updates the URL and the numbers, and survives refresh.
3. Every link on every admin page returns a page, never a 404 for an allowed user. I'll check this with a crawl script over rendered admin HTML while signed in (see checks).
4. As the fulfilment seed staff (orders only), catalog, customers, settings and staff pages give 404, and their nav items are hidden. RLS tests prove their writes fail.
5. The order flow runs end to end on the dev DB: confirm → processing → packed → assign courier → shipped → tracking event → delivered (payment collected). Cancel restocks. Invalid transitions show an inline error.
6. A stock adjustment can't go below 0. Two concurrent −1s on stock 1 leave exactly one succeeding (tested in PGlite).
7. Review publish/reject records the moderator and time, and a published review appears in the storefront's rating aggregate.
8. The settings form rejects an invalid phone or email inline and saves valid values.
9. Keyboard only: skip to main, the sidebar, menus (Escape closes and focus returns), the drawer on mobile, the chart tooltip on focus, and all forms work.
10. At 375px there's no horizontal page scroll, and the drawer nav works.

## Checks to run

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`
- `npm run db:push -- --dry-run`, `npm run db:push`, `npm run db:types` (hosted dev)
- psql spot-checks comparing dashboard numbers with raw SQL (URL passed through env, never printed)
- Dev server smoke test: `/admin` signed out redirects to sign-in. A crawl for dead links needs a signed-in session. I'll try the Clerk testing-token flow with your owner account only if you approve it; otherwise you run the manual steps below.

## Tests

- **Unit (Vitest):**
  - `date-range` (presets across month/year boundaries in NPT, invalid params fall back);
  - `metrics` (% change, zero previous → "New");
  - `charts` (path/scale, empty series);
  - `order-transitions` (allowed actions per status);
  - `search-input` (sanitising, length);
  - `nav` (permission filtering, active matching);
  - `schemas` (settings: E.164 normalisation, bounds);
  - `format` (short names, relative times).
- **Component (RTL):**
  - sidebar active state and hidden items;
  - accessible menu (open/close, Escape, arrow keys);
  - date-range picker builds the right URL;
  - KPI card delta text (not colour-only);
  - toggle form pending/error;
  - order actions show only allowed transitions.
- **DB (PGlite) `tests/db/admin.test.ts`:**
  - KPI/analytics/customer functions: denied to anon, customer and staff without the key; owner values equal the raw SQL.
  - Transition function: full happy path, invalid transition rejected, catalog staff denied, cancel restocks, events appended and never updated.
  - Courier assignment rules.
  - Refund only from collected.
  - Stock can't go negative; concurrent decrement.
  - Product status sets `published_at`.
  - Attention counts are 0 for a customer.
  - New read policies: `ar.manage` / `content.manage` staff see inactive rows. Existing RLS tests still pass.

## Manual test steps

1. `npm run dev`. Sign in as the owner account. Open `/admin`.
2. Compare with `designs/goreto-admin.png`: sidebar groups, header, KPI row, revenue chart, recent orders, product management, quick settings, footer.
3. Change the date range to Last month, then Last 90 days. Numbers and sparklines change and the URL updates. Refresh keeps it.
4. Hover and tab through the revenue chart points; the tooltip shows date and amount.
5. Click every sidebar item, the bell, every Quick Actions item, every profile menu item, both "View All" links, and all four Quick Settings cards. Each opens a real page.
6. Search "earring", a recent order number, and a customer name from the list.
7. Open a `pending_confirmation` order. Confirm, then processing, packed, assign courier with a tracking number, shipped, add "Out for delivery", delivered. Check the timeline and that payment shows Collected.
8. On another pending order, cancel with a reason. The item's variant stock goes up by its quantity in Inventory.
9. Inventory: filter Low stock, adjust a variant +5 and −5, and try going below 0 (inline error).
10. Reviews: publish one pending review and reject another with a note.
11. Settings: change the tagline and save; enter a bad phone and see the inline error.
12. Roles & Permissions: toggle a permission on a seed staff member and toggle it back.
13. Resize to 375px and use the drawer nav.
14. Sign in as a customer account and open `/admin`: 404.
