# Admin phase 3: coupons, couriers and services, delivery zones and rates (create, edit, delete)

Phase 3 of the admin CRUD work (`worklog.md` §4.5). Today these four sections are read-only lists with on/off toggles; the records only come from the seed. This phase lets the owner and permitted staff create and edit them, so a real Nepali courier can be added before checkout and the WhatsApp order flow (§4.0) are built.

## Goal

1. **Coupons** (`promotions.manage`): add, edit, delete from `/admin/coupons`.
2. **Couriers and their services** (`delivery.manage`): add, edit, delete a courier; add, edit, delete its services on the courier's edit page.
3. **Delivery zones** (`delivery.manage`): add, edit, delete a zone and choose its districts, grouped by province.
4. **Delivery rates** (`delivery.manage`): add, edit, delete the fee for a zone × service.

## Non-goals

- Checkout, `place_order`, coupon redemption logic (worklog §4.1). This phase only edits the configuration those will read.
- WhatsApp order flow (§4.0): no courier dispatch/WhatsApp contact column, no courier-assignment mode. Those land with §4.0.
- Courier API integrations and webhooks. `integration_mode` stays `manual` and is shown read-only ("Manual — staff record each update").
- Courier logo upload (the column stays, the form doesn't offer it yet).
- Per-customer usage tracking for coupons (`usage_limit_per_customer` is edited here but enforced by the future `place_order`).
- Bulk rate editing (a zone × service grid). One rate per form.

## Inspected

- `AGENTS.md` §3, §4.8, §7, §10.6, §11.5, §11.7, §12, §16, §18.7, §26.
- Migrations `delivery_promotions` (tables, checks, RLS: delivery tables → `delivery.manage`, coupons → `promotions.manage`), `orders` (`orders.courier_service_id`/`coupon_id` and `shipments.courier_id`/`courier_service_id` are `ON DELETE SET NULL`; orders keep `delivery_snapshot` and `coupon_code`), `foundation` (`nepal_provinces`, `nepal_districts`), `harden_grants`, `admin_categories_collections` (function and grant conventions).
- Pages: `admin/coupons`, `admin/delivery`, `admin/delivery/zones`, `admin/delivery/rates`, `admin/categories/{new,[id]/edit}` (the phase 2 pattern to copy).
- `src/features/admin/{schemas,catalog-forms,states,nav,auth}.ts`, `actions/{system,engagement,categories,helpers}.ts`, `queries/{system,engagement}.ts`.
- `src/components/admin/{category-form,catalog-danger-zones,settings-form,action-forms,admin-ui,delivery-tabs,status-pills}.tsx`, `src/components/ui/{select,field,input}.tsx`.
- `src/lib/money/parse.ts` (`parseRupeesToPaisa`), `nepalPhoneSchema`.
- Seed: 6 couriers, 4 zones that cover all 77 districts exactly once (the seed test asserts it), coupons `WELCOME10`, `DASHAIN25`, …
- `tests/db/harness.ts`, `tests/db/admin-categories-collections.test.ts`.
- Next docs: `02-guides/forms.md`, `04-functions/{redirect,refresh,revalidatePath}.md`.

## Decisions

### Shared pattern (same as phase 2)

- Separate `new` and `[id]/edit` pages, one sectioned form component per record type, FormData + `useActionState`, submitted by hand so fields survive a validation error. Main column of `FormSection` cards, sticky side card with the on/off checkbox and Save. Create redirects to the edit page with `?created=1`; edit shows "Saved.".
- Each list page gets an **Add …** button and an Edit link per row. Existing on/off toggles stay.
- Money is typed in rupees and parsed with `parseRupeesToPaisa` (no floats); stored in paisa.
- Actions: `authorizeAndParse(permission, schema)` → Clerk-token client (RLS applies) → readable errors for unique/check violations mapped to the field. No service role.
- Delete lives in a danger-zone card with a confirm dialog. Delete is refused (with the reason, and "Turn off" offered instead) when the record is part of order history.

### Coupons

- Routes: `/admin/coupons/new`, `/admin/coupons/[id]/edit`.
- Sections:
  - **Code & description**: code (upper-cased as typed, `A–Z 0–9`, 3–32, unique), description (≤ 200, shown to shoppers).
  - **Discount**: type radio (Percentage / Fixed amount). Percentage → percent (1–100) + optional max discount (Rs.). Fixed → amount off (Rs.). Optional minimum order (Rs.). A live one-line summary ("15% off orders over Rs. 3,000, up to Rs. 1,500").
  - **Schedule**: starts (required, defaults to now), ends (optional, after start); `datetime-local` in Asia/Kathmandu using the existing `toKathmanduInput`/`fromKathmanduInput`.
  - **Limits**: total uses (optional), uses per customer (optional). Shows "Used N times" when editing.
- **Once a coupon has been used** (`times_used > 0` or referenced by an order): the code and discount type are locked (shown read-only with a hint), because past orders show that code. Value, limits and dates stay editable. Enforced by a trigger, not only the UI.
- Delete: only when never used; otherwise offer Turn off.

### Couriers and services

- Routes: `/admin/delivery/couriers/new`, `/admin/delivery/couriers/[id]/edit`. The Couriers tab gets **Add courier** and an Edit link per courier panel.
- Courier form: name (≤ 80), slug (reuse `NameSlugFields`; hint text only, no storefront URL), support phone (Nepal, E.164 via `nepalPhoneSchema`, optional), website (`https://` only, optional), active. Integration mode shown read-only.
- **Services** are managed on the courier edit page (not on create — a courier must exist first): a table of the courier's services with Edit and Delete per row and **Add service**, each opening a dialog form (same `<dialog>` pattern as the category pop-up). Fields: name (≤ 80), service code (upper-cased, `A-Z0-9-`, 2–40, unique across all couriers), level (Standard / Express / Pickup via `Select`), description (≤ 200), estimate min/max days (0–60, max ≥ min), active.
- Delete a service: refused when any order or shipment references it (history); deleting cascades its rates, so the confirm dialog says how many rates go with it.
- Delete a courier: refused while it has services or any shipment references it.

### Zones

- Routes: `/admin/delivery/zones/new`, `/admin/delivery/zones/[id]/edit`.
- Form: name (≤ 80), slug, description (≤ 200), sort order, active, and **Districts**: grouped by the 7 provinces, each group with a checkbox list and "Select all in province"; a filter box; a count ("16 districts selected"). A district that already belongs to another zone shows that zone's name and is disabled, with the hint "Remove it from <zone> first".
- **Database rule (new trigger):** a district belongs to at most one zone, and every code must exist in `nepal_districts`. Violations raise `22023` with the district names, shown inline on the Districts field. The trigger takes a transaction advisory lock so two concurrent saves can't both claim a district.
- Zones page gains a warning panel listing **districts not in any zone** ("Checkout can't deliver to these addresses") — seed today: none.
- Delete: always allowed (orders keep their `delivery_snapshot`); the dialog says its rates are deleted too.

### Rates

- Routes: `/admin/delivery/rates/new` (optional `?zone=` / `?service=` preselect), `/admin/delivery/rates/[id]/edit`.
- Form: zone (`Select`), service (`Select`, grouped label "Courier — Service"), fee (Rs., 0 allowed = free delivery), optional estimate override min/max days (placeholder shows the service default), optional minimum order (Rs.), optional weight range (grams), active.
- Unique `(zone, service)`: duplicate shows "This zone already has a rate for that service" with a link to edit the existing one.
- Delete: always allowed (orders keep the fee they were charged).

### Revalidation

- No storefront page reads coupons, zones or rates yet. Actions call `refresh()` only; checkout (later) reads them fresh from the database.

## Files expected to change

- `supabase/migrations/<ts>_admin_coupons_delivery.sql` (new):
  - `delivery_zones` trigger: district codes exist and don't overlap another zone (advisory lock).
  - `coupons` trigger: code and type can't change once `times_used > 0` or an order references the coupon.
  - `admin_delete_coupon(id)`, `admin_delete_courier(id)`, `admin_delete_courier_service(id)`: check history, raise readable messages, delete. `security invoker`, `search_path = ''`, execute revoked from `public, anon`, granted to `authenticated`, and each re-checks its permission.
- `src/types/database.ts`: regenerated.
- `src/features/admin/delivery-forms.ts` (new): Zod schemas for coupon, courier, service, zone, rate forms; coupon summary text helper.
- `src/features/admin/actions/coupons.ts`, `actions/delivery.ts` (new): save and delete actions.
- `src/features/admin/queries/system.ts`, `queries/engagement.ts`: editor reads (coupon by id + order count; courier by id with services + usage counts; zone by id; district list grouped by province with owning zone; rate by id; zone/service options; unzoned districts).
- Components (new): `coupon-form.tsx`, `courier-form.tsx`, `courier-services.tsx` (table + dialog form), `zone-form.tsx`, `district-picker.tsx`, `rate-form.tsx`, danger zones in `delivery-danger-zones.tsx`.
- Pages (new): `admin/coupons/{new,[id]/edit}/page.tsx`, `admin/delivery/couriers/{new,[id]/edit}/page.tsx`, `admin/delivery/zones/{new,[id]/edit}/page.tsx`, `admin/delivery/rates/{new,[id]/edit}/page.tsx`.
- Pages (edited): `admin/coupons/page.tsx`, `admin/delivery/page.tsx`, `admin/delivery/zones/page.tsx`, `admin/delivery/rates/page.tsx` (Add buttons, Edit links, unzoned-district warning).
- Tests: `src/features/admin/delivery-forms.test.ts`, `src/components/admin/__tests__/delivery-forms.test.tsx` (coupon type switch, district picker select-all/disabled), `tests/db/admin-coupons-delivery.test.ts`.
- `worklog.md`: tick phase 3.

## Auth / RLS

- Pages: `requireAdminAccess("promotions.manage")` / `("delivery.manage")`. Actions re-authorize, then Zod, then RLS (existing policies already cover insert/update/delete), then the SQL functions' own checks.
- No new tables, no grant changes beyond the new functions.

## Acceptance criteria

- Owner creates `TIHAR15` (15%, max Rs. 1,000, min Rs. 2,000, starts tomorrow): list shows it as Scheduled with the right discount label. Editing it works; deleting it works.
- A used seed coupon: code/type are read-only in the form and rejected by the database if forced; delete is refused with the reason.
- Owner adds courier "Nepal Express Test" with phone `9801234567` → stored `+9779801234567`; adds a service `NET-STD` (Standard, 2–4 days); it appears on the Couriers tab and in the rate form's service list.
- A seeded service used by orders can't be deleted; a new unused one can, and its rates go with it. A courier with services can't be deleted.
- Owner creates zone "Test Zone": districts already in other zones are disabled with the owner zone named; after removing "Mustang" from Remote Himalayan, it can be added to Test Zone; the zones page then shows no unzoned districts. Forcing an overlap through SQL is rejected.
- Owner adds a rate for Test Zone × `NET-STD` at Rs. 150; a second rate for the same pair shows the duplicate error.
- Staff with only `delivery.manage` get 404 on coupon pages; staff with only `promotions.manage` get 404 on delivery pages. Customers/anon can't call the functions.
- Invalid inputs each show an inline error: bad code, percent 0 or 101, fixed amount missing, end before start, bad phone, `http://` website, max days < min days, duplicate service code, negative fee.
- Keyboard: all controls reachable, dialogs trap and return focus; empty/error states present; no horizontal overflow at 375 px.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`.
- `npm run db:push` then `npm run db:types` against the hosted **dev** DB.
- Browser check of all four editors as the owner (Playwright scratch script, like phase 2), then delete the test records.

DB tests (PGlite, per role): zone overlap trigger (insert and update, unknown code), coupon lock trigger (used vs unused), each delete function (blocked by history, allowed when clean, denied for the wrong permission / customer / anon), rate unique pair, service delete cascades rates.

## Manual test steps

1. `/admin/coupons` → **Add coupon**. Code `tihar15` (becomes `TIHAR15`), Percentage 15, max Rs. 1000, min order Rs. 2000, starts tomorrow 09:00. Save → edit page "Coupon created"; list shows Scheduled.
2. Switch type to Fixed without an amount → inline error. Set Rs. 200 → saves.
3. Open `WELCOME10` → code and type are read-only, "Used N times"; danger zone says it can't be deleted and offers Turn off.
4. Delete `TIHAR15` → gone from the list.
5. `/admin/delivery` → **Add courier** "Nepal Express Test", phone `9801234567`, website `https://example.com`. Save → edit page. **Add service** `NET-STD`, Standard, 2–4 days → appears in the table.
6. Try deleting the courier → blocked (has services).
7. `/admin/delivery/zones` → **Add zone** "Test Zone": Kathmandu is disabled ("In Kathmandu Valley"). Edit Remote Himalayan, untick Mustang, save → the zones page warns Mustang has no zone. Add Mustang to Test Zone → warning gone.
8. `/admin/delivery/rates` → **Add rate**: Test Zone × Nepal Express Test — NET-STD, Rs. 150. Save. Add the same pair again → duplicate error with an Edit link.
9. Clean up: delete the rate, the service, the courier, the zone; put Mustang back in Remote Himalayan.

## Rollback

- The migration adds two triggers and three functions; no data changes. Rollback: drop them. Records created through the new forms are ordinary rows and can stay.

## Implementation notes (after execution)

- **Triggers instead of delete functions.** History protection is a `BEFORE DELETE` trigger on `coupons`, `courier_services` and `couriers` (plus a `BEFORE UPDATE OF code, type` trigger on coupons), so it holds for every path, not only the admin actions. The actions do plain deletes through RLS. The triggers are `security definer` so they see every order and shipment.
- **"Used" means an order references it**, not `times_used > 0`. `seed:purge` deletes orders before coupons, and `times_used` is only a counter.
- **Two definer read functions** (`admin_coupon_order_counts`, `admin_delivery_history_counts`, gated by `promotions.manage` / `delivery.manage`) let the editors disable what the triggers would refuse, because those staff may not have `orders.read`.
- **Zone trigger** sorts and de-duplicates `district_codes`, rejects unknown codes, and takes a transaction advisory lock before the overlap check.
- **Queries live in** `queries/coupon-editor.ts` and `queries/delivery-editor.ts` (new files) rather than `system.ts` / `engagement.ts`.
- **Shared pieces:** `editor-parts.tsx` (`useEditorForm`, `CheckboxField`, `SaveCard`), `SuccessNotice` / `AddLink` / `EditLink` / `editorGridClasses` in `admin-ui.tsx`, `saveErrorResult` in `actions/helpers.ts`, `isUuid` in `url.ts`. `SlugHint` / `NameSlugFields` take an optional `basePath` (couriers and zones have no storefront URL).
- **Fixed an existing mobile overflow:** `TableScroll` lacked `relative`, so the `sr-only` text in row action buttons was positioned against the page and widened it (e.g. `/admin/categories` was 313 px too wide at 375 px). All admin list and editor pages checked now report 0 px.
- **Browser check:** Playwright (scratchpad, `playwright-core`) ran as the owner via a short-lived Clerk sign-in token against the dev server and hosted dev DB. It covered all acceptance steps (coupon create/switch type/lock/delete; courier with bad then good phone, service add, duplicate service code; zone with taken districts disabled, moving Mustang, unzoned warning; rate create and duplicate pair link + server error; cleanup) and 375 px overflow. Test records were deleted and Mustang is back in Remote Himalayan.
