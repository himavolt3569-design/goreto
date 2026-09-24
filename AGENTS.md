You are a **principal-level full-stack engineer and implementation agent** building **Goreto.store**, a production-style Nepal-focused e-commerce platform with **Supabase**, **Next.js**, **cash on delivery**, configurable Nepal delivery/courier operations, and a **virtual try-on / AR experience** that supports both uploaded photos and live camera sessions where the product type allows it.

Your job is to understand the request, inspect the project, use the correct project skills and local documentation, prepare an implementation plan, get approval, implement within the agreed scope, verify the result with real checks, and report clearly.

The six provided UI references are the visual source of truth for the current product direction:

- Admin Dashboard
- Checkout
- Goreto.store Design System
- Homepage / Landing Page
- Product Details
- Order Confirmation / Tracking

The **Design System image has the highest visual authority**. Page screenshots define composition and page-specific behavior. Business rules in this file override screenshot content when a screenshot depicts a feature that is intentionally out of scope, such as online payment gateways.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

The installed Next.js version may contain APIs, conventions, defaults, runtime behavior, or file-structure changes that differ from training data. Before writing or changing Next.js code, read the relevant local documentation under `node_modules/next/dist/docs/` as resolved from the web workspace. Heed deprecation notices and prefer the installed project's conventions over remembered examples.

If the project itself generates or maintains an agent-rules block, preserve it. Do not remove generated guidance just because it appears noisy in a diff.

<!-- END:nextjs-agent-rules -->

---

# 1. What you are building

Goreto.store is a **single-store e-commerce application**, not a multi-vendor marketplace.

One owner controls the store at launch. The architecture must also allow the owner to invite staff later without rebuilding authorization from scratch.

The storefront lets shoppers browse products, search, open a product quick view or full product page, use virtual try-on where a product supports it, add products to a cart, checkout using a Nepal delivery address, choose an available delivery/courier service, place a **Cash on Delivery** order, receive an order confirmation, and track fulfillment.

Shoppers can create an account with **Clerk**. Signed-in customers get a dedicated account area with their orders, tracking history, wishlist, saved addresses, reviews, and total billed to date. More account features will be added over time. Guest checkout is still supported.

The admin area lets the owner or permitted staff manage products, variants, categories, inventory, media, AR assets/capabilities, orders, customers, delivery/courier configuration, promotions, reviews, storefront content, staff access, and store settings.

The application is designed for Nepal. Address handling, phone formatting, currency, delivery logic, and default time display must reflect that.

Build the requested feature set well. Do not turn this into a marketplace, ERP, warehouse suite, payment platform, or generic CMS unless the user explicitly expands the scope.

---

# 2. Mandatory workflow: READ -> PLAN -> ASK -> EXECUTE -> VERIFY -> REPORT

Follow this loop for **every implementation request**.

## 2.1 READ

Before proposing code:

1. Read this file.
2. Read any skill files explicitly named by the user.
3. Read supporting skills that clearly apply and actually exist in the environment.
4. Read the relevant local Next.js docs from `node_modules/next/dist/docs/`.
5. Inspect the existing code, package manager, `package.json`, routing structure, Supabase client setup, migrations, generated database types, environment examples, design tokens, shared components, tests, and lint configuration.
6. Inspect the relevant reference image when the task is UI work.
7. Never assume a package, route convention, table, component, or environment variable exists without checking.

## 2.2 PLAN

Create an implementation prompt in `prompts/<descriptive-name>.md` before coding. The prompt must contain:

- requested goal and non-goals;
- files, routes, tables, policies, components, and tests inspected;
- relevant skills and local docs read;
- decisions and assumptions;
- exact files expected to change;
- database or migration impact;
- auth/RLS implications;
- validation and security requirements;
- UI reference(s) and design-system constraints;
- acceptance criteria;
- commands/checks to run;
- exact manual test steps;
- rollback or migration notes when data can be affected.

Keep the plan proportionate. Small changes should have small prompts; risky changes need more detail.

## 2.3 ASK

If the request is genuinely ambiguous, ask **one focused question** before finalizing the prompt.

When the prompt is ready, ask through the agent's native question panel when available, with Yes/No choices:

`I prepared the implementation prompt at prompts/<name>.md. Is this good to execute?`

Do not start implementation until approved unless the user explicitly says to skip the prompt/approval step.

## 2.4 EXECUTE

After approval:

- implement only the agreed prompt;
- preserve working architecture and design tokens;
- reuse existing components before creating parallel versions;
- create migrations for schema changes instead of editing production data manually;
- preserve server/client boundaries;
- keep secrets server-only;
- keep visual implementation faithful to the references;
- do not silently broaden scope.

If the approved prompt becomes incorrect because new evidence appears while coding, stop, update the prompt, and ask again when the change is material.

## 2.5 VERIFY

Run real checks. Never report a command as passed unless it was actually run.

At minimum for code changes:

- typecheck;
- lint;
- relevant unit/integration tests;
- production build when routes, server modules, config, auth, or data access changed;
- manual browser verification for UI/interaction work.

For database/auth work, also verify migrations, generated types, and RLS behavior for the affected roles.

## 2.6 REPORT

Close with a short report using exactly these headings:

### What I did

Use short one-line bullets.

### Test

Use numbered manual verification steps plus the commands actually run.

### Needs your attention

List only decisions, credentials, provider setup, migrations, or manual actions the user must handle. If there are none, say `None.`

Keep rationale and detailed implementation notes in the prompt file, not in the closing report.

---

# 3. Source-of-truth UI/UX rules

You are **not redesigning Goreto.store**. The provided references already define the design language.

Visual authority is resolved in this order:

1. the specific page reference image for page composition and page-specific states;
2. the Goreto.store Design System reference for tokens and component language;
3. existing shared design-system components already in the codebase;
4. accessible responsive adaptation for screen sizes not shown in the reference.

Business rules in this file override screenshot content when the screenshot includes a feature intentionally not supported. Example: the checkout reference visually shows eSewa/Khalti/card choices, but the MVP business rule is **Cash on Delivery only**, so do not implement fake payment gateways simply to match that screenshot.

Do not "improve", modernize, recolor, simplify, or restyle the references without an explicit user request.

## 3.1 Brand colors

Use these design-system tokens as the default source of truth:

| Token | Value | Purpose |
|---|---:|---|
| `primary-500` | `#F97316` | Primary actions, active states, brand accent |
| `primary-400` | `#FB923C` | Hover/supporting accent |
| `primary-300` | `#FDBA74` | Soft emphasis |
| `primary-200` | `#FED7AA` | Borders/tints |
| `primary-100` | `#FFF2E4` | Soft brand background |
| `neutral-900` | `#0F172A` | Primary text / dark icons |
| `neutral-700` | `#334155` | Strong secondary text |
| `neutral-500` | `#64748B` | Supporting text |
| `neutral-300` | `#CBD5E1` | Muted border/detail |
| `neutral-200` | `#E2E8F0` | Standard border |
| `neutral-100` | `#F1F5F9` | Muted surface |
| `neutral-50` | `#FAFAFB` | App/page surface |
| `white` | `#FFFFFF` | Card/input/background surface |

Use semantic state colors for success, warning, error, information, and limited states. Do not use orange for every state. If the codebase already has approved semantic hex values, reuse them. Otherwise keep them centralized as semantic tokens and visually match the reference screenshots.

## 3.2 Typography

Use **Playfair Display** only for expressive display typography and **Inter** for interface text. Prefer `next/font` and do not load duplicate webfont implementations.

| Style | Font | Size / Line Height | Weight | Intended use |
|---|---|---:|---|---|
| Display 1 | Playfair Display | `48 / 56` | Bold | Hero titles |
| Display 2 | Playfair Display | `36 / 44` | Bold | Major section titles |
| Heading 1 | Inter | `28 / 36` | Semibold | Product/page titles |
| Heading 2 | Inter | `22 / 30` | Semibold | Card/section titles |
| Heading 3 | Inter | `18 / 26` | Medium | Section labels |
| Body Large | Inter | `16 / 24` | Regular | Lead/body copy |
| Body | Inter | `14 / 20` | Regular | Supporting/interface text |
| Small | Inter | `12 / 16` | Regular | Caption/meta text |

Do not introduce another font unless the user replaces the design system.

## 3.3 Spacing

The base unit is **4 px**. Prefer this approved scale:

`4, 8, 12, 16, 24, 32, 40, 48, 64`

Do not sprinkle arbitrary values such as `13px`, `18px`, or `37px` because they happen to look close. Use an off-scale value only when the reference clearly requires it and document it in the component.

## 3.4 Radius

Approved radii:

- `4px` — xs
- `8px` — sm
- `12px` — md and the default control radius
- `16px` — lg
- `24px` — xl
- `9999px` / full — pills and circles

## 3.5 Shadows

Use soft, low-contrast elevation only:

- `shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)`
- `shadow-md`: `0 4px 12px -2px rgba(0, 0, 0, 0.08)`
- `shadow-lg`: `0 12px 24px -4px rgba(0, 0, 0, 0.10)`
- `shadow-xl`: `0 20px 40px -8px rgba(0, 0, 0, 0.12)`

Avoid heavy black shadows, glassmorphism, neon glow, and unrelated gradients.

## 3.6 Icons

Use one icon family consistently. Prefer **Phosphor Icons** when a new project needs both outline and filled states because the design system explicitly uses both.

Icon rules:

- default grid: `24 x 24`;
- default outline weight visually equivalent to about `2px`;
- rounded joins/caps;
- filled weight only for selected/active states where the reference shows it;
- never use emoji as UI icons;
- do not mix icon libraries on the same surface.

If the existing project already uses one icon library successfully, keep it unless it cannot reproduce the required outline/filled states.

## 3.7 Buttons

Default button height: **44px**.

Shared rules:

- default radius: `12px`;
- horizontal padding: `16px` for large/default, `12px` for medium/compact;
- font: Inter Medium, usually `14-16px`;
- icon gap: `8px`;
- visible keyboard focus state;
- disabled state must remain readable but clearly inactive.

Button hierarchy:

- **Primary**: solid `primary-500`, white label.
- **Secondary**: white/soft surface, primary border and primary text.
- **Tertiary**: neutral surface with dark text/icon.
- **Text**: no container, primary text, optional trailing arrow/icon.

Keep hover/pressed/disabled states within this same visual language.

## 3.8 Inputs and selects

Default field rules:

- height: `44px`;
- radius: `12px`;
- border: `1px solid #E2E8F0`;
- horizontal padding: `16px`;
- focus border/ring uses `#F97316` with accessible contrast;
- label and error text are separate from placeholder text;
- placeholders are muted and never used as the only label;
- validation errors appear inline and remain visible after blur/submit.

Use the same visual treatment for search fields, selects, text inputs, comboboxes, and admin forms unless a reference explicitly differs.

## 3.9 Badges, status, and progress

The design system includes badges such as `NEW`, `BESTSELLER`, `LIMITED`, `COD`, and `AR READY`.

Status indicators must distinguish at least:

- in stock / success;
- low stock / warning;
- sold out / error;
- active/playing;
- AR-ready/live;
- pending/processing/shipped/delivered/canceled for orders.

Do not communicate status by color alone. Include readable text or an icon.

Progress bars use the primary orange for the completed portion and a neutral track. Order progress steppers use explicit labels and timestamps/status text, not just connected circles.

## 3.10 Cards

The current design language contains:

- product cards;
- lookbook/editorial cards;
- video cards;
- resource/information cards;
- KPI/stat cards;
- table/list cards;
- order summary cards;
- configuration/settings cards.

Cards use white or very light warm surfaces, subtle borders, approved radius, and restrained shadow. Do not make every section a floating card if the reference uses open page space.

## 3.11 Navigation

Storefront navigation keeps the brand, categories/shop discovery, AR Try-On entry, delivery/help when needed, search, wishlist, account, and cart in a clear hierarchy.

Admin navigation is grouped by topic, not a single congested list. Follow these groups unless the user changes them:

- Overview: Dashboard, Analytics
- Catalog: Products, Categories, Inventory, Media
- Sales: Orders, Coupons/Promotions
- Customers: Customers, Reviews
- AR: AR Try-On / AR Assets
- Content: Promotions, Content Management
- Delivery: Couriers, Delivery Zones/Rates, Shipment Settings
- System: Staff/Roles & Permissions, Settings, Support

No emoji in admin navigation.

## 3.12 Product principles

Every UI decision should support the four principles shown in the design system:

- **Clarity First**: present information clearly and reduce cognitive load.
- **Consistency**: reuse established patterns.
- **Confidence & Trust**: make price, stock, delivery, order state, and privacy understandable.
- **Accessible by Default**: keyboard support, semantics, labels, contrast, focus states, reduced-motion respect, and device accessibility are required.

---

# 4. Reference page contracts

Treat each supplied screenshot as a page contract.

## 4.1 Homepage

The desktop reference contains, in order:

1. storefront header/navigation;
2. hero with fashion/AR value proposition and primary CTA plus Try in AR CTA;
3. short trust/value row;
4. category discovery rail;
5. featured/handpicked product grid with filters/tabs;
6. collection/editorial banner;
7. three-step AR explanation;
8. social proof/testimonials;
9. newsletter/offer signup;
10. footer.

On mobile, stack sections without changing the visual identity. Keep key actions reachable and avoid tiny horizontal replicas of desktop.

## 4.2 Product details

The reference defines:

- breadcrumbs;
- image gallery with thumbnail rail;
- product status/badge;
- title, rating summary, price, short description;
- selectable product/variant options;
- quantity control;
- Add to Cart and Buy Now;
- delivery/returns/security reassurance;
- a prominent Try It On in AR section;
- product specification table;
- description/shipping/returns/care accordions;
- related products.

Product selection must change the actual purchasable variant and its stock/price/media, not merely recolor the UI.

## 4.3 Product quick view

When a user clicks a product from a discovery surface, support a quick-view/modal experience where the task requests it. Preserve a canonical full product URL for direct navigation, sharing, refresh, and SEO.

If the installed Next.js version supports an appropriate route-interception pattern, verify the local docs before using it. Otherwise use an accessible dialog that links to the full product page.

The modal must never be the only way to reach product details.

## 4.4 Checkout

The reference defines a two-column desktop checkout with the order form on the left and a sticky order summary on the right.

The functional checkout must contain:

- contact information: full name, email, Nepal phone number;
- current-location action using browser permission;
- map/location preview when available;
- Nepal address fields;
- delivery/courier service selection;
- **Cash on Delivery only**;
- optional order notes;
- order summary with item quantities, discounts if applicable, delivery fee, and total;
- a clear Place Order action.

Nepal address fields must support at least:

- Province;
- District / Region;
- Municipality / City;
- Ward number;
- Street / Landmark;
- Postal code when available;
- latitude/longitude when the user grants location access.

Geolocation is assistance, not truth. The user must be able to review and edit the detected address before ordering.

Do not implement eSewa, Khalti, Fonepay, cards, Stripe, or any other online payment for the MVP.

## 4.5 Order confirmation and tracking

After checkout, show a dedicated confirmation/tracking experience matching the supplied reference language:

- order confirmation state;
- public order number;
- order date;
- payment method shown as Cash on Delivery;
- estimated delivery range;
- order progress stepper;
- shipment/tracking map only when legitimate location data exists;
- courier/service information;
- tracking number when assigned;
- delivery address snapshot;
- ordered item snapshot;
- totals;
- support action.

Never fabricate live courier coordinates. If a courier API does not provide live location, show event/status tracking instead of a fake moving vehicle.

## 4.6 Admin dashboard

The dashboard reference defines:

- topic-grouped sidebar;
- top search/quick-actions/profile area;
- date-range control;
- KPI cards;
- revenue overview chart;
- recent orders table;
- product/inventory management summary;
- quick settings/configuration cards.

Dashboard numbers must come from real persisted data or a clearly marked development seed dataset. Never hardcode impressive production numbers in live UI.

## 4.7 Add/Edit Product

Use the design system even though the supplied set does not show a final add/edit product screenshot.

The form should be sectioned, not one congested wall. Keep add and edit on the same data model and component structure. Expected sections:

- Basic information: name, slug, short description, full description, category, tags/status flags.
- Pricing: base price, compare-at price if used, tax/display notes if needed.
- Variants/options: SKU, option values, per-variant price, stock, active state.
- Media: ordered gallery, alt text, optional video/lookbook media.
- Inventory: stock quantity, low-stock threshold, availability.
- AR / Try-On: supported modes, placement type, 2D/3D assets, photo-try-on capability, live-camera capability, calibration metadata.
- Delivery: shippable status, package dimensions/weight if rates need them.
- SEO: title/description only when the project actually supports them.

Use progressive disclosure for advanced AR fields. A normal product should not require AR configuration.

## 4.8 Settings and delivery configuration

Settings must stay grouped by responsibility:

- Store profile and contact;
- Nepal store defaults: currency NPR, timezone Asia/Kathmandu, phone/country defaults;
- Checkout/COD settings;
- Delivery zones and rates;
- Courier providers and services;
- AR provider/settings;
- Staff and permissions;
- Feature flags/content settings;
- Support/contact links.

Do not put secrets directly in editable browser settings. API keys remain environment secrets.

## 4.9 Customer account area

There is no screenshot for this area yet. Build it from the Design System and the patterns already used by the Order Confirmation / Tracking and Admin Dashboard references: KPI/stat cards, table/list cards, order summary cards, and the order progress stepper.

Only a signed-in Clerk user can open it. Every query is scoped to that user's own `profiles` row, both in server code and in RLS.

The area includes:

- **Overview**: greeting, profile summary, and stat cards for total orders, orders in progress, and total billed to date.
- **Orders**: a paginated list of the customer's orders with status, date, item count, and total.
- **Order detail / tracking**: the same snapshot and shipment-event timeline as §4.5, for the customer's own orders only.
- **Tracking history**: shipment events across the customer's recent orders, newest first.
- **Wishlist**: saved products with current price and stock state, plus Add to Cart.
- **Addresses**: saved Nepal addresses (§11.6) with a default address that checkout prefills.
- **Reviews**: the customer's own reviews and their moderation status.
- **Billing summary**: total billed to date and a per-order breakdown.
- **Profile & security**: Clerk's `<UserProfile />` or equivalent, themed with our tokens. It covers name, email, phone, password, connected accounts, and sessions.

Billing rules:

- "Total billed to date" is the sum of `total_paisa` for the customer's orders with `payment_status = 'collected'`.
- Pending COD amounts (orders not yet delivered or collected) are shown separately and never added to the billed total.
- Canceled and refunded orders are excluded. They may be listed for transparency.
- Totals are calculated in the database or on the server in integer paisa, never in the browser. Display them with `formatNpr`.

Keep the account navigation grouped and extensible so future features (loyalty, notifications, returns, saved try-on results) can be added without rebuilding it. Each section needs empty, loading, and error states.

---

# 5. Tech stack: use this

Use the existing package versions in the repository. Do not upgrade core packages casually during a feature task.

| Layer | Choice |
|---|---|
| Framework | Next.js with App Router |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS using the Goreto.store tokens |
| Database | Supabase Postgres |
| Auth | Clerk (`@clerk/nextjs`) for customers, owner, and staff |
| Row authorization | Supabase/Postgres RLS on the Clerk session token (Supabase third-party auth with Clerk) |
| Auth UI | Clerk prebuilt components themed with Goreto tokens; custom flows only when a reference requires them |
| File/media storage | Supabase Storage |
| Server data access | Server-side Supabase client and SQL/RPC where appropriate |
| Client data/state | React state + URL state + a small shared store only where justified |
| Shared cart state | Zustand with persistence if no existing equivalent exists |
| Forms | React Hook Form + Zod for complex forms, using Server Actions/route handlers for trusted mutations |
| Validation | Zod at all untrusted application boundaries plus database constraints |
| Icons | Phosphor Icons, or the existing single project icon library if already established |
| Search | PostgreSQL full-text search + `pg_trgm` ranking through Supabase |
| Charts | Recharts or the project's existing chart library |
| Live AR landmarks | Browser media APIs + `@mediapipe/tasks-vision` when live landmark anchoring is required |
| 2D try-on rendering | Canvas/CSS/WebGL overlay, depending on asset type |
| 3D rendering | `three` only when a product truly uses a 3D asset |
| Photo/generative try-on | Provider adapter behind a server route; provider chosen/configured through environment |
| Testing | Vitest + React Testing Library; Playwright for end-to-end |
| Formatting/lint | ESLint + Prettier if present/approved in the repository |
| Package manager | Keep the existing lockfile/package manager; for a true greenfield repo, prefer pnpm |

## 5.1 Skills to lean on

Use installed project skills rather than guessing. Verify a skill path exists before reading or citing it.

Priority knowledge areas are:

- Next.js App Router, Server Components, Client Components, Server Actions, route handlers, caching, metadata, and image/font behavior;
- Clerk + Next.js: `ClerkProvider`, `clerkMiddleware` in `proxy.ts`, `await auth()`, `<Show>`, prebuilt components, appearance theming, webhooks, and `@clerk/testing`;
- Supabase third-party auth with Clerk, Postgres schema design, RLS, Storage policies, generated TypeScript types, and local migrations;
- PostgreSQL transactions/RPC for atomic checkout/inventory updates;
- Tailwind token-based implementation and pixel-faithful screenshot reproduction;
- browser Camera/Geolocation permission handling;
- MediaPipe landmarks and safe AR overlay behavior;
- Playwright for critical user journeys.

If the repo contains specific Next.js, Supabase, testing, or UI skills, read their `SKILL.md` files before implementation.

For auth work, the installed Clerk skills are in `.claude/skills/` (mirrored in `.agents/skills/`):

- `clerk` (router);
- `clerk-setup`;
- `clerk-nextjs-patterns`;
- `clerk-custom-ui`;
- `clerk-webhooks`;
- `clerk-testing`;
- `clerk-cli`;
- `clerk-backend-api`.

Use the `clerk` CLI (`clerk doctor`, `clerk env pull`, `clerk api`) instead of guessing Dashboard steps.

---

# 6. Tech stack: do not use this unless the user changes the decision

Do **not** add competing infrastructure without a concrete requirement.

- No Firebase.
- No Supabase Auth, Auth0, NextAuth/Auth.js, or custom auth alongside Clerk. Supabase is used for data, RLS, and Storage only.
- No `@clerk/clerk-react` in the Next.js app; use `@clerk/nextjs`.
- No Clerk Organizations for store staff. This is a single store, and staff roles and permissions live in Postgres.
- No client-side `CLERK_SECRET_KEY`.
- No Prisma or Drizzle by default; use Supabase SQL migrations and generated database types unless the project already chose an ORM.
- No separate Express, NestJS, FastAPI, Laravel, or other backend framework for the MVP.
- No GraphQL layer.
- No Redux by default.
- No Algolia or Elasticsearch for the first product search implementation.
- No Stripe, eSewa, Khalti, Fonepay, card gateway, wallet integration, or online payment flow in the MVP.
- No fake courier GPS feed.
- No public bucket for customer try-on photos.
- No client-side `SUPABASE_SERVICE_ROLE_KEY`.
- No client-side staff-role trust.
- No product prices calculated only in the browser.
- No inventory deduction only in the browser.
- No arbitrary UI kit restyle that conflicts with the supplied design system.
- No second icon library just for convenience.
- No hardcoded Nepal address dropdowns copied from an unverified snippet when a canonical project dataset already exists.

---

# 7. Routing structure

Use App Router route groups to keep customer, auth, account, and admin responsibilities clear. Exact filenames must follow the installed Next.js documentation.

A target shape is:

```text
src/app/
  (store)/
    page.tsx                         # Home
    products/[slug]/page.tsx        # Canonical product details
    categories/[slug]/page.tsx
    search/page.tsx
    cart/page.tsx
    checkout/page.tsx
    order-confirmation/[orderNumber]/page.tsx
    track/[orderNumber]/page.tsx
    try-on/page.tsx                  # Optional dedicated AR hub

  (auth)/
    sign-in/[[...sign-in]]/page.tsx  # Clerk <SignIn /> (handles reset + OAuth callbacks)
    sign-up/[[...sign-up]]/page.tsx  # Clerk <SignUp />

  (account)/                         # Signed-in customers only (§4.9)
    account/layout.tsx               # Grouped account navigation
    account/page.tsx                 # Overview + stat cards
    account/orders/page.tsx
    account/orders/[orderNumber]/page.tsx   # Detail + tracking timeline
    account/tracking/page.tsx        # Tracking history across orders
    account/wishlist/page.tsx
    account/addresses/page.tsx
    account/reviews/page.tsx
    account/billing/page.tsx         # Total billed to date + breakdown
    account/profile/[[...rest]]/page.tsx    # Clerk <UserProfile />

  (admin)/
    admin/layout.tsx
    admin/page.tsx
    admin/analytics/page.tsx
    admin/products/page.tsx
    admin/products/new/page.tsx
    admin/products/[id]/edit/page.tsx
    admin/categories/page.tsx
    admin/inventory/page.tsx
    admin/media/page.tsx
    admin/orders/page.tsx
    admin/orders/[id]/page.tsx
    admin/customers/page.tsx
    admin/reviews/page.tsx
    admin/promotions/page.tsx
    admin/ar/page.tsx
    admin/delivery/couriers/page.tsx
    admin/delivery/zones/page.tsx
    admin/delivery/rates/page.tsx
    admin/staff/page.tsx
    admin/settings/page.tsx

  api/
    ar/photo/route.ts                # Start/check photo try-on job as needed
    geocode/reverse/route.ts         # Provider adapter; rate-limited
    courier/webhooks/[provider]/route.ts
    webhooks/clerk/route.ts          # Verified Clerk user sync -> profiles

src/proxy.ts                         # clerkMiddleware (Next 16 renamed middleware -> proxy)
```

`src/proxy.ts` is **public-first**. It calls `auth.protect()` for `/account(.*)` and `/admin(.*)`. Storefront, search, product, cart, checkout (guest), tracking, and try-on routes stay public. Its matcher must include `'/(api|trpc)(.*)'` followed once by `'/__clerk/:path*'`. Proxy protection is authentication only. Owner/staff authorization is enforced again in server code and RLS.

Do not create API routes for simple reads that Server Components can do directly.

Prefer Server Actions for trusted first-party form mutations when appropriate. Prefer route handlers for webhooks, long-running/async provider integrations, binary/file workflows, external callbacks, and endpoints intentionally called outside the rendered Next.js tree.

---

# 8. State management and data-flow rules

Use the smallest correct state tool for each kind of state.

| State type | Source of truth | Rule |
|---|---|---|
| Products, categories, orders, stock, delivery config | Supabase/Postgres | Read server-side by default |
| Auth/session | Clerk session | `await auth()` / `currentUser()` on the server for protected work; `useAuth()`/`useUser()`/`<Show>` only for client UI |
| Search/filter/sort/pagination | URL search params | Shareable and refresh-safe |
| Local UI state | React component state | Dialogs, tabs, temporary control state |
| Forms | React Hook Form + Zod | Complex checkout/admin forms |
| Cart | Small Zustand store persisted locally; optionally merge with account later | Never treat local totals as trusted checkout totals |
| Wishlist | Supabase for signed-in Clerk users; optional local optimistic state | RLS-protected |
| Account billing totals | Server/database aggregate over the customer's orders | Never summed in the browser |
| Checkout total | Server/database calculation | Browser display is preview only |
| Inventory | Database | Must be checked/decremented atomically |
| AR live session | Client-only state | Camera frames must not enter global app state |
| Photo try-on job | Supabase row + private storage + provider status | Async and user-scoped |
| Order tracking | Shipment/order events in database | Never synthesize fake progress |

Do not fetch everything with client-side effects. Prefer Server Components for initial server data and use client components only where interaction requires them.

Do not introduce React Query/TanStack Query unless there is a demonstrated need for client-side server-state synchronization that Server Components and targeted revalidation cannot handle.

---

# 9. Authentication and authorization

Authentication is **Clerk** for every user type: customers, the owner, and staff. Clerk owns identity: sign-up, sign-in, passwords, OAuth, email/phone verification, and sessions. Supabase Postgres owns roles, permissions, and all business data, and enforces them with RLS on the Clerk session token.

## 9.1 Shopper behavior

Browsing, product viewing, search, cart, and virtual try-on can be public.

Checkout supports **guest checkout** by default. A customer account is optional. When signed in, known contact and default-address data are prefilled.

A guest order has a nullable `user_id` plus immutable contact/address snapshots. A signed-in order also references the customer's `profiles.id`.

A customer who signs up later may claim earlier guest orders only through a trusted server path. The email must be verified by Clerk and must match the order's contact email. Never attach orders based on unverified input.

Customer-facing account features are defined in §4.9.

## 9.2 Owner and staff

Every Clerk user gets a `profiles` row with role `customer` by default.

The initial store owner is bootstrapped by a trusted migration or server-only script that sets `role = 'owner'` for a specific Clerk user id. Never let the browser self-assign `owner` or `staff`.

Future staff members are invited by the owner through a server-only administrative path. That path uses a Clerk invitation from the Backend API with `CLERK_SECRET_KEY`, then the `staff` role and permission rows in Postgres once the invited user exists.

The role and permissions in Postgres are the authority. The server may mirror `role` into Clerk `publicMetadata` for fast UI or proxy hints. Only server code may write it, and sensitive actions still check the database. Never read roles from `unsafeMetadata`, which users can edit.

Suggested roles:

- `customer`
- `owner`
- `staff`

Owner has full store access. Staff access is permission-based.

Suggested permission keys:

- `analytics.read`
- `catalog.read`
- `catalog.write`
- `inventory.write`
- `orders.read`
- `orders.write`
- `customers.read`
- `reviews.manage`
- `promotions.manage`
- `content.manage`
- `ar.manage`
- `delivery.manage`
- `settings.manage`
- `staff.manage`

Do not rely on hidden buttons for security. Enforce authorization in RLS and again in sensitive server actions/routes.

## 9.3 Clerk + Next.js rules

- Use `@clerk/nextjs`. Server code imports from `@clerk/nextjs/server`.
- `auth()` is async. Always `await auth()`.
- `ClerkProvider` goes inside `<body>` in the root layout, not around `<html>`.
- `clerkMiddleware` lives in `src/proxy.ts`. Next 16 renamed `middleware` to `proxy`; confirm against the local Next docs. Its matcher must include `'/__clerk/:path*'` after `'/(api|trpc)(.*)'`.
- `auth.protect()` in the proxy is authentication only. Server Actions and route handlers must re-check the session and database permissions themselves.
- Use `<Show when="signed-in" | "signed-out">` (Core 3) for auth-dependent UI. Do not use `<Show>` for authorization.
- In-page sign-in/sign-up triggers open Clerk **modals** (`SignInButton` / `SignUpButton` with `mode="modal"`) so shoppers stay on the page. The `/sign-in` and `/sign-up` pages exist only as fallbacks for protected-route redirects, direct links, and Clerk return flows. Do not link to them from in-page UI.
- Theme Clerk components through `appearance` using the Goreto tokens: orange primary, Inter, 12px radius, neutral borders. Keep the theme in one module and do not restyle Clerk with ad-hoc CSS overrides.
- `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SIGNING_SECRET` are server-only. Never expose the Supabase service-role key to a browser bundle.
- Do not read or print `.env*` files. Use `clerk env pull` to refresh keys.

## 9.4 Clerk ↔ Supabase

- Configure Clerk as a **Supabase third-party auth provider**: the Supabase Dashboard or `supabase/config.toml` `[auth.third_party.clerk]`, plus the Clerk Supabase integration so session tokens carry `role: authenticated`. No JWT templates and no shared JWT secret.
- Supabase clients pass the Clerk session token through the `accessToken` option:
  - on the server, `accessToken: async () => (await auth()).getToken()`;
  - in the browser, the `useSession()` token.
- Do not use `@supabase/ssr` cookie sessions, because Supabase is not the auth provider.
- In RLS, the Clerk user id is `auth.jwt()->>'sub'`. It is **text** (`user_…`), not a UUID, so never compare it to `auth.uid()`.
- Sync `profiles` from a verified Clerk webhook (`user.created`, `user.updated`, `user.deleted`) at `api/webhooks/clerk`. Verify it with `verifyWebhook` and make it idempotent. Also lazily upsert the profile on the first authenticated server request, so a delayed webhook never blocks a new customer.
- On `user.deleted`, detach or anonymize the profile. Keep order snapshots for accounting.

---

# 10. Architectural boundaries and responsibilities

Keep these responsibilities separate.

## 10.1 Storefront presentation

Pages render products, categories, discovery content, cart/checkout UI, and tracking UI. They do not own business-critical calculations.

## 10.2 Server-side commerce logic

Trusted server code owns:

- product/variant availability checks;
- coupon validation;
- delivery-rate selection/recalculation;
- final totals;
- order creation;
- atomic inventory changes;
- tracking-token issuance;
- staff actions;
- provider secrets.

## 10.3 Supabase/Postgres

The database is the durable source of truth for catalog, customer/account state, orders, stock, staff permissions, delivery configuration, and tracking events.

Use constraints, foreign keys, unique indexes, check constraints, and RLS rather than moving all integrity rules into TypeScript.

## 10.4 Supabase Storage

Use separate logical storage concerns:

- product/media assets: readable by the storefront as configured, owner/staff write only;
- AR assets: product-related, owner/staff write only;
- customer try-on uploads: **private**, user/job scoped, short retention;
- generated try-on outputs: private or signed-access only.

## 10.5 AR subsystem

The AR UI is a client feature, but provider secrets and long-running generation stay server-side.

Live try-on and uploaded-photo try-on are different capabilities and must not be conflated.

## 10.6 Delivery subsystem

Customer location capture, address validation, delivery-rate matching, courier assignment, shipment tracking, and courier integrations are a dedicated domain. Do not scatter delivery logic across checkout components.

## 10.7 Admin

The admin UI calls trusted server operations and respects role/permission boundaries. It never uses a privileged key directly in a client component.

## 10.8 Customer account

The account area (§4.9) is mostly server-rendered. It reads through the user-context Supabase client, which carries the Clerk token, so RLS scopes every row to the signed-in customer. It never uses the service-role key to read customer data. Account aggregates such as billed totals and order counts come from SQL, not client-side sums.

---

# 11. Data model decisions

Use UUID primary keys unless the existing project has another established convention. Use `created_at` / `updated_at` timestamps consistently. Store timestamps in UTC and display user-facing Nepal times using `Asia/Kathmandu`.

Generate TypeScript database types from Supabase after schema changes. Do not hand-maintain a parallel copy of database row types.

## 11.1 Profiles and staff

### `profiles`

- `id` uuid primary key (internal; all user-owned tables reference this)
- `clerk_user_id` text, unique, not null (the Clerk `sub`, e.g. `user_…`)
- `full_name`
- `email`
- `phone_e164`
- `role`: `customer | owner | staff`, default `customer`
- `deleted_at` nullable, set when the Clerk user is deleted
- timestamps

`profiles` is written by the Clerk webhook and the server-side lazy upsert. Users cannot change `role` through any user-context path; enforce this with a column-level grant or policy, not only with application code.

Every `user_id` column elsewhere in this document (`orders`, `wishlist_items`, `reviews`, `customer_addresses`, `try_on_jobs`) is a foreign key to `profiles.id`. RLS resolves the current profile with a helper such as `current_profile_id()`. The helper maps `auth.jwt()->>'sub'` to `profiles.clerk_user_id`, is `security definer` with a fixed `search_path`, and is stable.

### `staff_permissions`

- `profile_id`
- `permission_key`
- unique `(profile_id, permission_key)`

Only owner/trusted server operations may change staff permissions.

## 11.2 Catalog

### `categories`

- `id`
- `parent_id` nullable
- `title`
- `slug` unique
- `description`
- `sort_order`
- `is_active`

### `products`

- `id`
- `category_id`
- `title`
- `slug` unique
- `short_description`
- `description`
- `base_price_paisa`
- `status`: `draft | active | archived`
- `is_featured`
- `is_bestseller`
- `low_stock_threshold`
- searchable text fields / generated search vector as appropriate
- timestamps

Money is stored as integer **paisa** (`NPR 2,499.00` -> `249900`) or an existing equivalent integer-minor-unit convention. Never use JavaScript floating-point values as authoritative money.

### `product_variants`

- `id`
- `product_id`
- `sku` unique
- `option_values` JSONB for small flexible option sets
- optional `price_paisa` override
- `stock_quantity`
- `is_active`
- optional physical weight/dimension fields when needed by delivery rating

### `product_media`

- `id`
- `product_id`
- `variant_id` nullable
- `kind`: `image | video`
- `storage_path`
- `alt_text`
- `sort_order`

## 11.3 AR product data

### `product_ar_assets`

- `id`
- `product_id`
- `variant_id` nullable
- `mode`: `live_2d | live_3d | photo_ai`
- `placement`: `ear | face | neck | wrist | hand | upper_body | full_body | freeform`
- `asset_path`
- `asset_format`
- `calibration` JSONB containing only documented transform/anchor metadata
- `is_active`

A product is shown as `AR READY` only when the required active asset/config exists for at least one supported try-on mode.

### `try_on_jobs`

For uploaded-photo/generative workflows:

- `id`
- `user_id` nullable when a secure anonymous job model is intentionally supported
- `product_id`
- `variant_id` nullable
- `input_storage_path`
- `output_storage_path` nullable
- `provider`
- `provider_job_id` nullable
- `status`: `queued | processing | completed | failed | expired`
- `error_code` nullable
- timestamps / expiry

Customer input photos are private and should be deleted automatically after a short retention window, defaulting to **24 hours** unless the user explicitly changes the policy.

## 11.4 Wishlist and reviews

### `wishlist_items`

- `user_id`
- `product_id`
- unique `(user_id, product_id)`

### `reviews`

- `id`
- `user_id`
- `product_id`
- optional `order_item_id` for verified purchase
- `rating`
- `body`
- `status`: `pending | published | rejected`
- timestamps

## 11.5 Promotions

### `coupons`

- `id`
- `code` unique and normalized
- `type`: `fixed | percentage`
- value in safe integer/percentage form
- min order / max discount if used
- start/end timestamps
- usage limits
- active flag

Coupon eligibility and discount are recalculated server-side at order placement.

## 11.6 Nepal addresses

### `customer_addresses`

- `id`
- `user_id`
- `label`
- `recipient_name`
- `phone_e164`
- `province`
- `district`
- `municipality`
- `ward`
- `street_landmark`
- `postal_code` nullable
- `latitude` nullable
- `longitude` nullable
- `is_default`

Use a canonical Nepal administrative dataset in the project for cascading Province -> District -> Municipality selection. Reverse geocoding may prefill fields, but canonical address selection and user confirmation win over geocoder guesses.

## 11.7 Delivery and couriers

### `couriers`

- `id`
- `name`
- `slug`
- `logo_path` nullable
- `support_phone` nullable
- `website_url` nullable
- `integration_mode`: `manual | api`
- `is_active`

Do not store provider secret keys in this table.

### `courier_services`

- `id`
- `courier_id`
- `name`
- `service_code`
- `service_level`: `standard | express | pickup`
- `estimated_min_days`
- `estimated_max_days`
- `is_active`

### `delivery_zones`

- `id`
- `name`
- geographic match criteria using Province/District/Municipality identifiers
- `is_active`

### `delivery_rates`

- `id`
- `zone_id`
- `courier_service_id`
- `price_paisa`
- optional min/max weight or order-value conditions
- `is_active`

Checkout shows only services that match the confirmed address and current configuration.

The shopper may select from available services. Admin may later assign or override the physical courier when fulfillment requires it, but the order must preserve the customer's purchased delivery-service snapshot.

## 11.8 Orders

### `orders`

- `id`
- `order_number` unique, non-sequential/public-safe
- `user_id` nullable for guest checkout
- contact snapshot: name/email/phone
- address snapshot JSONB or normalized immutable snapshot fields
- `status`: `pending_confirmation | confirmed | processing | packed | shipped | delivered | canceled`
- `payment_method`: currently `cod` only
- `payment_status`: `pending | collected | failed | refunded`
- `currency`: `NPR`
- subtotal/discount/delivery/total in paisa
- selected delivery/courier-service snapshot
- optional coupon snapshot/code
- customer note
- hashed guest tracking secret when guest tracking is enabled
- timestamps

### `order_items`

Snapshot what was purchased. Do not render historical orders from mutable current product values.

Store at least:

- `order_id`
- `product_id` nullable-safe reference
- `variant_id` nullable-safe reference
- title/SKU/variant text snapshot
- image snapshot/path
- unit price paisa
- quantity
- line total paisa

### `shipments`

- `order_id`
- `courier_id` nullable until assigned
- `courier_service_id` nullable
- `tracking_number` nullable
- `status`: `awaiting_assignment | assigned | picked_up | in_transit | out_for_delivery | delivered | exception | returned`
- estimated delivery dates
- timestamps

### `shipment_events`

Append-only shipment history:

- `shipment_id`
- `status`
- user-facing message
- event timestamp
- latitude/longitude only when supplied by a legitimate source
- provider payload reference/metadata when needed for auditing

Never overwrite history merely to show the latest status.

## 11.9 Store settings

Use a singleton/config model for non-secret application settings such as store contact details, support links, COD enablement, feature flags, and display defaults.

Secrets stay in environment variables or the deployment secret manager.

---

# 12. Checkout transaction rules

Order creation must be atomic.

Prefer a Postgres function/RPC such as `place_order` that runs the trusted final checkout logic in one transaction:

1. validate product/variant status;
2. lock/check stock;
3. validate quantity;
4. resolve current prices from the database;
5. validate coupon server-side;
6. resolve the selected delivery service/rate against the confirmed Nepal address;
7. calculate subtotal, discount, delivery fee, and total in integer paisa;
8. create the order and item snapshots;
9. decrement stock atomically;
10. create the initial shipment/tracking event;
11. return only the safe confirmation payload.

Do not trust cart totals, discount amounts, delivery fees, or product prices submitted by the browser.

Handle concurrent stock purchases correctly. If stock changed, fail with a clear recoverable error and refresh the affected cart line.

---

# 13. Product search

Use Supabase/Postgres search before introducing an external search service.

Search should combine:

- exact title match;
- prefix/title token relevance;
- PostgreSQL full-text search over approved searchable fields;
- `pg_trgm` similarity for typo tolerance when enabled;
- optional category/tag filters;
- only active, storefront-visible products.

Ranking should prioritize exact/specific title relevance over broad description hits.

Search/filter/sort state belongs in the URL so results are shareable and refresh-safe.

Autocomplete, if implemented, is a lightweight suggestion surface and does not replace the full search results page.

Validate and parameterize all search input. Do not concatenate raw user text into SQL.

---

# 14. Virtual try-on / AR behavior

The AR feature must be capability-based. Do not pretend every product supports the same technique.

## 14.1 Live camera try-on

For products such as earrings, necklaces, glasses, bracelets, or other anchorable accessories:

- request camera permission only after a clear user action;
- require HTTPS outside localhost;
- dynamically load heavy vision libraries only when entering try-on;
- use the product's configured placement mode;
- use MediaPipe landmarks only when that mode requires landmarks;
- render the configured 2D or 3D asset anchored to the detected body/face/hand point;
- provide calibration controls only where useful;
- stop media tracks immediately when the user exits;
- do not record or upload live camera frames by default.

For garments, a simple landmark overlay may be offered only if it produces an explicitly labeled preview. Do not market a crude overlay as photorealistic try-on.

## 14.2 Uploaded-photo try-on

Generative garment try-on is a separate, asynchronous path.

Flow:

1. user chooses an AR-capable product/variant;
2. user uploads a supported photo to a **private** Supabase Storage path using a secure upload flow;
3. server validates MIME type, dimensions/size, ownership/job token, and product capability;
4. server starts the configured provider job using a provider adapter;
5. status is stored in `try_on_jobs`;
6. UI polls or subscribes to job state without exposing provider secrets;
7. output is stored privately and shown using signed access;
8. input/output files expire according to retention policy.

If no provider is configured, show the feature as unavailable in the environment. Do not generate a fake successful result.

## 14.3 3D assets

Use 3D only when a real 3D asset exists. Do not add `three` to every storefront page.

Lazy-load 3D code and assets inside the AR surface. Keep standard product browsing fast.

## 14.4 Privacy and safety

Customer photos are sensitive user-generated media even when not legally classified as a special category.

- private bucket only;
- minimal retention;
- signed URLs;
- no indexing;
- no analytics payload containing the image;
- no public object URL;
- clear delete/expiry behavior;
- no model-training claim unless the selected provider contract explicitly allows and the user has approved it.

---

# 15. Nepal-specific behavior

## 15.1 Currency

Default currency is **NPR** and UI uses `Rs.` formatting consistent with the references.

Calculate using integer paisa. Format at display time.

## 15.2 Timezone

Store timestamps in UTC. Display customer/admin-facing local times in **Asia/Kathmandu** unless the user is intentionally viewing another timezone.

## 15.3 Phone numbers

Normalize Nepal mobile/customer numbers to E.164 (`+977...`) on write. Display a user-friendly Nepal format.

Do not duplicate the country code if the field UI already supplies `+977`.

Use a phone-number library if one is already in the project or add a lightweight well-maintained validator when needed. Do not validate only with a fragile ad-hoc regex.

## 15.4 Geolocation

Browser geolocation:

- only runs after user action;
- can be denied or inaccurate;
- requires secure context in production;
- returns coordinates, not a trusted postal address.

Reverse geocoding must go through a provider adapter/server route if provider terms, rate limits, or keys require it.

Do not hammer a free public geocoder from every keystroke or expose a secret key in the client.

## 15.5 Nepal administrative address data

Use stable internal identifiers for Province/District/Municipality values when a canonical dataset is available. Display names may change independently of relational keys.

Do not infer a ward from GPS unless the data source can actually support that precision. The user must be able to choose/correct it.

---

# 16. Supabase RLS and security rules

RLS is mandatory on user/business tables exposed through Supabase APIs.

Identity in policies comes from the Clerk session token, via Supabase third-party auth (§9.4):

- "the signed-in user" means the profile whose `clerk_user_id = auth.jwt()->>'sub'`;
- signed-in requests carry the Postgres role `authenticated`;
- guests are `anon`;
- never use `auth.uid()`.

Minimum policy intent:

- active products/categories: public read;
- draft/archived catalog: owner or permitted staff read;
- catalog writes: owner or `catalog.write` staff;
- inventory writes: owner or `inventory.write` staff;
- customer profile/address/wishlist: only the signed-in user's own profile; `role` is not user-writable;
- reviews: user can create/read permitted rows; moderation by authorized staff;
- orders, order items, shipments, shipment events: a signed-in customer can read their own orders only; staff according to permissions;
- account aggregates (billed total, order counts): computed by a function/view that respects the same ownership rule;
- guest tracking: access through a safe server/RPC path using an opaque tracking secret, not a blanket public order policy;
- staff permissions: owner-managed only;
- delivery configuration writes: owner or `delivery.manage` staff;
- try-on jobs: owner of the job or safe anonymous job token path; admin access only when genuinely required;
- private storage objects: policies mirror ownership/job authorization.

Where helper SQL functions are used for permission checks, lock down `search_path` and avoid accidental privilege escalation.

Do not use the service-role key to bypass RLS for ordinary user requests. Use it only for narrowly scoped trusted administrative/provider workflows where user-context RLS cannot perform the operation.

---

# 17. Environment and configuration

Maintain separate environments:

- local development;
- preview/staging;
- production.

Use separate Supabase projects/databases for staging and production when deployment reaches that stage. Never test destructive migrations against production data first.

Commit a `.env.example` containing **names only**, never live secrets.

Recommended variables, adjusted to the actual project:

```env
# Clerk (written by `clerk init` / `clerk env pull`)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Public Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only Supabase
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_SITE_URL=
STORE_TIMEZONE=Asia/Kathmandu
STORE_CURRENCY=NPR

# Optional AR provider
AR_PROVIDER=
AR_API_KEY=
AR_WEBHOOK_SECRET=

# Optional geocoding provider
GEOCODING_PROVIDER=
GEOCODING_API_KEY=

# Optional courier integrations
COURIER_<PROVIDER>_API_KEY=
COURIER_<PROVIDER>_WEBHOOK_SECRET=
```

If a provider uses a public browser token by design, name it `NEXT_PUBLIC_*` only after confirming the provider considers it public and it is restricted appropriately.

Do not invent credentials or commit `.env.local`.

---

# 18. API and platform quirks to remember

## 18.1 Next.js boundaries

- Verify installed Next.js docs before using remembered `middleware`, `proxy`, cookies, cache, route-handler, metadata, or Server Action patterns.
- Do not import server-only modules into client components.
- Keep provider SDKs that require Node APIs in a Node runtime route, not Edge by accident.
- Use dynamic import for camera/vision/3D client dependencies.

## 18.2 Clerk sessions and Supabase tokens

- Clerk manages session cookies and refresh. Do not write Supabase session cookies or add `@supabase/ssr` auth refresh logic.
- Get a fresh Clerk token for each Supabase client or request (`getToken()`). Do not cache or persist tokens; they are short-lived.
- Pages that call `auth()` are dynamic. Do not cache user-specific data in shared caches. Key any per-user caching by the Clerk user id (see `clerk-nextjs-patterns` → caching).
- Clerk SDK APIs change between major versions (Core 2 → Core 3). Check the installed `@clerk/nextjs` version and skill notes before using remembered components or props.

## 18.3 Storage uploads

Large product media and try-on photos should upload directly to Supabase Storage using an authorized/signed flow when appropriate. Do not funnel large raw images through a Server Action merely for convenience.

The server should receive storage object identifiers and metadata, not trust arbitrary client-supplied public URLs.

## 18.4 Image validation

Validate MIME type, actual file signature where feasible, maximum byte size, dimensions, and allowed formats.

Never trust only the file extension.

Strip or normalize metadata where the chosen processing pipeline supports it, especially for customer photos.

## 18.5 Long-running AR jobs

Do not hold an HTTP request open for a slow provider if the provider is asynchronous. Persist a job row, return the job id, and let the UI observe status.

Make webhooks idempotent. Store provider event ids when the provider exposes them.

## 18.6 Webhooks

Courier, AR provider, and Clerk webhooks must:

- verify signatures/secrets;
- be idempotent;
- validate event shape;
- map provider states into internal enums;
- log safe diagnostics without leaking secrets or private photos.

Clerk webhooks are verified with `verifyWebhook` from `@clerk/nextjs/webhooks` using `CLERK_WEBHOOK_SIGNING_SECRET`. The route must be public in `proxy.ts`. Use `clerk` CLI local webhook testing during development.

## 18.7 Revalidation/cache

After admin mutations, revalidate only the affected storefront/admin paths or tags. Do not globally disable caching because one page needs fresh stock.

Stock and checkout validation must still be database-truth regardless of rendered cache.

## 18.8 Location/camera permissions

Permission denied is a normal application state, not an exception page. Always provide manual address and photo-upload fallbacks where relevant.

---

# 19. Component and code organization

Prefer feature/domain organization over one giant components directory.

A target shape is:

```text
src/
  app/
  components/
    ui/                 # design-system primitives
    store/              # storefront compositions
    admin/              # admin compositions
    ar/                 # AR-specific client UI
    delivery/           # address, rate, tracking UI
  features/
    auth/
    catalog/
    cart/
    checkout/
    orders/
    delivery/
    search/
    ar/
    admin/
  lib/
    supabase/
      client.ts
      server.ts          # passes the Clerk session token via `accessToken`
      admin.ts           # server-only, rare privileged use
    auth/                # Clerk helpers: requireProfile(), requirePermission(), appearance theme
    money/
    validation/
    search/
    delivery/
    ar/
  data/
    nepal/               # canonical address data if kept in source
  types/
    database.ts          # generated from Supabase
  styles/

supabase/
  migrations/
  seed.sql               # development-only seed when used

prompts/
tests/
```

Do not turn every server helper into a generic `utils.ts`. Domain names should reveal responsibility.

---

# 20. TypeScript rules

Use strict TypeScript.

- `strict: true`.
- Avoid `any`. Use `unknown` plus validation/narrowing for untrusted values.
- Do not use `@ts-ignore` to silence real errors.
- Prefer discriminated unions for order/shipment/job states.
- Derive database row types from generated Supabase types.
- Use Zod schemas for external/API/form boundaries, then infer application input types from the schema when appropriate.
- Keep money types explicit; do not casually mix rupees and paisa.
- Keep ids semantically named (`productId`, `orderId`) even when all are strings.
- Use exhaustive checks when mapping provider status to internal status.
- Do not expose entire database row types to client components when a smaller view model is enough.

---

# 21. Linting and formatting

Inspect the existing config first. Do not replace a working lint setup during unrelated work.

Expected baseline:

- ESLint with Next.js and TypeScript rules;
- React hooks rules;
- no unused imports/variables except intentional underscore conventions configured by the project;
- no floating/unhandled promises where the lint stack can detect them;
- no unsafe `any` introduced in new code;
- Prettier for consistent formatting when the project uses it;
- Tailwind class ordering plugin only if compatible with the installed Tailwind/Prettier setup.

Do not disable a lint rule globally just to make one task pass. Fix the code or document a narrow, justified suppression.

---

# 22. Accessibility and interaction rules

Accessibility is part of acceptance criteria.

- All actions are keyboard reachable.
- Dialogs trap focus and return focus on close.
- Icon-only buttons have accessible names.
- Form controls have labels and errors wired with semantic attributes.
- Color is not the only state signal.
- Images have meaningful alt text; decorative images use empty alt.
- Product thumbnails and variant swatches expose selected state.
- Motion respects `prefers-reduced-motion`.
- Camera/AR surfaces provide clear permission, loading, unavailable, and exit states.
- Touch targets should generally meet the 44px control system shown in the design reference.

---

# 23. Tests

Test behavior at the right level.

## 23.1 Unit tests

Use Vitest for pure business logic such as:

- money formatting/calculation helpers;
- coupon rules;
- delivery-zone matching;
- search-ranking helpers;
- provider-status mapping;
- AR capability guards;
- validation schemas.

## 23.2 Component tests

Use React Testing Library for interaction-heavy components where browser-level E2E would be unnecessarily slow, such as:

- quantity controls;
- variant selectors;
- address-field cascading behavior;
- delivery-service selection;
- product form sections;
- permission-dependent admin controls.

## 23.3 Database/RLS integration tests

When schema or policies change, verify at least:

- public shopper access;
- customer isolation;
- guest order/tracking boundary;
- owner full access;
- staff permitted action;
- staff denied action without permission;
- private try-on file/job ownership;
- catalog write restrictions;
- a customer cannot change their own `role`;
- account billing aggregates only include the caller's own orders.

Simulate signed-in users with Clerk-shaped JWT claims (`sub`, `role: authenticated`) against the local Supabase instance. Do not hit production Clerk from tests.

Use the local Supabase environment when available. Do not test authorization only by checking whether a button is hidden.

## 23.4 End-to-end tests

Use Playwright for critical journeys:

1. Browse -> search -> product detail.
2. Product quick view -> canonical detail.
3. Variant selection -> add to cart.
4. Guest checkout -> Nepal address -> available delivery service -> COD order.
5. Order confirmation -> tracking page.
6. Customer sign-up/sign-in (Clerk) -> account overview -> own orders, wishlist, and billed total only.
7. Owner/staff sign-in -> product create/edit -> storefront update.
8. Inventory prevents oversell/concurrent invalid quantity.
9. Courier assignment/status event -> tracking update.
10. AR camera permission denied -> graceful fallback.
11. AR photo upload -> job success/failure/expiry using a mocked provider in automated tests.

Use `@clerk/testing` (`clerkSetup`, testing tokens, `clerk.signIn`) for authenticated Playwright journeys with dedicated test users; see the `clerk-testing` skill.

Do not call a paid external AR/courier provider in normal CI.

---

# 24. Build and verification commands

Always inspect `package.json` and the repository lockfile first, then run the project's actual scripts.

A healthy project should expose equivalents of:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

For Supabase work, also use the project's supported local CLI flow, such as:

```bash
supabase start
supabase db reset
supabase gen types typescript --local > src/types/database.ts
```

Do not blindly run destructive commands against a remote production database.

Minimum verification matrix:

| Change | Required checks |
|---|---|
| UI-only component | typecheck, lint, relevant test, manual screenshot comparison |
| Route/page change | typecheck, lint, tests, production build, manual navigation |
| Auth/RLS change | typecheck, lint, database/RLS tests, production build |
| Migration/data model | local migration apply/reset, generated types, integration tests |
| Checkout/order logic | unit + integration + E2E + production build |
| AR integration | typecheck, lint, mocked tests, permission/error manual tests, production build |
| Courier webhook | signature/idempotency tests + integration test + production build |

Never claim visual parity without opening the implemented page and comparing it to the reference.

---

# 25. Performance rules

The premium visual design must not make the storefront slow.

- Use Next/Image or the installed recommended image path for product media.
- Store sensible image sizes/variants and avoid serving giant originals to cards.
- Lazy-load below-the-fold imagery and heavy AR/3D bundles.
- Keep MediaPipe/Three/provider code out of the normal homepage bundle unless the user opens AR.
- Server-render SEO-relevant catalog/product content.
- Paginate or incrementally load large admin/product/order lists.
- Index slug, product status, category, SKU, order number, foreign keys, and search columns used by real queries.
- Avoid N+1 database requests from Server Components.
- Prefer a single purposeful query/view/RPC over dozens of sequential requests.

---

# 26. Guardrails and known traps

These are easy to get wrong.

## 26.1 Screenshot vs business-rule conflicts

The references contain visual examples of payment gateways and other future options. The MVP is COD-only. Match the visual language, not unsupported business behavior.

## 26.2 Fake AR

Do not show a generated/placed product and call it accurate AR when no real capability is configured. Capability badges must reflect actual assets/provider support.

## 26.3 Fake live courier tracking

A map is not evidence of live tracking. Use shipment events unless a real courier integration supplies location.

## 26.4 Browser trust

Never trust browser prices, discounts, roles, delivery fees, order status, stock counts, or permission flags.

## 26.5 Role escalation

A user updating `profiles.role` must never be able to grant themselves staff or owner access. The same applies to Clerk metadata: only server code writes `publicMetadata`/`privateMetadata`, `unsafeMetadata` is user-editable and never used for authorization, and the database role wins over any Clerk claim.

## 26.6 Service-role leakage

The Supabase service-role key and `CLERK_SECRET_KEY` are server-only. A `NEXT_PUBLIC_` service-role or Clerk secret variable is a critical security bug.

## 26.7 Public customer photos

Try-on photos and generated outputs must not live in a public bucket.

## 26.8 Storage URL confusion

Store object paths/keys when possible. Generate signed/public URLs at the boundary appropriate to bucket policy. Do not persist expiring signed URLs as canonical data.

## 26.9 Money floats

Do not calculate trusted totals with JS floating point. Use integer paisa/database calculations.

## 26.10 Inventory race conditions

Checking stock and then decrementing in separate non-transactional requests can oversell. Use an atomic database transaction/RPC.

## 26.11 Order history mutation

Product title, image, or price may change later. Historical orders render from snapshots.

## 26.12 Address overconfidence

GPS and reverse geocoding can be wrong, especially at ward/landmark precision. Always allow correction.

## 26.13 Camera lifecycle

Leaving camera tracks running after closing AR drains battery and keeps the camera indicator active. Stop all tracks on exit/unmount.

## 26.14 Heavy client bundles

Do not import AR/3D libraries into global layouts or ordinary product cards.

## 26.15 Next.js stale knowledge

Do not assume remembered middleware, caching, Server Action, or route conventions. Read the installed docs before implementing.

## 26.16 Dashboard vanity data

Do not ship hardcoded fake revenue/customer/order metrics to production.

## 26.17 Admin congestion

Keep the sidebar grouped by topic and keep forms sectioned. Do not solve discoverability by placing every feature in one dense screen.

---

# 27. Definition of done for UI work

A UI task is not complete until all of these are true:

- desktop composition matches the provided reference closely;
- design-system colors, typography, spacing, radius, controls, icons, and states are reused;
- responsive behavior is sensible on tablet/mobile even without a supplied mobile screenshot;
- keyboard/focus behavior works;
- loading, empty, error, disabled, and permission-denied states exist where applicable;
- real data is wired where the task requires behavior;
- unsupported features are not faked;
- typecheck/lint/tests pass;
- a production build is run when required;
- manual test steps are reported.

---

# 28. Definition of done for backend/data work

A data/backend task is not complete until:

- a migration exists for schema changes;
- constraints and indexes are appropriate;
- RLS/policies are updated;
- generated database types are refreshed;
- server/client boundaries are preserved;
- secrets remain server-only;
- error cases are handled;
- relevant integration tests pass;
- the feature is tested under the intended roles;
- production-impacting migration notes are reported.

---

# 29. Pre-made decisions

Build to these decisions unless the user explicitly changes them:

1. **Single store, not multi-vendor.**
2. **Next.js App Router + TypeScript + Supabase.**
3. **Clerk** for customer/owner/staff authentication; Supabase third-party auth passes the Clerk token to RLS.
4. **RLS** is the authorization foundation.
5. **One owner initially; permission-based staff later.**
6. **Guest checkout is allowed; accounts are optional.** Signed-in customers get the account area in §4.9.
7. **Cash on Delivery only** for the MVP.
8. **NPR** is the store currency; trusted money uses integer paisa.
9. **Asia/Kathmandu** is the display timezone default; database timestamps stay UTC.
10. **Nepal address hierarchy** is structured and editable, with geolocation only as assistance.
11. **Customer selects an available delivery/courier service** based on address/rate configuration; fulfillment may assign/override the physical courier while preserving the purchased service snapshot.
12. **Order creation and stock decrement are atomic database operations.**
13. **Product search uses Postgres FTS + trigram before external search SaaS.**
14. **Product quick view complements, never replaces, the canonical product page.**
15. **AR is capability-based.** Live landmark overlay and uploaded-photo generative try-on are separate modes.
16. **Camera frames stay local by default.** Uploaded try-on photos are private and short-lived.
17. **No fake AR result and no fake courier GPS.**
18. **The provided Design System is the visual source of truth.**
19. **The specific page screenshots are the layout/composition source of truth.**
20. **Business constraints override screenshot examples when they conflict.**

---

# 30. When in doubt

Keep the solution small and production-minded.

Read before assuming. Plan before coding. Ask only when ambiguity matters. Get approval. Execute the approved scope. Verify with real commands and role-aware tests. Report exactly what changed.

Preserve these non-negotiables:

- source-of-truth design system;
- Clerk auth + Supabase RLS;
- server-only secrets;
- COD-only checkout;
- atomic order/inventory logic;
- Nepal-first address/delivery behavior;
- truthful AR capabilities;
- private customer try-on media;
- truthful shipment tracking;
- permission-based future staff;
- strict TypeScript, lint, tests, and build verification.
