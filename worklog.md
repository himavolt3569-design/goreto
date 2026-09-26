# Goreto.store — Work Log

_Last updated: 2026-09-25 · Branch: `feat/admin-products` (clean, pushed to origin)_

Sources: git history (24 commits), `AGENTS.md`, all 13 files in `prompts/`, the migrations, the code in `src/`, `scripts/` and `tests/`, and a fresh run of the checks below.

---

## 1. Current state

| Check | Result (run 2026-09-25) |
| --- | --- |
| `npm run typecheck` | ✅ passes |
| `npm run lint` | ✅ passes |
| `npm test` (Vitest + RTL) | ✅ 39 files, 298 tests |
| `npm run test:db` (PGlite + real migrations + seed + RLS) | ✅ 4 files, 97 tests |
| `npm run build` | Not re-run today. The last task reported it passing. |

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
| Couriers | **Any Nepali courier.** The flow must be courier-agnostic, and there are **no courier API integrations**. |
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

**To build:**
- [ ] **Schema:**
  - [ ] `orders.channel` enum (`website`, `whatsapp`, with room for more later).
  - [ ] Optional WhatsApp reference (the customer's WhatsApp number or a note), plus `accepted_by` and `accepted_at`.
  - [ ] `notifications` table, RLS-scoped to owner and permitted staff, with grants that follow `harden_grants`.
  - [ ] Store setting `courier_assignment_mode` (`auto` | `manual`), plus the rule auto mode uses: the order's chosen delivery service → its courier, with a default courier as fallback.
  - [ ] Courier notification contact on `couriers` (e.g. a WhatsApp/phone number for dispatch). This is a contact, not a secret.
  - [ ] Courier handoff log: status, attempts, errors and who sent it, so each handoff runs once and retries are safe.
- [ ] **Manual WhatsApp order entry** (`/admin/orders/new`, needs `orders.write`):
  - [ ] Channel "WhatsApp", the customer's name, Nepal phone (E.164) and WhatsApp number, and a link to an existing customer when one exists.
  - [ ] Products and variants, Nepal address (Province → District → Municipality → Ward), delivery service and an optional note.
  - [ ] Prices, stock, delivery fee and totals are calculated on the server through the same `place_order` core as website checkout. The payment method is COD.
  - [ ] The order is created as `pending_confirmation`, even when staff enter it, so the accept step always happens.
- [ ] **Notifications:**
  - [ ] A new pending order (WhatsApp or website) creates a notification.
  - [ ] Live bell and feed in the admin header using Supabase Realtime, with a count, a list and a link to the order.
  - [ ] Optional sound or browser push.
  - [ ] Only the owner and staff with `orders.read` receive them.
- [ ] **Accept / reject:**
  - [ ] Accept and Reject buttons on pending orders, allowed for the owner and staff with `orders.write`, checked again in SQL. Acceptance records who and when.
  - [ ] **Auto mode:** accepting assigns the courier by the rule above. If nothing matches, accepting asks staff to pick one.
  - [ ] **Manual mode:** the Accept dialog requires staff to pick a courier.
  - [ ] Reject needs a reason. It cancels the order, and the stock rules still apply.
  - [ ] The owner switches the mode in `/admin/settings` (needs `settings.manage`).
- [ ] **Courier handoff, only after acceptance:**
  - [ ] On accept, notify the assigned courier with a safe order payload: order number, recipient, phone, address snapshot, COD amount and items.
  - [ ] No courier APIs. Delivery channel still to be decided; see the open question below.
  - [ ] Runs from trusted server code only, and is recorded as a shipment event and in the handoff log.
  - [ ] Staff can resend the notification from the order page if it failed.
- [ ] **Tests:**
  - [ ] RLS: a customer can't see notifications, and staff without `orders.write` can't create or accept orders.
  - [ ] Nothing reaches the courier before acceptance.
  - [ ] Auto and manual courier modes.
  - [ ] Server-side totals for manual orders (the browser can't set prices).
  - [ ] Accept and courier handoff are idempotent.

**Courier notification: shortlisted, not final.** The client is leaning towards one or both of these free options (no paid API):

1. **Free WhatsApp click-to-send (`wa.me` link).**
   - After acceptance, the order page shows **"Send to courier on WhatsApp"**. It opens WhatsApp (web or phone) with a prefilled message to the courier's saved number: order number, recipient, phone, address, COD amount and items.
   - Costs nothing and needs no Meta approval. It is **not automatic**, though: a staff member taps Send in WhatsApp.
   - The app can only record that the button was clicked, not that WhatsApp delivered the message.
   - Needs: a courier WhatsApp number on `couriers`, and the button shown only after acceptance.
2. **Courier login on the site.**
   - Each courier (or its dispatcher) gets a Clerk account and a small **courier portal**. It shows **only accepted orders assigned to that courier**, with the delivery details needed.
   - The portal has live notifications for new assignments. It could later let the courier post status updates (picked up, out for delivery, delivered), which would feed tracking honestly.
   - Fully in-app and automatic, but bigger:
     - a new **`courier` role** (AGENTS §9.2 only defines customer/owner/staff, so this extends the role model and AGENTS.md);
     - a link between a courier user and a `couriers` row;
     - RLS so a courier sees only their own assigned, accepted orders and only the fields they need;
     - a courier invite flow;
     - portal pages.

The two options work together: WhatsApp click-to-send could ship first, with the courier portal added later. Needs the client's final choice before the plan is written.

**Later (not now):** automatic WhatsApp intake through the WhatsApp Business Cloud API, and other social channels.

### 4.1 Core commerce
- [ ] **Cart page** `/cart`. The store exists, but the route doesn't, and the header badge and "View cart" link go to a 404.
- [ ] **Checkout** `/checkout` (§4.4, §12). Buy Now already navigates here.
  - [ ] `place_order` Postgres RPC: atomic stock lock/decrement, server-side prices, coupon, delivery rate and totals in paisa.
  - [ ] Contact form with a Nepal phone field (E.164).
  - [ ] Nepal address cascade: Province → District → Municipality → Ward, plus a location button, a map preview, and a reverse-geocode route (`api/geocode/reverse`).
  - [ ] Delivery service selection from the zones and rates.
  - [ ] COD-only payment. The reference's eSewa, Khalti and card options must **not** be built.
  - [ ] Coupon entry, validated on the server.
  - [ ] Prefill for signed-in users from their default address.
- [ ] **Order confirmation** `/order-confirmation/[orderNumber]` (§4.5), from `goreto-order confirm.png`.
- [ ] **Tracking** `/track/[orderNumber]` for guests, using the hashed tracking secret through a server path. Show events only, never fake GPS.
- [ ] Guest-order claiming after sign-up, matched on a Clerk-verified email (§9.1).

### 4.2 Discovery
- [ ] **Search** `/search` (§13): FTS plus `pg_trgm` ranking, with query, filter and sort in the URL. The indexes already exist. The header search form and the "New Arrivals" link already point here.
- [ ] **Product quick view** modal that keeps the canonical URL (§4.3).
- [ ] **Collections** pages (`/collections`, `/collections/[slug]`). The carousel and nav link to them.
- [ ] `/offers` page.
- [ ] Reviews on the product page: a list and a write form. "(N reviews)" is plain text today.

### 4.3 Customer account area (§4.9)
The `/account` overview is only a stub. Still to build:
- [ ] Overview stat cards: total orders, orders in progress, total billed to date.
- [ ] `/account/orders` (paginated) and `/account/orders/[orderNumber]` (detail plus timeline).
- [ ] `/account/tracking`: events across the customer's orders.
- [ ] `/account/wishlist`. The wishlist heart is still an inert "coming soon" button on cards.
- [ ] `/account/addresses`, including a default address for checkout.
- [ ] `/account/reviews`, showing moderation status.
- [ ] `/account/billing`: billed total = collected orders only. Pending COD is shown separately and totals are computed in SQL.
- [ ] `/account/profile/[[...rest]]`: Clerk `<UserProfile />`, themed.
- [ ] Grouped account navigation, plus empty, loading and error states for each section.

### 4.4 AR / virtual try-on (§14)
- [ ] `/try-on` page. The header, hero and product try-on card all link to it.
- [ ] Live camera try-on: permission after a user action, a lazy-loaded MediaPipe landmark overlay using the seeded `product_ar_assets` placements, and stopping the camera tracks on exit.
- [ ] AR asset files themselves. Seed rows point to `ar/<slug>/…` files that don't exist yet.
- [ ] Photo try-on:
  - [ ] a `try_on_jobs` table (**not yet in any migration**);
  - [ ] a private bucket with 24h retention;
  - [ ] `api/ar/photo` behind a provider adapter;
  - [ ] "unavailable" state when no provider is configured.
- [ ] Admin AR asset upload (phase 4 of the admin work).

### 4.5 Admin follow-ups (phases deferred by the admin prompts)
- [x] Phase 2: create, edit and delete for **categories** and **collections** (2026-09-25, `goreto-admin-categories-collections.md`, migration `admin_categories_collections`).
- [x] Phase 3: create, edit and delete for **coupons**, **couriers and courier services**, **delivery zones** and **rates** (2026-09-26, `goreto-admin-coupons-delivery.md`, migration `admin_coupons_delivery`).
- [ ] Phase 4: **staff invitations** through a Clerk Backend API invite and role changes, plus **AR asset upload**.
- [ ] Upload on the Media page. Today it links to the product editor.
- [ ] A cleanup job for orphaned uploads (abandoned signed uploads and abandoned staged Add product photos).
- [ ] Optional: a "Duplicate product" action and video media.
- [ ] Courier webhooks `api/courier/webhooks/[provider]`. Every courier is `manual` today.
- [ ] Optional: mirror `role` into Clerk `publicMetadata`, written by the server only.

### 4.6 Content, legal and static pages
Several footer and nav links return a 404 today.
- [ ] `/help`, `/about`, `/privacy`, `/terms`, `/cookies`.
- [ ] Newsletter persistence. The `newsletter_subscribers` table exists, but the action stores nothing.
- [ ] Replace the Lorem Picsum photos (hero, how-it-works, seed product images) with real photography.

### 4.7 Data
- [ ] Full Nepal administrative dataset: all 753 local levels, from a verified source, in `src/data/nepal/` (§15.5). The seed has only 76.

### 4.8 Quality, tooling and deployment
- [ ] Playwright E2E with `@clerk/testing` for the 11 journeys in §23.4. Playwright isn't installed. Browser checks so far used throwaway scratchpad scripts.
- [ ] Prettier. It isn't configured.
- [ ] `README.md` is still the create-next-app boilerplate.
- [ ] Staging and production: a Clerk production instance and webhook endpoint, and separate Supabase staging and production projects.
- [ ] Deployment secrets: `SUPABASE_SERVICE_ROLE_KEY` is needed by the server app for the profile sync.
- [ ] Add the missing `.env.example` names: `NEXT_PUBLIC_SITE_URL`, AR, geocoding and courier (§17).
- [ ] Decide what `main` should become. Today it holds only the initial commit, and origin's default branch is `feat/design-system-homepage`.
- [ ] Open and merge a PR for `feat/admin-products`.

---

## 5. Needs your decision or action

- **WhatsApp order flow (§4.0, top priority):** channels, intake, couriers and courier mode are decided. For the courier notification, the client is choosing between **free WhatsApp click-to-send**, a **courier login/portal**, or both, and hasn't made a final choice. The portal adds a new `courier` role to the auth model.
- **Returns policy wording:** "7-day returns" was taken from the reference. See the `TODO(owner)` in `src/config/site.ts`.
- **Social links:** Instagram, YouTube and Pinterest URLs in `src/config/site.ts` are empty, so the footer icons don't show.
- **Orange contrast:** white on `#F97316` and orange text on white measure about 2.8:1, below WCAG AA for body text. The reference colours were kept as-is. This was raised in the design-system prompt and hasn't been decided yet.
- **Store support email and phone:** they're empty in `store_settings`. You can set them in `/admin/settings`.
- **Clerk webhook:** needs `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.local` and an endpoint in the Clerk Dashboard. When the identity task shipped, the secret wasn't set; I can't tell from the repo whether it has been since.
- **Supabase third-party auth (Clerk):** configured in the Supabase Dashboard. The owner bootstrap and admin work ran as the real owner, which suggests it's working. Local `config.toml` keeps it disabled, which is expected.
- **Before production:** run `npm run seed:purge`. The seed is development-only, and its fake owner is already demoted on dev.

## 6. Known limits carried forward

- Swapping SKUs between two variants in a single save is refused. Save twice instead.
- The signed-upload path with the Clerk-token client was checked manually, not in automated tests.
- Seed product photos are repeated Picsum placeholders, so alt text won't always match the image.
- Stock adjustments don't revalidate the storefront. Product pages refresh every 60 seconds, and checkout must re-check stock in the database.
