# Goreto.store — Work Log

_Last updated: 2026-10-06 · Live since 2026-10-04: https://goreto-kappa.vercel.app (branch `production`)_

Sources: git history (24 commits), `AGENTS.md`, all 13 files in `prompts/`, the migrations, the code in `src/`, `scripts/` and `tests/`, and a fresh run of the checks below.

---

## 1. Current state

| Check | Result (run 2026-09-27) |
| --- | --- |
| `npm run typecheck` | ✅ passes |
| `npm run lint` | ✅ passes |
| `npm test` (Vitest + RTL) | ✅ 62 files, 455 tests |
| `npm run test:db` (PGlite + real migrations + seed + RLS) | ✅ 10 files, 228 tests |
| `npm run build` | ✅ passes |

**Stack in use:** Next.js 16.3.6 (App Router, `src/proxy.ts`), React 19.2.8, TypeScript strict, Tailwind v4 tokens, Clerk (`@clerk/nextjs` 7.9.5, Core 3), Supabase (hosted **dev** project; `@supabase/supabase-js` 2.117.1), Zustand (cart), React Hook Form + Zod, Phosphor icons, GSAP (homepage motion only), libphonenumber-js, Vitest and PGlite. npm is the package manager.

**Dev environment:** WSL and Docker are unavailable on this machine, so `supabase start` doesn't run. Migrations go to the hosted dev DB with `npm run db:push`. DB tests run on PGlite. Types come from `npm run db:types` (`--project-id`, needs `SUPABASE_ACCESS_TOKEN`).

**Branches:** Each feature was a branch plus a PR, merged into `feat/design-system-homepage`, which is origin's default branch. `main` still holds only the create-next-app commit. `feat/admin-products` (3 commits) has **not been merged yet**.

---

## 2. Timeline

| # | Date | Work | Commit(s) / PR | Prompt |
| --- | --- | --- | --- | --- |
| 0 | 09-24 | Project created with create-next-app | `c3f8854` | — |
| 1 | 09-24 | Design system and storefront homepage | `736c967` | `goreto-design-system.md`, `goreto-homepage.md` |
| 2 | 09-24 | Clerk agent skills vendored (plus a security fix in a skill example) | `08df56d`, `c1484b1` | — |
| 3 | 09-24 | Clerk auth: modal sign-in/up, proxy, AGENTS.md rewritten for Clerk | `fcea955` · PR #1 | `clerk-auth-setup.md`, `clerk-auth-modals.md` |
| 4 | 09-24 | Product details page, variants, persisted cart | `60e0d5f`, `3f681cf` · PR #2 | `goreto-product-details.md` |
| 5 | 09-24 | Categories index and category pages | `518dcac` · PR #3 | `goreto-categories.md` |
| 6 | 09-25 | Seed generator, full DB schema and RLS, storefront reads from Supabase | `aee956f`, `63bcf8f` · PR #4 | `goreto-seed-data.md`, `goreto-supabase-seed-wiring.md` |
| 7 | 09-25 | Clerk ↔ Supabase identity: profiles sync, webhook, owner bootstrap, `/account` stub | `02e2a4c`, `689651d` · PR #5 | `clerk-supabase-identity.md` |
| 8 | 09-25 | Admin panel (owner and staff), core operations | `dea372b`, `27a0f3d`, `583c57a` · PR #6 | `goreto-admin-panel.md` |
| 9 | 09-25 | Admin product create/edit/delete, media, slugs | `710959b` | `goreto-admin-products-crud.md`, `goreto-admin-products-new-media-slug.md` |
| 10 | 09-25 | Design-system Select dropdown, category tree options | `f197a7c`, `0e916b8` | `goreto-select-dropdown.md` |

---

## 3. What was done, phase by phase

### Phase 0 — Initialization
- create-next-app boilerplate: `app/` folder, Geist fonts, dark mode, zinc colours. `AGENTS.md` and `CLAUDE.md` were added in the first commit.

### Phase 1 — Design system and homepage
- Moved to `src/`, with `@/*` → `./src/*`.
- Tailwind v4 `@theme` tokens in `src/app/globals.css`. Default Tailwind colours, radii and shadows are reset, so off-system classes generate no CSS.
  - Extra tokens: `primary-600`/`700`, plus semantic `success`, `warning`, `error`, `info` and `limited` tints.
- Inter and Playfair Display via `next/font`.
- Phosphor icons through a curated deep-import list, `src/components/ui/icons.ts`. The `/ssr` barrel made tests 40× slower.
- UI primitives in `src/components/ui/`: Button, IconButton, Field, Input, SearchInput, Select, Badge, Status/OrderStatusPill, ProgressBar, Rating, Card, ProductCard, LookbookCard, VideoCard, ResourceCard, Logo, NavItem, CartButton, SectionHeading and MediaFrame.
- `cn()` (clsx + tailwind-merge) and `formatNpr(paisa)`, which uses lakh grouping.
- Dev-only `/design-system` style guide page. It returns 404 in production.
- Homepage built from `goreto-home.png`: header with mobile nav, hero with AR phone mockup, trust row, category rail, featured tabs (ARIA tabs), collection carousel, how-it-works, testimonials, newsletter and footer.
- GSAP entrance and scroll reveals. They respect reduced motion and never hide content without JS. The inline script was later replaced by `@media (scripting: enabled)`.
- The newsletter Server Action validates with Zod but **does not store** the email. It says so honestly.
- Vitest and Testing Library set up.

### Phase 2/3 — Clerk authentication
- Clerk linked via the CLI (app "Goreto", dev instance). `@clerk/nextjs` installed.
- `src/proxy.ts` is public-first. `/account(.*)` and `/admin(.*)` need a session. The matcher includes `/__clerk/:path*`.
- `ClerkProvider` inside `<body>`. The appearance theme is built from the design tokens (`src/lib/auth/clerk-appearance.ts`).
- Header and mobile nav controls open Clerk **modals**. `/sign-in` and `/sign-up` remain as fallback pages. The signed-out wishlist heart opens sign-in, then continues to `/account/wishlist`.
- `.env.example` added (names only).
- `AGENTS.md` rewritten for Clerk plus Supabase RLS, and gained §4.9, the customer account area spec.

### Phase 4 — Product details page
- `/products/[slug]` built from `Goreto-products page.png`:
  - breadcrumbs, a gallery with thumbnails and a `<dialog>` lightbox;
  - variant-aware price, stock and photos;
  - quantity stepper;
  - AR card shown only for capable products;
  - spec table, accordions, and a "You May Also Like" rail.
- Zustand cart persisted to localStorage, with a live header badge. Cart prices are a **preview only**.
- The reference's "Free Delivery" and "Secure Payment" claims were replaced with truthful ones: fees shown at checkout, COD only, 7-day returns.

### Phase 5 — Categories
- `/categories` shows a tile grid with product counts.
- `/categories/[slug]` shows a product grid with a sort control in `?sort=` that also works without JS, an empty state, and a 404 page.

### Phase 6 — Database, seed and live storefront data
- **Seed generator** (`scripts/seed/`, deterministic and FK-ordered) writes `supabase/seed.ndjson`: 26 tables, about 26k lines.
  - Catalog: 195 products and 1,153 variants.
  - Orders: 2,209 orders and 11,651 shipment events.
  - People: 604 profiles.
  - Engagement: 1,296 reviews.
  - Geography: all 7 provinces and 77 districts, but only **76 of 753 municipalities**.
  - Delivery: couriers, zones and rates that match the checkout reference.
- **Migrations** (hosted dev DB):
  - `foundation`, `catalog`, `delivery_promotions`, `orders`, `engagement`, `storefront_reads` and `storage` (public `product-media` bucket).
  - RLS is on every table and keyed on `auth.jwt()->>'sub'` through `current_profile_id()`, `is_owner()` and `has_permission()`.
- **`harden_grants`** fixed a real issue: Supabase Cloud's default grants overrode the column grant on `profiles.role`. Grants are explicit now, and a `guard_profile_identity` trigger backs them up.
- **`verified_review_purchases`**: a review can cite only the reviewer's own delivered order item.
- **Scripts:**
  - `seed:load` is an idempotent upsert that also uploads images.
  - `seed:purge` removes exactly the seeded rows and objects.
  - Both are guarded by `GORETO_DATA_ENV=development`.
  - `db:push` and `db:types` are also available.
- The homepage, categories and product pages read Supabase through an anon, server-only client with ISR (60s). The old `dev-seed.ts` became a test fixture.
- `npm run test:db` runs PGlite with the real migrations and seed, checking per-role RLS.

### Phase 7 — Clerk ↔ Supabase identity
- `src/lib/supabase/server.ts` is a Clerk-token client (`accessToken`), so RLS sees the signed-in user.
- The service-role client lives only in `src/lib/supabase/admin.ts`, and only `profile-sync.ts` may import it. A boundary test enforces this.
- Migration `clerk_profile_sync` adds:
  - `sync_clerk_profile`, ordered by Clerk `updated_at`;
  - `mark_clerk_profile_deleted`, which anonymizes and leaves a tombstone;
  - `bootstrap_owner`;
  - a single-active-owner index.
- `/api/webhooks/clerk` is verified and idempotent. A lazy profile upsert on the first authenticated request covers a delayed webhook.
- Helpers: `getCurrentProfile`, `requireProfile`, `authorize`, `requirePermission` and `requireOwner`.
- `npm run owner:bootstrap` promotes a Clerk user to owner. The real owner is now bootstrapped on the dev DB.
- The Clerk dev instance's session claims now include `role: authenticated`.
- `/account` is a stub page: greeting, profile, role badge, and "Open admin" for staff.

### Phase 8 — Admin panel (core operations)
- Grouped sidebar (Overview, Catalog, Sales, Customers, Content, System), header search (⌘K), notifications, Quick Actions and profile menu.
- Dashboard built from `goreto-admin.png`:
  - KPI cards with sparklines;
  - a hand-built SVG revenue chart;
  - recent orders and a product table;
  - Quick Settings cards.
- All numbers are real DB aggregates.
- Pages:
  - Overview: analytics.
  - Catalog: products, categories, inventory, media.
  - Sales: orders (plus detail), payments (a COD ledger), coupons.
  - Customers: customers (plus detail), reviews, AR.
  - Content: promotions, content.
  - System: staff, delivery (plus zones and rates), settings, support.
  - Also search.
- Actions:
  - the order state machine: confirm → process → pack → assign courier → ship → tracking event → deliver, where delivering collects the COD payment;
  - cancel, which restocks;
  - refund;
  - stock adjustment;
  - product status;
  - review moderation;
  - active toggles and featured/bestseller flags;
  - store settings;
  - staff permission toggles.
- Migrations: `admin_operations` (13 functions), `admin_inventory_view` and `admin_aggregate_counts`.
- Every page and action re-checks permissions on the server, and RLS is the final guard. No service role is used.

### Phase 9 — Admin product editor
- `/admin/products/new` and `/admin/products/[id]/edit` share one sectioned RHF + Zod form covering:
  - basic information and pricing, with rupee→paisa string parsing and no floats;
  - an options and variant matrix of up to 100 variants;
  - specs, inventory and merchandising;
  - collection links (needs `content.manage`);
  - media;
  - read-only AR.
- Media goes straight to Storage through server-issued signed URLs. The server checks the file signature, then attaches the row. Photos can be **staged before the product exists**.
- Slug rules: 3–80 characters, up to 8 words, auto-generated from the name or entered by hand.
- Delete is allowed only for products that were never ordered. Otherwise the page offers Archive.
- Migration `admin_product_editor` adds save, delete and reorder functions, plus a deferrable unique constraint on the variant combination. **Saving never overwrites stock.**

### Phase 10 — Select dropdown
- `Select` is now an accessible select-only combobox (APG pattern), with a styled listbox and a hidden native select for forms and no-JS.
- Category dropdowns show a parent → child tree, and a chosen child reads "Parent › Child".
- Menus and the date picker share the popover styles.
- A follow-up review fix keeps unsaved edits in the product form, handles stale variants, and defers the chart-window form submit until the Select commits.

### Phase 11 — Poppins, smaller hero, category heroes, sponsored products (2026-10-04, `goreto-poppins-heroes-sponsors.md`)
- **Poppins** replaces Inter and Playfair Display everywhere: storefront, admin, Clerk and `/design-system`. AGENTS.md §3.2 now names Poppins.
- The product page's short description drops to 14/20. The homepage hero is now 280px (it was 560px), and its trust row is a strip below it.
- **Category heroes**: an optional banner on `/categories/<slug>` (image, eyebrow, title, text) edited in the category form's "Category hero" section. Migration `category_heroes`.
- **Sponsored products**: a "Sponsored" checkbox and toggles in admin. Shoppers see a blue "Goreto Pick" tick on cards, the quick view and the product page, plus a homepage "Goreto Picks" section. Migration `product_sponsored`.
- Both migrations are applied on **dev**, not yet on prod.

### Phase 12 — Shorter product form (2026-10-04, `goreto-admin-product-form-compact.md`)
- Add and Edit product now open on one **Essentials** card: name, category, price, compare-at price, stock (for a product without options), short description and photos.
- Everything else is in folded sections with one-line summaries: Description & specifications, Options & variants, Badges/tags/collections, and Advanced (URL slug, low-stock alert, SKU, weight).
- On save, any section with an error opens and shows "N to fix".
- Products without options no longer show the variants table.
- The status picker is a compact three-way switch. Below `xl`, the status/save panel sticks to the bottom of the screen.
- UI only: same fields, schema and save action.

### Phase 13 — Daraz Express (DEX) courier API (2026-10-06/07, `goreto-daraz-courier.md`, branch `feat/daraz-courier`)
- Client decision 2026-10-06: Daraz Express is booked and tracked through the Daraz Logistics API (EPIS). This reverses "no courier API integrations" (§4.0) for Daraz only; other couriers keep the WhatsApp handoff. Scope is the DEX courier only, with no Daraz marketplace listing.
- Docs for the Daraz meeting: `docs/couriers/daraz-meeting-brief.md` (client handout: accounts, what to give and get, questions, money flow, what "dashboard" means), `docs/couriers/daraz.md` (API reference, status map, runbook, go-live checklist), `docs/couriers/daraz-workflow.svg` (the app form's workflow diagram).
- Migrations `20261007090000_daraz_courier`, `20261007100000_daraz_courier_ops` and `20261007110000_daraz_tracking_autobook` are applied to **dev only**.
- Order page: a Daraz Express panel to book (box, weight, option, fee estimate), print the label (PDF/ZPL), mark ready to ship, refresh tracking, edit delivery details, cancel and rebook, choose re-attempt or return, view proof of delivery live, and open a support case.
- **Sales › Daraz Express** dashboard with seven tabs: Overview, Shipments (bulk book, merged labels, bulk ready-to-ship and refresh), Needs action, COD settlements, Support cases (XSpace), Activity (API log with trace IDs) and Setup.
- Tracking sync from Daraz history: a signed webhook (fast ack, idempotent inbox), a daily cron plus optional `pg_cron`, and a refresh when an order is opened. The order moves forward only along legal steps, and failures notify staff instead of canceling.
- Customers get a "Track on {courier}" link (courier `tracking_url_template`). Courier fees and payouts stay staff-only.
- Optional auto-booking on accept. A dev mock gateway (`npm run daraz:mock`) and an end-to-end contract test. A location importer (`npm run daraz:locations`).

### Phase 14 — Send & track and Autopilot (2026-10-07, `goreto-send-and-track.md`, branch `feat/daraz-courier`)
- Client request: the Daraz flow took about six screens per parcel. It's now one page and one optional switch. Client guide: `docs/couriers/send-and-track.md`.
- **Sales › Send & track** (`/admin/parcels`, first item in Sales):
  - **New order** opens the WhatsApp order form. **Save and send to {courier}** creates the order, accepts it with the routing rule's courier (the purchased service's courier, then the fallback), then books Daraz on the spot, or shows **Send on WhatsApp** for other couriers. A step that fails leaves the order saved and says which step.
  - One list for every courier, with a four-step progress bar, the latest tracking event and **one next-step button** per row: Accept & send, Book with Daraz, **Print label & call pickup** (label and ready-to-ship in one click), Try again or return, Send on WhatsApp.
  - Search by order number, phone, name or tracking number. Stale Daraz parcels refresh when the page opens.
- **Autopilot** card (owner, or `settings.manage` + `delivery.manage`): one switch over auto-accept (website and WhatsApp), courier mode `auto` and Daraz auto-book, with a readiness checklist. It shows **Partly on** when the switches were changed one by one.
- **Usual parcel weight** (`courier_provider_accounts.default_weight_grams`, migration `20261007120000_parcel_default_weight`, **dev only**): booking falls back to it when products have no weight. Also used by auto-book, bulk book and the order page's Book dialog.
- Refactor: Daraz staff steps moved to the `server-only` `src/features/admin/daraz-staff.ts`; order creation to `manual-order-create.ts`. `/admin/orders/new`, the order-page panel and the Daraz dashboard are unchanged.
- Quick actions gain "Send a parcel". The Daraz Express nav icon is now a van, so it's easy to tell apart from Send & track.
- Follow-up: delivery options that book through Daraz show "Books through Daraz Express". On dev, the Daraz API courier (seed "Nepal Can Move", switched by hand during testing) was renamed to **Daraz Express** (`docs/couriers/daraz-qa.md` Q8). Resume notes: the end of `prompts/goreto-send-and-track.md`.

---

## 4. Remaining work

§4.0 is the client's top priority. The rest follows the dependency chain: checkout unlocks confirmation, tracking and the account area. Items reference `AGENTS.md` sections.

### 4.0 ⭐ WhatsApp orders → admin approval → courier (TOP PRIORITY, client requirement)

**What the client wants:**
- Orders the client receives on **WhatsApp** get into the admin panel.
- Each one raises a **notification on the website** for the super admin (owner).
- The order **stays with the store until someone accepts it**: the owner, or a staff member the owner has given that right through RBAC.
- **Only after acceptance** is the order passed on and the **linked courier notified**. A courier never hears about an order that hasn't been accepted.

**Client decisions (2026-09-25):**

| Question | Answer |
| --- | --- |
| Channels | **WhatsApp only** for now. Instagram, Facebook and TikTok are out of scope. |
| Intake | **Manual entry.** Staff key in the WhatsApp order in the admin panel. No WhatsApp Business / Meta API integration for now. |
| Couriers | **Any Nepali courier.** The flow must be courier-agnostic. No courier API integrations, **except Daraz Express** (client decision 2026-10-06, Phase 13), which is booked and tracked through its API. |
| Courier on accept | **Both modes, and the client chooses:** auto-assign (the courier is picked automatically on accept) or manual (staff pick the courier while accepting). |

**What already exists to build on:**
- The order state machine already starts at `pending_confirmation` and moves to `confirmed` through `admin_transition_order`. "Accept" can map onto this.
- The `orders.write` permission and the staff permission toggles on `/admin/staff` already cover "someone controlling RBAC for him".
- Courier records (`couriers`, `courier_services`), courier assignment (`admin_assign_courier`), shipments and the append-only `shipment_events` already exist. Couriers and services can be added in the admin panel (admin phase 3).
- The admin header bell exists, but it only shows **counts** from `admin_attention_counts()`. There's no real notification feed and it doesn't update live.

**What is missing:**
- There's no admin "New order" form. Orders are only seeded today, and there's no `place_order` yet.
- The `orders` table has no **channel column** (website / WhatsApp) and nowhere to note the customer's WhatsApp number or chat reference.
- There's no notifications table or feed, no live updates (Supabase Realtime or polling), and no sound or push.
- Couriers can't be notified. All couriers are `integration_mode = manual`, and nothing sends them a message.
- There's no store setting for the courier mode (auto vs manual).

**Built 2026-09-27** (`prompts/goreto-whatsapp-orders-courier-handoff.md`, migration `20260929090000_whatsapp_orders.sql`, applied to hosted dev):
- [x] **Schema:**
  - [x] `orders.channel` enum (`website`, `whatsapp`, with room for more later).
  - [x] Optional WhatsApp reference (the customer's WhatsApp number or a note), plus `accepted_by` and `accepted_at`.
  - [x] `notifications` table, RLS-scoped to owner and permitted staff, with grants that follow `harden_grants`.
  - [x] Store setting `courier_assignment_mode` (`auto` | `manual`), plus the rule auto mode uses: the order's chosen delivery service → its courier, with a default courier as fallback.
  - [x] Courier notification contact on `couriers` (e.g. a WhatsApp/phone number for dispatch). This is a contact, not a secret.
  - [x] Courier handoff log (`courier_handoffs`): status, attempts and who sent it, so each handoff runs once and retries are safe. There's no error column, because a `wa.me` link can't report a failure. The portal phase can add one.
- [x] **Manual WhatsApp order entry** (`/admin/orders/new`, needs `orders.write`):
  - [x] Channel "WhatsApp", the customer's name, Nepal phone (E.164) and WhatsApp number, and a link to an existing customer when one exists.
  - [x] Products and variants, Nepal address (Province → District → Municipality → Ward), delivery service and an optional note.
  - [x] Prices, stock, delivery fee and totals are calculated on the server through the same `place_order` core as website checkout. The payment method is COD.
  - [x] The order is created as `pending_confirmation`, even when staff enter it, so the accept step always happens.
- [x] **Notifications:**
  - [x] A new pending order (WhatsApp or website) creates a notification.
  - [x] Live bell and feed in the admin header using Supabase Realtime, with a count, a list and a link to the order.
  - [x] Optional sound: a Web Audio chime, off by default, toggled in the bell. Browser push is **not** built (it needs a service worker).
  - [x] Only the owner and staff with `orders.read` receive them.
- [x] **Accept / reject:**
  - [x] Accept and Reject buttons on pending orders, allowed for the owner and staff with `orders.write`, checked again in SQL. Acceptance records who and when.
  - [x] **Auto mode:** accepting assigns the courier by the rule above. If nothing matches, accepting asks staff to pick one.
  - [x] **Manual mode:** the Accept dialog requires staff to pick a courier.
  - [x] Reject needs a reason. It cancels the order, and the stock rules still apply.
  - [x] The owner switches the mode in `/admin/settings` (needs `settings.manage`).
- [x] **Courier handoff, only after acceptance:**
  - [x] On accept, notify the assigned courier with a safe order payload: order number, recipient, phone, address snapshot, COD amount and items.
  - [x] No courier APIs. First channel: a WhatsApp click-to-send (`wa.me`) link, with the courier portal later (see below).
  - [x] Runs from trusted server code only, and is recorded as a shipment event and in the handoff log.
  - [x] Staff can resend the notification from the order page if it failed.
- [x] **Tests:**
  - [x] RLS: a customer can't see notifications, and staff without `orders.write` can't create or accept orders.
  - [x] Nothing reaches the courier before acceptance.
  - [x] Auto and manual courier modes.
  - [x] Server-side totals for manual orders (the browser can't set prices).
  - [x] Accept and courier handoff are idempotent.
- [x] **Auto-accept (added on plan review):** one switch per channel in `/admin/settings` (website, WhatsApp), off by default. When on, a new order is accepted in the same transaction and its courier is assigned by the automatic rule. The courier still gets it through the `wa.me` button, and the bell says "ready to send" until someone taps Send.

**Courier notification: decided 2026-09-27.** Option 1 ships first and option 2 comes in a later phase. Both are free (no paid API):

1. **Free WhatsApp click-to-send (`wa.me` link): ships first.**
   - After acceptance, the order page shows **"Send to courier on WhatsApp"**. It opens WhatsApp (web or phone) with a prefilled message to the courier's saved number: order number, recipient, phone, address, COD amount and items.
   - Costs nothing and needs no Meta approval. It is **not automatic**, though: a staff member taps Send in WhatsApp.
   - The app can only record that the button was clicked, not that WhatsApp delivered the message.
   - Needs: a courier WhatsApp number on `couriers`, and the button shown only after acceptance.
2. **Courier login on the site: later phase.**
   - Each courier (or its dispatcher) gets a Clerk account and a small **courier portal**. It shows **only accepted orders assigned to that courier**, with the delivery details needed.
   - The portal has live notifications for new assignments. It could later let the courier post status updates (picked up, out for delivery, delivered), which would feed tracking honestly.
   - Fully in-app and automatic, but bigger:
     - a new **`courier` role** (AGENTS §9.2 only defines customer/owner/staff, so this extends the role model and AGENTS.md);
     - a link between a courier user and a `couriers` row;
     - RLS so a courier sees only their own assigned, accepted orders and only the fields they need;
     - a courier invite flow;
     - portal pages.

The two options work together: click-to-send covers the handoff now, and the portal can replace or add to it later.

**Later (not now):** automatic WhatsApp intake through the WhatsApp Business Cloud API, and other social channels.

### 4.1 Core commerce
- [x] **Cart page** `/cart`, live re-pricing from the server (2026-09-27, `goreto-cart-checkout-confirmation.md`).
- [x] **Checkout** `/checkout` (§4.4, §12): migration `checkout_place_order` (`checkout_quote`, atomic `place_order`, `get_order_tracking`, `nearest_municipality`); contact with +977 phone; Province → District → Municipality → Ward cascade; "Use Current Location" with a Leaflet/OpenStreetMap map and nearest-municipality suggestion (no third-party geocoder); delivery options from zones/rates; server-validated coupons; COD only; signed-in prefill from the default address.
- [x] **Order confirmation** `/order-confirmation/[orderNumber]` and **tracking** `/track/[orderNumber]` (§4.5): guests via a hashed tracking secret in an httpOnly cookie or a tracking link; owners via their session; events only, no fake courier location.
- [ ] Guest-order claiming after sign-up, matched on a Clerk-verified email (§9.1).
- [x] **Pick address on map + full Nepal geography** (2026-10-03, `goreto-address-map-picker.md`, migrations `nepal_geography`, `account_address_coordinates`): "Pick on map" beside Street / Landmark in every address form (checkout, account addresses, admin WhatsApp order) opens a Leaflet/OSM dialog; a map tap, dragged pin, GPS or "Place pin at centre" fills Province → District → Municipality → Ward from our own boundary data, and "Use Current Location" at checkout now fills the ward too. Canonical geography built by `node scripts/geo/build-nepal.ts` into `src/data/nepal/`: all 753 local levels (Open Knowledge Nepal, CC BY 4.0), 6,720 ward polygons (OpenStreetMap, ODbL) and the official ward counts (Department of Postal Services, 6,743 wards). The migration upserts all 753 local levels and keeps the 76 old codes; the seed now mirrors the canonical files.

### 4.2 Discovery
- [x] **Search** `/search` (§13) (2026-09-28, `goreto-discovery-1-search.md`, migration `storefront_search`): `search_products` RPC (exact title → prefix → FTS + trigram typo tolerance, category words), category and price filters, sort, 24-per-page pagination, all in the URL and working without JavaScript. Header search, footer "Shop" and "New Arrivals" now land here.
- [x] **Product quick view** (§4.3) (2026-09-28, `goreto-discovery-2-quick-view.md`): intercepted `/products/[slug]` in a `@modal` slot of the store layout. Every storefront product card (and its bag icon) opens a native-`<dialog>` quick view with the variant picker, Add to Cart and Buy Now; the URL is the canonical product page, so reload/share/new tab open the full page, and Back/Forward close and reopen it. "View full details" does a full load. Data reads through `CATALOG_CACHE_TAG`, so admin edits reach it at once.
- [x] **Collections** (2026-09-29, `goreto-discovery-3-collections.md`, no migration): `/collections` lists live collections (active and in their schedule window) with active-product counts; `/collections/[slug]` shows the banner (shared with the homepage carousel) and products in the curated admin order, with the category sort control and quick view. Ended, off or unknown collections return 404. Admin saves revalidate both.
- [ ] `/offers` page.
- [x] **Reviews on the product page** (2026-10-06, `goreto-account-3-reviews-profile.md`, migration `product_reviews`): "Customer reviews" with the average, a 5 → 1 breakdown, the latest 4 and "See all"; `/products/[slug]/reviews` (10 per page, `?page=`); "(N reviews)" jumps to the section. **Verified buyers only** (client decision): `submit_review` derives the delivered order item in SQL, and direct inserts now need one too.

### 4.3 Customer account area (§4.9)
Three phases: 1. shell + overview + orders + tracking + billing ✅ → 2. wishlist (with the storefront heart) + addresses ✅ → 3. reviews + profile & security ✅.
- [x] **Phase 1** (2026-10-01, `goreto-account-1-orders-billing.md`, migration `account_reads`): grouped account nav (sidebar from `lg`, scrollable pill row below), `loading`/`error` states; overview with profile card, stat cards (total orders, in progress, billed to date with pending COD as a hint) and the latest 3 orders; `/account/orders` (10 per page); `/account/orders/[orderNumber]` reusing the tracking view without the tracking secret, so only your own signed-in orders open; `/account/tracking` (latest 50 events); `/account/billing` (billed = collected only, pending COD separate, per-order breakdown). `account_summary()` and `account_tracking_events()` filter on the caller's own profile, so owners and staff see only their personal orders.
- [x] Overview stat cards: total orders, orders in progress, total billed to date.
- [x] `/account/orders` (paginated) and `/account/orders/[orderNumber]` (detail plus timeline).
- [x] `/account/tracking`: events across the customer's orders.
- [x] **Phase 2** (2026-10-02, `goreto-account-2-wishlist-addresses.md`, migration `account_addresses_wishlist`): the storefront heart (cards, product page, quick view) saves and removes through Server Actions, with saved state loaded in the browser from `GET /api/account/wishlist` so storefront pages stay cached; signed out it opens the sign-in modal and saves after sign-in. `/account/wishlist` shows live price and stock, Add to Cart for single-variant products, Choose options otherwise, and "No longer available" for hidden products. `/account/addresses` (+ `new`, `[id]/edit`) with one default kept by `account_save_address` / `account_set_default_address` / `account_delete_address` (deleting the default promotes the newest). Caps: 10 addresses, 200 wishlist items (triggers).
- [x] `/account/wishlist`, with the storefront heart.
- [x] `/account/addresses`, including a default address for checkout (checkout already prefilled the default).
- [x] `/account/reviews` (2026-10-06): "Ready to review" (delivered products not yet reviewed), and your reviews marked Awaiting approval, Published or Not published (the staff note is never shown), with Edit (back to moderation) and Delete. Write and edit at `/account/reviews/[slug]`.
- [x] `/account/billing`: billed total = collected orders only. Pending COD is shown separately and totals are computed in SQL.
- [x] `/account/profile/[[...rest]]` (2026-10-06): Clerk `<UserProfile />` in the account shell, themed from `clerk-appearance.ts`. New nav group **Profile**: Reviews, Profile & security.
- [x] Grouped account navigation, plus empty, loading and error states (phase 1 sections; later phases add theirs).

### 4.4 AR / virtual try-on (§14)
- [ ] `/try-on` page. The header, hero and product try-on card all link to it.
- [ ] Live camera try-on: permission after a user action, a lazy-loaded MediaPipe landmark overlay using the seeded `product_ar_assets` placements, and stopping the camera tracks on exit.
- [ ] AR asset files themselves. Seed rows point to `ar/<slug>/…` files that don't exist yet.
- [ ] Photo try-on:
  - [ ] a `try_on_jobs` table (**not yet in any migration**);
  - [ ] a private bucket with 24h retention;
  - [ ] `api/ar/photo` behind a provider adapter;
  - [ ] "unavailable" state when no provider is configured.
- [ ] Admin AR asset upload (phase 4b of the admin work).

### 4.5 Admin follow-ups (phases deferred by the admin prompts)
- [x] Phase 2: create, edit and delete for **categories** and **collections** (2026-09-25, `goreto-admin-categories-collections.md`, migration `admin_categories_collections`).
- [x] Phase 3: create, edit and delete for **coupons**, **couriers and courier services**, **delivery zones** and **rates** (2026-09-26, `goreto-admin-coupons-delivery.md`, migration `admin_coupons_delivery`).
- [x] Phase 4: **staff invitations** through a Clerk Backend API invite, pending list with revoke, and role changes (promote a customer, remove from staff) (2026-09-26, `goreto-admin-staff-invitations.md`, migration `admin_staff_invitations`). Also fixed new users' first protected page returning 500 (Next fetch memoization in `readOwnProfile`).
- [x] Phase 4b: **AR asset upload**: add, edit, replace and delete assets in a new `ar-assets` bucket, with byte-checked PNG/WebP/GLB/USDZ, mode→format rules and optional calibration (2026-09-27, `goreto-admin-media-ar.md`, migration `admin_ar_media`).
- [x] Upload on the Media page: pick a product and upload photos to the end of its gallery (2026-09-27).
- [x] Orphaned-upload cleanup: panels on `/admin/media` and `/admin/ar` delete unreferenced admin uploads older than 24 hours. It's a button, not a scheduled job; a cron route needs deployment first (2026-09-27).
- [x] "Duplicate product": copies into a draft with `(copy)`, a free slug, `-COPY` SKUs, zero stock and copied photos, but no AR assets (2026-09-27).
- [x] **Bulk add products** at `/admin/products/bulk`: short cards with "Add another product" at the end, created one by one (failed ones stay editable for Retry). Each product can have **7 photos + 3 videos** (MP4/WebM ≤ 50 MB), enforced in the UI, server and a DB trigger. Videos play in the storefront gallery after the photos; covers stay photo-only (2026-10-04, `goreto-admin-bulk-add-products.md`, migration `product_media_videos`). Applied on dev; follow-up fixes in PR #21.
- [x] Courier webhook `api/courier/webhooks/daraz` and scheduled sync `api/cron/courier-sync` (Phase 13). Other couriers have no API and stay manual.
- [ ] Daraz Express go-live: Daraz's answers (status list, phone format, booking call, solution codes, R-codes), prod migrations, keys and setup. See `docs/couriers/daraz.md` §13 and `docs/releasing.md` § Daraz Express.
- [ ] Daraz Express: signed-in browser pass of the order panel and dashboard (mock gateway), and a first real test parcel.
- [ ] Optional: mirror `role` into Clerk `publicMetadata`, written by the server only.

### 4.6 Content, legal and static pages
Several footer and nav links return a 404 today.
- [ ] `/help`, `/about`, `/privacy`, `/terms`, `/cookies`.
- [ ] Newsletter persistence. The `newsletter_subscribers` table exists, but the action stores nothing.
- [ ] Replace the Lorem Picsum photos (hero, how-it-works, seed product images) with real photography.

### 4.7 Data
- [ ] Full Nepal administrative dataset: all 753 local levels, from a verified source, in `src/data/nepal/` (§15.5). The seed has only 76.

### 4.8 Quality, tooling and deployment
- [x] **New Supabase account** (2026-10-06, `goreto-supabase-account-migration.md`): `goreto-dev` (`jkjrfgictvpolvohgwcg`) and `goreto-prod` (`etfcgwvdshhcxkrkytne`), Mumbai. Both have every migration and Clerk third-party auth, and the owner is bootstrapped on both; dev is seeded. Vercel Production and Preview are switched and production is redeployed. Fresh start: no data was copied. The old projects are untouched and unused.
- [ ] Playwright E2E with `@clerk/testing` for the 11 journeys in §23.4. Playwright isn't installed. Browser checks so far used throwaway scratchpad scripts.
- [ ] Prettier. It isn't configured.
- [ ] `README.md` is still the create-next-app boilerplate.
- [x] **Production release, live 2026-10-04** (`goreto-production-release.md`, `docs/releasing.md`): https://goreto-kappa.vercel.app deploys only from the `production` branch (Vercel project `goreto`, team "projectshamro-2560's projects"). It uses the separate free Supabase project `goreto-prod` (ap-south-1, migrations only, no seed) and the separate Clerk app "Goreto Live" (development instance until a domain exists, with third-party auth and the webhook configured). Owner: himavolt3569@gmail.com. Unfinished storefront entry points are hidden in production builds by `src/config/features.ts`. Migration `store_settings_singleton` creates the settings row a fresh database lacked.
- [ ] Custom domain: Vercel domain, then the Goreto Live **production** instance (DNS), new keys in Vercel and Supabase third-party auth. Dev-instance users don't carry over, so the owner must sign up again and be re-bootstrapped.
- [ ] Move `goreto-prod` to Supabase Pro once real orders flow (free projects pause after 7 idle days and have no backups).
- [x] Deployment secrets: set per environment in Vercel (Production = prod, Preview = dev).
- [ ] Add the missing `.env.example` names: `NEXT_PUBLIC_SITE_URL`, AR, geocoding and courier (§17).
- [x] `production` is the release branch; `main` still holds only the initial commit and can be deleted.
- [ ] Open and merge a PR for `feat/admin-products`.

---

## 5. Needs your decision or action

- **Daraz Express (Phase 13):** after the Daraz meeting, fill in `docs/couriers/daraz-meeting-brief.md` §5 with Daraz's answers and put them in Admin › Daraz Express › Setup. Live keys go on Vercel **Production only**; preview and dev use the mock. Decide on the webhook certificate (Daraz requires OV/EV; ours is DV) and, if Daraz requires fixed IPs, on Vercel Static IPs (about $100 a month). Release steps: `docs/releasing.md` § Daraz Express.
- **Send & track and Autopilot (Phase 14):** a signed-in browser pass is still to do (steps in `prompts/goreto-send-and-track.md`). Autopilot accepts every new order automatically when on; it's off until the owner turns it on. Set a usual parcel weight before relying on Daraz auto-booking. The migration `20261007120000_parcel_default_weight` goes to prod with the other Daraz migrations.
- **WhatsApp order flow (§4.0):** built on `feat/whatsapp-orders`. Before relying on it: add each courier's dispatch WhatsApp number (Delivery → Couriers), choose the courier mode, default courier and auto-accept switches (Settings), and give the right staff `orders.write`. The signed-in browser pass is still to do. The courier portal (automatic handoff, adds a `courier` role) is the next phase.
- **Production store setup (client):** before taking orders, add at least one courier + service, delivery zone and rate, support email/phone and the dispatch municipality (`/admin/settings`), and real products. Checkout offers no delivery option without them.
- **AR wording on the live homepage:** the hero copy and "How it works" still describe AR try-on (no links). Decide whether to reword until `/try-on` ships.
- **Seed AR rows have no files (dev only):** `/admin/ar` flags them "No file uploaded". Production has no seed, so this no longer blocks launch.
- **Returns policy wording:** "7-day returns" was taken from the reference. See the `TODO(owner)` in `src/config/site.ts`.
- **Social links:** Instagram, YouTube and Pinterest URLs in `src/config/site.ts` are empty, so the footer icons don't show.
- **Sponsored products are not disclosed to shoppers:** at the client's request the tick reads "Goreto Pick" and never "Sponsored". Undisclosed paid placement may count as misleading advertising under Nepal's Consumer Protection Act 2075. The wording is one constant (`PICK_LABEL` in `src/components/ui/pick-badge.tsx`).
- **Release Phases 11–12 and account phase 3:** the new `goreto-prod` already has every migration (through `product_reviews`), so `feat/poppins-heroes-sponsors` and `feat/account-reviews-profile` can be merged to `production` without a database step.
- **Orange contrast:** white on `#F97316` and orange text on white measure about 2.8:1, below WCAG AA for body text. The reference colours were kept as-is. This was raised in the design-system prompt and hasn't been decided yet.
- **Store support email and phone:** they're empty in `store_settings`. You can set them in `/admin/settings`.
- **Clerk webhook:** configured for production (Goreto Live → `https://goreto-kappa.vercel.app/api/webhooks/clerk`, secret in Vercel). The dev app still has no endpoint or `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.local`; the lazy profile upsert covers dev.
- **Supabase third-party auth (Clerk):** configured in the Supabase Dashboard. The owner bootstrap and admin work ran as the real owner, which suggests it's working. Local `config.toml` keeps it disabled, which is expected. Production (`goreto-prod`) trusts only the Goreto Live domain `natural-tetra-315.clerk.accounts.dev`.

## 6. Known limits carried forward

- Swapping SKUs between two variants in a single save is refused. Save twice instead.
- The signed-upload path with the Clerk-token client was checked manually, not in automated tests.
- Seed product photos are repeated Picsum placeholders, so alt text won't always match the image.
- Admin uploads can be attached for 20 hours; after that the save asks for a new upload. This keeps saves clear of the unused-upload cleanup, which only deletes files older than 24 hours.
- Map-picker ward detection: 23 official wards have no OSM ward polygon (points there fill the municipality and ask for the ward), national parks aren't inside any local level in the OKN data (points there say "couldn't match"), and the simplified boundaries agree with full detail on 99.55% of random points. Every field stays editable. Refresh with `node scripts/geo/build-nepal.ts --refresh`.
- `nearest_municipality()` is no longer used (the lookup is in `src/features/delivery/locate.ts`); drop it in a later cleanup.
- Stock adjustments don't revalidate the storefront. Product pages refresh every 60 seconds, and checkout must re-check stock in the database.
