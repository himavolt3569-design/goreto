# Daraz Express (DEX) courier integration via the Daraz Logistics API (EPIS)

_Status: approved 2026-10-06 (revised after full re-research; supersedes the first draft) · Branch: `feat/daraz-courier`_

_Research, endpoint reference, status table, runbook: [`docs/couriers/daraz.md`](../docs/couriers/daraz.md). Client handout: [`docs/couriers/daraz-meeting-brief.md`](../docs/couriers/daraz-meeting-brief.md)._

## Context

The client meets Daraz tomorrow (2026-10-07) to set up the courier API and webhooks. You asked for four things: re-research Daraz, review our code for gaps, build everything Daraz could ask for (no non-goals), and write documentation that explains what Daraz needs, what we give them, what to ask, and what "dashboard" means.

**Your decisions (this session):**

- **Scope.** DEX courier only. Goreto books its own website and WhatsApp orders with Daraz Express. The Daraz marketplace (listing products on daraz.com.np) is not included. The docs describe it as a possible separate future phase.
- **Dashboard.** Daraz gave nothing in writing, so the docs cover every meaning and we build our side: a full Daraz Express dashboard in Goreto admin.

**State of branch `feat/daraz-courier` (uncommitted):**

- Migration `20261007090000_daraz_courier.sql` is written, tested (15 PGlite tests and the full suite of 339 pass) and **already applied to hosted dev**. `src/types/database.ts` is regenerated.
- Library drafts: `src/lib/courier/daraz/{sign,config,client,epis,payloads,status-map}.ts` and `sign.test.ts`. The signer reproduces Daraz's documented example signature exactly.
- `prompts/goreto-daraz-courier.md` is the first draft. It gets rewritten (below).

Because migration 1 is already on dev, it stays unchanged. All schema changes go into a **new migration 2**.

---

## Verified research findings

Sources:

- Daraz Open Platform JSON doc endpoints (`open.daraz.com/handler/share/apidoc/*`);
- Lazada Open Platform (the same "IOP" platform, with fuller docs);
- `www.dex.com.pk` (DEX's own merchant pages);
- an `oms.dex.com.np` probe;
- DEX Nepal launch news (ShareSansar, Himalayan Times, 2025-11-02);
- Vercel docs.

1. **Two separate Daraz systems.**
   - **(a) Daraz Open Platform** (`open.daraz.com`; developer sign-up at `iopaccount.daraz.com/register`): you register an app and get an App Key and App Secret. It hosts the Logistics API, "EPIS".
   - **(b) DEX OMS**, the merchant portal. Nepal's is at **`oms.dex.com.np`** (live, redirects to a seller login). Merchants register there with business documents and bank details, see shipments and COD payouts, and generate the **OTP "bundle code"** that links their account to a platform such as Goreto.
2. **DEX's own merchant API page links to the Daraz Open Platform docs.**
   - Its links are: "Create an Order" → `POST /logistics/epis/packages`, "Get AWB" → `/packages/awb`, "Order Cancellation" → `/packages/cancel`, plus the signature docs and "Create an account as an Aggregator".
   - So DEX's documented booking call is **create** (`/packages`), not `consign`. My draft used `consign`, so the endpoint becomes a setting that defaults to `create`.
3. **Auth.** EPIS endpoints are `authType 0`: requests are signed with the app key and secret and need **no seller OAuth token**.
   - Each request is a HMAC-SHA256 signature over the sorted params, prefixed by the API path, in uppercase hex.
   - Our seller identity is `platformName` (assigned by Daraz, the partner-platform name; Daraz's examples use "Pancake" and "OneLink") plus `externalSellerId` (our own ID for the store), linked once with the OTP from OMS.
4. **Full EPIS surface on Daraz.** There are 14 listed endpoints plus 2 that are documented but hidden from the list.
   - Listed: create, consign, rts, awb (pdf/zpl), cancel, update (after RTS), reattempt, history, warehouses, OTP account link, and XSpace support cases (create, detail, query, rate).
   - Hidden but documented: **`/logistics/epis/service/delivery_options`** (updated 2026-06-10; returns options, first-mile pickup vs drop-off, pickup cutoff time) and **`/logistics/epis/estimate_shipping_fee`** (updated 2026-08-29; fee lines Delivery/COD/Insurance/Surcharge with tax).
5. **Real status vocabulary.**
   - Lazada's fulfilment push list: `READY_TO_SHIP`, `INFO_ST_DOMESTIC_PICKUP_SIGN_IN_SUCCESS`, `…_SC_SIGN_IN_SUCCESS`, `…_PACKAGE_STATIONED_IN/OUT`, `…_OUT_FOR_DELIVERY`, `…_1ST_ATTEMPT_FAILED`, `…_REDELIVERY`, `…_DELIVERY_FAILED`, `ON_THE_WAY_BACK_TO_SHIPPER`, `…_BACK_TO_SHIPPER`, `LOST_BY_3PL`, `DAMAGE_BY_3PL`, `PACKAGE_SCRAPPED`, `CANCELLED`, `DELIVERED`, and others.
   - Daraz's history example uses lowercase forms: `package_ready_to_be_shipped`, `domestic_delivered`, reason `customer_reject_at_door_step`.
   - In that example **`processTime` is in seconds** (`1600000000`), although the field description says milliseconds. `shippingFee` can be the string `"{}"`.
6. **Webhooks.**
   - The callback URL must use an **OV/EV certificate (DV is rejected)**.
   - We must ack with HTTP 200 **within 500 ms**. Daraz retries every 30 min, up to 12 times.
   - The signature is `hex(HMAC-SHA256(appKey + body, appSecret))` in the `Authorization` header.
   - Only marketplace message types are documented: trade order, reverse order, and fulfilment `message_type 14`. **No EPIS package push is documented**, so polling the history API is the primary sync and pushes are a bonus trigger.
   - Our domain `*.vercel.app` has a **DV** cert, and Vercel allows custom-certificate upload only on **Enterprise**.
7. **Possible platform hurdles.**
   - App go-live for third-party apps needs "1000 calls a day for 2 weeks at 95% success", and the app form asks for a workflow diagram (JPG/PNG).
   - An IP whitelist is possible. Vercel Static IPs cost about $100 a month on the Pro plan.
   - Both are questions for Daraz.
8. **Money (DEX merchant pages).**
   - COD settles **3–5 business days after delivery, several times a week**. Service charges come from the sales rep, on a **monthly bill**. There are **3 delivery attempts**, then return to shipper. No pickup charge. Claims are not insured by default.
   - **There is no settlement API**: statements live in OMS. Our side records settlements and reconciles them.
9. **"Optional Daraz address format at checkout"** is a feature of Daraz's own Shopify app. Daraz routes by its own last-level location IDs ("R-codes"). Destination `address.id` is optional, but the warehouse needs one, so we keep a municipality → R-code map.

## What "the dashboard" can mean (goes into the docs verbatim)

1. **DEX OMS (Daraz's merchant dashboard, `oms.dex.com.np`).** The client's own DEX account: shipments, COD settlements, invoices, bundle-code generation. The client signs up; we don't build it.
2. **Daraz Open Platform App Console.** The developer dashboard where we:
   - create the app;
   - see the App Key and App Secret;
   - request the Logistics API permission;
   - set the push URL ("Message Service");
   - see API-call statistics and the push log.

   We operate it. The client owns the account.
3. **Our integration dashboard, which Daraz may want demoed before go-live.** It's the admin screen where a partner platform books, prints labels, marks ready to ship, tracks, handles failed deliveries and support cases, and reconciles COD. It's the same thing Daraz's own Shopify app is (a "centralized dashboard"). **We build this:** Admin › Daraz Express, below.

---

## Review: problems found in the current branch (all fixed by this plan)

1. `status-map.ts`: the keyword rules mis-map official statuses. `PICKUP_SIGN_IN_SUCCESS`, `SC_SIGN_IN_SUCCESS`, `STATIONED_IN/OUT`, `REDELIVERY` and `BACK_TO_SHIPPER` all map to nothing, and `PACKAGE_RETURNED_FAILED` maps to "returned". Replace with an **explicit table** covering every listed status (uppercase `INFO_ST_*` and lowercase `domestic_*` forms both normalise to it), with the keyword rules only as a fallback.
2. `toProviderHistory`: `processTime` in seconds would become 1970 dates. Normalise: below 1e12 means seconds.
3. Fee parsing: `shippingFee` may be a number string, a JSON string or an object. Parse all of them, and prefer the `estimate_shipping_fee` result for the booking-time fee.
4. Booking endpoint: `consign` is hard-coded, but DEX documents `create`. Make it a setting `booking_endpoint` (`create` default, `consign`).
5. **Rebooking after cancel would fail silently.** Daraz records only the first request per `externalOrderId` and treats later ones as duplicates. Use `provider_reference` = order number for the first attempt and `<order>-R<n>` after a cancel. Track the attempt count on the shipment.
6. **DB guard gap.** `admin_assign_courier` (security invoker) rewrites `tracking_number`. Re-saving the same courier on a Daraz-booked order would erase the Daraz tracking number. Extend the trigger to block `tracking_number` changes while a booking is live.
7. **WhatsApp handoff left dangling.** A Daraz-booked order keeps a `pending` WhatsApp handoff and the "ready to send" bell item. On booking, record the handoff as sent through the new channel `daraz_api` and resolve `order_auto_accepted` notifications.
8. Phone format is ambiguous: one example has `+92…`, another `92…`. Make it a setting `phone_format` (`national` default, `e164`).
9. The notification bell has no styling for the new `courier_attention` kind (`notifications-menu.tsx` only knows `order_auto_accepted`).
10. Several screens still say couriers are manual only:
    - the courier form says "Every courier is manual";
    - `actions/delivery.ts` says "integration_mode stays as stored";
    - the delivery and support pages carry the same assumption;
    - worklog §4.0 says "no courier API integrations".
11. The manual "assign tracking number" field and manual tracking events still appear for API couriers, so staff could fight the sync.
12. `courier_services` has no mapping to Daraz `standard`/`economy`, so the purchased service can't choose the Daraz option.
13. Customers get no "Track on Daraz" link. There's no generic tracking-URL template on couriers.
14. Packages have no dimensions anywhere (variants only have `weight_grams`), so a box choice is required.
15. `.env.example`, CLAUDE.md, `docs/releasing.md` and AGENTS-adjacent docs are missing the Daraz variables and steps.

---

## Implementation

### Step 1: Documentation first (needed for the meeting)

- **`docs/couriers/daraz-meeting-brief.md`**, the client's handout (plain language):
  - what DEX does for Goreto;
  - the two Daraz accounts to create (DEX OMS merchant, Daraz Open Platform developer);
  - documents to bring (business registration/PAN, bank account details or cheque, pickup address, contact);
  - **what we give Daraz**: company and store details, app category, callback URL, webhook URL, workflow diagram, expected daily parcel volume, pickup and return addresses, sample request;
  - **what Daraz must give us** (checklist);
  - **questions to ask** (below);
  - the money flow;
  - the three meanings of "dashboard";
  - next steps.
- **`docs/couriers/daraz.md`**, the full technical reference:
  - system overview with a mermaid sequence diagram (accept → book → AWB → RTS → pickup → tracking → delivered → COD settlement);
  - every endpoint with its parameters (from the downloaded specs);
  - signing and webhook rules;
  - the status mapping table;
  - order, payment and tracking rules in Goreto;
  - settings and env reference;
  - runbook (errors, traceId, support email, failed deliveries, cancel/rebook, returns);
  - risks and fallbacks (OV cert relay, IP whitelist, test quota);
  - go-live checklist;
  - the marketplace integration as a possible future phase.
- **`docs/couriers/daraz-workflow.svg`**: the app workflow diagram Daraz's registration form asks for. Open it in a browser and export to PNG.
- **Questions for Daraz** (in both docs):
  - app category and how go-live works (test quota exemption? sandbox URL and test account?);
  - our `platformName` and `externalSellerId` conventions, and how the OTP bundle code is generated in OMS;
  - `solutionCodes` for Nepal COD (e.g. `DARAZ_STANDARD_NP`?);
  - create vs consign, and whether `/packages` returns a tracking number immediately;
  - which `deliveryOption` values exist in Nepal;
  - the Nepal location R-code list (file format), and whether destination `address.id` is needed in practice;
  - the full Nepal status list and failure reason codes;
  - whether EPIS pushes package updates, the payload shape, and whether OV/EV is enforced;
  - IP whitelist yes/no;
  - phone format and currency `NPR`;
  - insurance amount effects and fees;
  - whether `delivery_options`, `estimate_shipping_fee` and `packages/update` are enabled in Nepal;
  - AWB format (pdf/zpl, label size);
  - pickup schedule and cutoff;
  - COD settlement statement format and frequency, and whether fees are netted or billed monthly;
  - XSpace case template and category IDs;
  - rate limits;
  - support contacts (technical and operations);
  - the meaning of "dashboard" for them.
- Update `prompts/goreto-daraz-courier.md` to this plan, with no non-goals except the client's marketplace decision.

### Step 2: Migration 2 `supabase/migrations/20261007100000_daraz_courier_ops.sql`

It follows the `harden_grants` pattern: RLS on, explicit revoke and grant, `security definer` functions with `search_path = ''`.

- **Guard fix (finding 6):** recreate `shipments_guard_provider_booking` to also block `tracking_number` edits while a booking is live.
- **Shipments:** add these columns:
  - `provider_reference` and `provider_booking_attempts` (finding 5);
  - `first_mile_type` and `pickup_cutoff_at` (from delivery options);
  - `provider_estimated_fee_paisa`, `awb_printed_at`;
  - `provider_receiver jsonb` (after a `packages/update`);
  - `cod_remittance_id` (FK).
- **Couriers and services:**
  - `couriers.tracking_url_template` must be `https://` and contain `{tracking}`. It works for every courier.
  - `courier_services.provider_option` (`standard | economy`) maps the purchased service to the Daraz option.
- **Settings** (`courier_provider_accounts`): add these, and extend `admin_update_provider_account`'s allowlist to cover them:
  - `booking_endpoint`, `phone_format`, `declare_insurance`, `default_item_category`;
  - `origin_latitude/longitude`;
  - `box_presets jsonb` (named L×W×H list);
  - `auto_book` (default off);
  - `xspace_case_template_id`, `xspace_category_id`.
- **Booking RPCs:** recreate `admin_record_provider_booking` so it:
  - stores the reference, attempt count and estimated fee;
  - marks the WhatsApp handoff sent through the new enum value `courier_handoff_channel 'daraz_api'`;
  - resolves `order_auto_accepted` notifications.

  New RPCs:
  - `admin_mark_awb_printed`;
  - `admin_record_provider_receiver_update`, which writes `provider_receiver` and a customer-visible event "Delivery details updated";
  - `admin_record_provider_feedback` (reattempt/return), which logs an event and clears `needs_action`.
- **COD settlements:** new table `courier_remittances`: provider, reference (unique per provider), statement date, gross COD, deductions, net, note, recorded_by.
  - `admin_record_remittance(provider, reference, date, gross, deductions, tracking_numbers[])` links delivered Daraz shipments that aren't yet remitted. It returns the expected COD vs entered gross and refuses unknown, undelivered or already-remitted tracking numbers.
  - `admin_delete_remittance` (owner) unlinks.
  - RLS: read with `orders.read`; writes only through RPCs with `orders.write`.
- **Support cases:** new table `courier_support_cases`: provider, case_id (unique), order_id, tracking_number, subject, status, rating, created_by, synced_at.
  - RPCs `admin_record_support_case` and `admin_update_support_case_status` (`orders.write`). Case detail is fetched live from Daraz and not stored.
- `daraz_locations` and the inbox/log tables from migration 1 stay as they are.

### Step 3: Library fixes and additions (`src/lib/courier/daraz/`)

- `status-map.ts`:
  - explicit table for every official status (finding 1);
  - seconds/ms timestamps (finding 2);
  - robust fee parsing (finding 3);
  - customer-safe messages, plus failure reasons from `reasonCode`.
- `epis.ts`:
  - add `createPackage`, `deliveryOptions`, `estimateShippingFee`, `updatePackage`;
  - XSpace `createCase`, `queryCases`, `caseDetail`, `rateCase`;
  - booking picks `create` or `consign` from settings;
  - `printAwb` takes `pdf | zpl`;
  - history keeps the ePOD, photo and driver fields **only in memory**, so "View proof of delivery" can show them live without storing them.
- `payloads.ts`:
  - phone format option, insurance, item category, `reference` as `externalOrderId`;
  - builders for update, fee estimate and delivery options.
- `client.ts`: keep it as is. In `development` only, allow `http://localhost` as `DARAZ_API_URL`, for the mock below.
- **New `scripts/daraz/mock-server.ts`**: a dev-only fake EPIS server (localhost) that returns spec-shaped responses and walks a package through the statuses. Uses:
  - demo the full dashboard **before** Daraz issues keys;
  - show Daraz the integration;
  - run manual QA.

### Step 4: Background sync (no user session)

- **`src/lib/courier/provider-sync.ts`** is the only new importer of `lib/supabase/admin.ts`, added to the `boundaries.test.ts` allowlist. It can:
  - sync one shipment by tracking number or package code;
  - sync due shipments (non-final, oldest `provider_synced_at` first, batch of 25);
  - store and process inbox rows;
  - extract identifiers from any push shape;
  - write `courier_api_log` rows.
- **`POST /api/courier/webhooks/daraz`** (public; signature required):
  1. Verify the signature and cap the body at 256 KB.
  2. Insert into the inbox with dedupe on the body hash, then return 200 immediately to meet the 500 ms ack.
  3. In `after()` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), fetch the history and apply it.
- **`GET /api/cron/courier-sync`**: requires `Authorization: Bearer $CRON_SECRET`.
  - `vercel.json` schedules it daily, which is Hobby-safe.
  - `docs/releasing.md` gets an optional Supabase `pg_cron` + `pg_net` snippet (secret kept in Vault) for every-15-minute sync.
- **Auto-book** (setting, off by default): after an accept with a Daraz courier (`acceptOrderAction`, plus the auto-accept path in checkout and manual orders), it books with default options inside `after()`. If the weight or settings are missing, it raises a `courier_attention` notification instead.

### Step 5: Admin UI

All of it uses the design-system primitives (`admin-ui.tsx`, `action-forms.tsx`, `editor-parts.tsx`, `ui/*`) and Phosphor icons through `icons.ts`.

**Order page panel** (`src/components/admin/daraz-shipment-panel.tsx`). On `/admin/orders/[orderNumber]` it replaces the WhatsApp handoff panel when the courier's `api_provider = 'daraz'`.

- **States:** not configured / not linked / ready to book / booked / label printed / ready to ship / with Daraz / needs action / delivered / returned / booking canceled.
- **Actions:**
  - **Book** dialog, with these fields:
    - delivery option prefilled from the purchased service's `provider_option`;
    - box preset plus L/W/H;
    - weight prefilled from summed variant `weight_grams`;
    - open box, note;
    - **live Daraz fee estimate** and pickup cutoff.
  - **Print label** (PDF/ZPL), **Ready to ship**, **Refresh tracking**.
  - **Edit delivery details** (`packages/update`), **Cancel booking** (reason).
  - **Failed delivery**: Re-attempt (date and note) or Return.
  - **View proof of delivery** (live links), **Open support case**.
- **Info shown:** package code, tracking number, reference, last-mile provider, ETA, estimated and actual fee, Daraz raw status, last synced.
- It auto-refreshes once on open when the data is more than 15 minutes old.
- `OrderActions` hides the manual tracking-number field and manual tracking events for API couriers (finding 11).

**Admin › Daraz Express dashboard** (`/admin/daraz`, nav item in the Sales group, `orders.read`):

1. **Overview**:
   - KPI cards: to book, booked not RTS, with Daraz, out for delivery, needs action, delivered (7 days), returned, **COD with Daraz awaiting settlement**, Daraz fees this month;
   - connection health: keys set, account linked, warehouses synced, last sync, last webhook, API error rate (24 h).
2. **Shipments**: filterable table (status / needs action / not booked / date) with bulk **Book**, **Print labels** (one merged PDF through a new route handler using `pdf-lib`, a new dependency, since Daraz label URLs expire in 5 min; ZPL is concatenated), **Ready to ship** and **Refresh**.
3. **Needs action**: queue of failed deliveries and exceptions with re-attempt or return.
4. **COD settlements**: expected vs settled; record a settlement by pasting or selecting tracking numbers; mismatch flags; history.
5. **Support cases** (XSpace): list (synced), create, live detail, rate.
6. **Activity**: API log (action, result, error, traceId, duration, who) and webhook inbox (received / processed / errors) for debugging with Daraz.
7. **Setup** (`delivery.manage`):
   - **Test connection**;
   - OTP account link;
   - pickup and return warehouses (stores Daraz's `convertedAddress.id`);
   - booking defaults and box presets, auto-book;
   - XSpace IDs;
   - webhook URL with a copy button, and cron status;
   - location map coverage (N of 753 municipalities mapped).

**Other screens:**

- **Courier form and services:**
  - "Booked through Daraz Express API" switch sets `integration_mode`/`api_provider`;
  - tracking URL template field;
  - service dialog gets the Daraz option select;
  - update `actions/delivery.ts`, `delivery-forms.ts` and `queries/delivery-editor.ts`.
- **Notifications:** `courier_attention` styling (warning tone, truck icon) and tests.
- **Payments page:** a "COD with Daraz (awaiting settlement)" stat linking to Settlements.
- **Delivery and support pages:** copy updated to "API (Daraz Express)".

### Step 6: Customer-facing

- `features/orders/tracking-model.ts` and `components/store/orders/order-tracking-view.tsx` gain a "Track on {courier}" link from `tracking_url_template`. This covers guest `/track`, `/order-confirmation` and account order detail.
- Daraz ETA and events already flow through `shipment_events` and `shipments`.
- No driver names, phones or photos are shown to customers.

### Step 7: Location map

`scripts/daraz/import-locations.ts` (service role, `--dry-run`) reads a CSV in either of two forms:

- `municipality_code,daraz_address_id,daraz_city`;
- Daraz names, matched to our 753 municipalities, with an unmatched-rows report.

It upserts `daraz_locations`. It runs once Daraz sends the Nepal list.

### Step 8: Housekeeping

- `.env.example` and Vercel env: `DARAZ_APP_KEY`, `DARAZ_APP_SECRET`, `DARAZ_API_URL`, `CRON_SECRET`.
- CLAUDE.md (commands, mock server).
- `docs/releasing.md` (prod order: migrations → env → webhook registration → cron).
- worklog.md (§4.0 decision reversed for Daraz; new section with checkboxes).
- Comment fixes from finding 10.
- `npm run db:push` (dry run first) to dev, then `npm run db:types`. Prod waits for release.

---

## Tests and verification

- **Unit (Vitest):**
  - client: gateway signature error, business error with field errors, string booleans, network timeout;
  - every EPIS wrapper's encoding;
  - payloads: money, discount allocation, phone formats, reference suffix, address details;
  - status map: every official status in both cases;
  - history: seconds/ms, fee forms;
  - webhook route: 401 bad signature, 200 duplicate, processing after response;
  - cron auth;
  - identifier extraction;
  - Daraz panel states;
  - courier form switch;
  - notifications styling.
- **DB (PGlite `tests/db/daraz.test.ts`, extended):**
  - tracking-number guard;
  - rebooking reference and attempts;
  - handoff and notification resolution;
  - remittance RPC (wrong, undelivered or duplicate tracking numbers refused; totals);
  - support-case RPCs;
  - grants for all new tables and functions per role (anon, customer, support, fulfilment, owner, service role).
- **Commands:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, and `npm run build` (dev env loaded).
- **Manual QA with the mock server** (`DARAZ_API_URL=http://localhost:4010`):
  1. Setup: test connection, link the OTP, sync warehouses.
  2. Mark a courier as Daraz, map a service, set a tracking template.
  3. Accept an order, then book it (check the fee estimate shows).
  4. Print the label, then mark ready to ship.
  5. Have the mock advance the package, then refresh. The order should move to shipped, then delivered and COD collected.
  6. Check the customer `/track` page shows the events and the Daraz link.
  7. Have the mock fail a delivery. Check the bell, then re-attempt.
  8. Record a COD settlement.
  9. Create a support case.
  10. Send a signed webhook with `curl`. It should return 200 and get processed. A bad signature should return 401.
- **With Daraz's real keys (after the meeting):** repeat steps 1–3 and 6 against `https://api.daraz.com.np/rest`, then cancel the test booking.

## Order of work

1. Docs, brief, diagram and the rewritten prompt. These are needed for the meeting.
2. Migration 2 and library fixes, then the order-page panel and the mock server, so a demo is possible.
3. Sync, webhook and cron.
4. Dashboard tabs: Overview, Shipments, Needs action, Settlements, Support, Activity, Setup.
5. Customer link, location importer, housekeeping, then full verification.

After the meeting, Daraz's answers (status list, phone format, endpoint, R-codes, `solutionCodes`) become settings or table edits, not rewrites.
