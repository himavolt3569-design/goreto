# Send & track: one page to enter, send and track parcels, plus Autopilot

_Status: approved and implemented 2026-10-07 (both parts) · Branch: `feat/daraz-courier` (continues the uncommitted Daraz work)_

## Goal

The client finds the Daraz flow too hard. Today a WhatsApp order sent with Daraz takes about six screens and decisions:

1. Orders › New WhatsApp order: fill the form, then **Create order**.
2. The order page: **Accept**, then pick a courier in the dialog.
3. The Daraz panel: **Book**, then box, weight and option in a dialog.
4. **Print label**.
5. **Ready to ship**.
6. Tracking: open the order, or the Daraz dashboard's seven tabs.

The automation that could remove most of this already exists, but it's split across four switches on two pages:

- auto-accept website orders and auto-accept WhatsApp orders, in Settings;
- courier mode `auto`, also in Settings;
- Daraz `auto_book`, in Daraz › Setup.

Autopilot also stalls whenever a product has no weight saved, which is most of them.

Build two things that work together:

1. **Send & track** (`/admin/parcels`): one page with a **New order** button. Fill in the order and press **Save and send**. Goreto saves it, accepts it, routes it to the right courier and books Daraz in the same click. The list below on the same page tracks every parcel, with one plain next-step button per row.
2. **Autopilot**: one switch, with a readiness checklist. When it's on, every new order (website or WhatsApp) is accepted, routed to the courier of the delivery service the customer chose, and booked with Daraz automatically. A "usual parcel weight" covers products that have no weight saved.

## Non-goals

- Automatic sending to non-Daraz couriers. A free `wa.me` link always needs someone to tap Send, and doing it automatically would need the paid WhatsApp Business API (worklog §4.0). Those rows get a one-tap **Send on WhatsApp** button instead.
- Changes to Daraz booking, signing, sync or status mapping, or to the order state machine.
- Removing or redesigning the Daraz Express dashboard or the order-page Daraz panel. They stay as the "advanced" view, and Send & track links to them.
- Moving manual (non-Daraz) shipments forward (shipped/delivered) from the new page. That stays on the order page.
- A WhatsApp intake API or a courier portal.

## Inspected

- **Prompts:** `goreto-daraz-courier.md`, `goreto-whatsapp-orders-courier-handoff.md`; worklog §4.0 and Phase 13; `docs/couriers/daraz-qa.md`.
- **Order pages:** `src/app/(admin)/admin/orders/new/page.tsx`, `orders/[orderNumber]/page.tsx`, `src/app/(admin)/admin/daraz/page.tsx`, `daraz/labels/route.ts`.
- **Components:** `src/components/admin/manual-order/*` (`ManualOrderForm`), `daraz-shipment-panel.tsx` (`FeedbackDialog` and `SupportDialog`), `daraz-dashboard.tsx` (`SetupChecklist`), `courier-handoff-panel.tsx`, `settings-form.tsx`, `header-menus.tsx`.
- **Actions:** `src/features/admin/actions/{manual-orders,orders,daraz,system}.ts`.
- **Queries:** `queries/{daraz,orders,manual-orders,search}.ts`, `daraz-forms.ts`, `nav.ts`.
- **Courier library:** `src/lib/courier/{auto-book,provider-sync}.ts`, `src/lib/courier/daraz/booking.ts` (`defaultParcel`, `bookWithDaraz`).
- **SQL:**
  - `20260929090000_whatsapp_orders.sql`: `auto_courier_for_order`, `admin_accept_preview`, `admin_accept_order`, `create_order_core` auto-accept;
  - `20261007100000_daraz_courier_ops.sql`: `admin_update_provider_account`;
  - `20261007110000_daraz_tracking_autobook.sql`: booking reference, auto-book candidates.
- **Tests:** `tests/db/daraz.test.ts`, `src/components/admin/__tests__/{manual-order-form,daraz-shipment-panel}.test.tsx`.
- **Next docs:**
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`: every export of a `"use server"` file becomes a public Server Function;
  - `03-api-reference/04-functions/refresh.md`.

## Decisions and assumptions

1. **The routing rule is the existing one.** The courier comes from the delivery service on the order (website checkout, or the service picked in the form). If that courier is inactive, the store's fallback courier is used (`auto_courier_for_order`). The new code reads it through `admin_accept_preview` and doesn't copy it.
2. **Save and send = create, then accept, then route, all by the person who clicked.**
   - That person needs `orders.write`, the same right that accepts orders today, so nobody gains new power.
   - If WhatsApp auto-accept is already on, the order arrives accepted and the accept step is skipped.
   - Daraz is booked **synchronously**, so the tracking number shows straight away. This path doesn't use `after()`.
   - Daraz treats a repeated reference as the same booking, so a cron or auto-book run at the same moment can't create a second parcel.
3. **Partial failure keeps the order.** Create and accept are separate transactions. If accept or booking fails, the order is still saved, the success card says exactly which step needs attention, and the row in the list shows that step's button.
4. **One button prints the label and requests pickup.** On Send & track, **Print label & call pickup** opens the label PDF and marks the parcel Ready to ship in the same click.
   - A booking can still be canceled until Daraz picks the parcel up.
   - The order page keeps the two separate buttons.
5. **Usual parcel weight** is a new Daraz setting, `default_weight_grams` (1–100,000 g, empty by default, so today's behaviour is unchanged until it's set).
   - Booking takes the first weight available from: the weight typed in the form, then the shipment's saved weight, then the sum of the product weights, then the usual weight.
   - DEX weighs parcels at pickup, so this only sets the fee estimate and the declared weight.
6. **Autopilot is a view over the existing switches.** There's no new store column.
   - **On** sets auto-accept for website and WhatsApp, courier mode `auto`, and Daraz `auto_book`.
   - **Off** clears both auto-accepts and `auto_book`. Courier mode stays `auto`, because it only pre-fills the Accept dialog.
   - The card shows **On**, **Off**, or **Partly on** (naming which switches) when someone changed them one by one in Settings or Setup.
   - Changing it needs `settings.manage` and `delivery.manage` (the owner has both). Anyone else sees the state without the switch.
7. `/admin/orders/new` stays as it is: create only, waiting for acceptance. Both pages render the same `ManualOrderForm` with a `mode` prop.
8. **The list covers every courier**, not only Daraz, so it's the single place to follow parcels. The Daraz dashboard stays Daraz-only.

## Page design (`/admin/parcels`)

```
Send & track                                         [New order]
Type the order and press Send. Goreto accepts it, sends it to the right
courier and keeps tracking it here.

┌ Autopilot ────────────────────────────── Off · [Turn on] ┐   owner only
│ ✓ Daraz Express connected   ✓ Pickup details   ! 41 products have no weight
│ Usual parcel weight [ 500 ] g                            │
└──────────────────────────────────────────────────────────┘

┌ New order (opens on the button; the same form as WhatsApp orders) ┐
│ customer · items · address · delivery option · weight (Daraz only) │
│                                   [ Save and send to Daraz Express ]│
└────────────────────────────────────────────────────────────────────┘

✓ Order #GOR123456 sent to Daraz Express. Tracking NPDEX1001.
  [Print label & call pickup]  [Enter another order]

[Find a parcel: order number, phone, name or tracking number ][Search]
Open (12) · Delivered · All                          [Refresh tracking]

GOR123456 · Sita Rai · Pokhara-8 · Rs 2,499 COD · Daraz Express
 ●──●──○──○  Sent to courier · Booked 10:42, waiting for pickup
 "Package ready to be shipped" · 10:44        [Print label & call pickup]
```

**Each row shows:**

- order number (links to the order page), customer, municipality, COD total, courier;
- a four-step bar (Accepted → Sent to courier → On the way → Delivered) with plain words and times;
- the latest tracking event and "Expected by …";
- **one** next-step button.

**Next step**, decided by a pure function `parcelStep()`:

| State | Button / text |
| --- | --- |
| Pending (not accepted) | **Accept & send to {courier}** (the courier shown is the one the routing rule picks) |
| Daraz, not booked, Daraz connected | **Book with Daraz** (uses the weights described above) |
| Daraz, not booked, no Daraz keys | "Waiting for Daraz connection" |
| Daraz, not booked, no weight anywhere | "Add the parcel weight" → order page |
| Daraz booked, not ready to ship | **Print label & call pickup** |
| Daraz ready to ship | "Waiting for Daraz pickup" (+ text link **Print label again**) |
| Daraz needs action / exception | **Try again or return** (existing `FeedbackDialog`) |
| Other courier, accepted, not sent | **Send on WhatsApp** (prefilled `wa.me` link; records the handoff) or "Add {courier}'s WhatsApp number" |
| Other courier, sent | "Sent to {courier}" → order page for updates |
| With courier / out for delivery | "On the way" / "Out for delivery" |
| Delivered | "Delivered" (+ "Cash collected") |
| Returned / canceled | "Returned to store" / "Canceled" |

**Tracking stays fresh:**

- When the page opens, it refreshes up to 10 visible open Daraz parcels whose tracking is older than 15 minutes. It reuses `bulkDarazAction` with `refresh`, and shows "Checking Daraz for updates…".
- **Refresh tracking** does the same for every open Daraz parcel on the page (25 at most).

**Search** goes in `?q=` and works across all views: order number, customer name, phone digits and tracking number.

**States:**

- Empty: "No parcels yet. Press New order to send the first one."
- No search hits.
- Load error, through the admin error boundary.
- Without `orders.write`: read-only rows with no buttons and no New order.

## Files

**New**

- `src/app/(admin)/admin/parcels/page.tsx`: the page; `requireAdminAccess("orders.read")`.
- `src/components/admin/parcels/autopilot-card.tsx`: the card, checklist (reusing `SetupChecklist`), usual-weight field and switch.
- `src/components/admin/parcels/parcel-list.tsx`: the rows, step bar, next-step buttons, search, view links and refresh.
- `src/components/admin/parcels/send-result.tsx`: the success/partial card shown after **Save and send**.
- `src/components/admin/parcels/new-order-section.tsx`: the **New order** toggle that wraps `ManualOrderForm mode="send"`.
- `src/features/admin/parcels.ts` (pure): `parcelStep`, `parcelProgress`, `autopilotState`, `searchKind`.
- `src/features/admin/parcels.test.ts`.
- `src/features/admin/queries/parcels.ts`: `fetchParcels({ view, q, page })` and `fetchAutopilotStatus()`.
  - Orders come with their shipment, courier, purchased service and courier, handoff and latest event.
  - Tracking-number hits are found through a separate `shipments` lookup.
  - Items are fetched only for rows that need the WhatsApp message.
  - Two or three queries per page, with no N+1.
- `src/features/admin/actions/parcels.ts` (`"use server"`):
  - `sendNewOrderAction(values)`: `orders.write`; validates `sendParcelSchema`; calls `admin_create_order`, then `sendOrder`.
  - `sendOrderAction(orderId)`: **Accept & send** / **Book with Daraz** from a row.
  - `setAutopilotAction(formData)`: needs `settings.manage` and `delivery.manage`; updates `store_settings`, and calls `admin_update_provider_account` with `auto_book` and `default_weight_grams`.
- `src/features/admin/daraz-staff.ts` (`server-only`): `prepare`, `STAFF_OPS`, `bookOrder`, `readyOrder` and `refreshOrder`, moved out of `actions/daraz.ts` unchanged.
  - This lets both action files share them without turning them into public Server Functions.
- `src/features/admin/send-parcel.ts` (`server-only`): `sendOrder(orderId, { weightGrams? })`. It runs accept, then routing, then the Daraz booking or the WhatsApp link, and returns a typed outcome.
- `src/components/admin/__tests__/{parcel-list,autopilot-card,send-result}.test.tsx`.
- `supabase/migrations/20261007120000_parcel_default_weight.sql` (below).
- `docs/couriers/send-and-track.md`: a one-page, plain-language guide for the client (daily routine, what Autopilot does, what to do when a row asks for something).

**Changed**

- `src/components/admin/manual-order/manual-order-form.tsx`:
  - new `mode: "create" | "send"` prop, plus `darazServiceIds` and `defaultWeightGrams`;
  - in send mode, a "Parcel weight (g)" field appears only when the chosen service's courier is Daraz. The placeholder is "Auto: N g" from item weights or the usual weight;
  - the button reads **Save and send to {courier}**;
  - on success it calls `onSent(outcome)` instead of redirecting, then resets.
- `src/features/admin/manual-order-forms.ts`: `sendParcelSchema` = `manualOrderSchema` + optional `weightGrams` (integer, 1–100,000).
- `src/features/admin/queries/manual-orders.ts`: `OrderVariantOption.weightGrams` (from `product_variants.weight_grams`) for the "Auto" preview.
- `src/features/admin/actions/daraz.ts`: imports the moved helpers. Behaviour is unchanged.
- `src/lib/courier/daraz/booking.ts`:
  - `defaultParcel` falls back to `settings.default_weight_grams`;
  - it takes an optional weight override;
  - the missing-weight message mentions the usual weight. Auto-book in `provider-sync.ts` benefits automatically.
- `src/components/admin/daraz-shipment-panel.tsx`: export `FeedbackDialog`; the Book dialog pre-fills the usual weight when the products have none.
- `src/components/admin/daraz-dashboard.tsx` and `daraz/page.tsx` (Setup): a "Usual parcel weight" field in booking defaults.
- `src/features/admin/daraz-forms.ts`: `defaultWeightGrams` in `darazSettingsSchema`.
- `src/features/admin/nav.ts`:
  - **Send & track** becomes the first item in Sales (`orders.read`);
  - new icon `PaperPlaneTiltIcon` in `src/components/ui/icons.ts` and the sidebar icon map;
  - the Quick Actions menu gets "Send a parcel".
- `src/types/database.ts`: regenerated with `npm run db:types`, never hand-edited.
- `tests/db/daraz.test.ts`: the new column and patch key.
- `worklog.md` (Phase 14) and `docs/couriers/daraz-qa.md` (a short pointer to the guide).

## Database

Migration `20261007120000_parcel_default_weight.sql`:

- `alter table courier_provider_accounts add column default_weight_grams integer check (default_weight_grams is null or default_weight_grams between 1 and 100000);`
- Recreate `admin_update_provider_account` (copied from `daraz_courier_ops`) with `default_weight_grams` added to the key allowlist and its `set` clause. `null` clears it.
- Re-apply `revoke … from public, anon` and `grant … to authenticated` on the function.
- The table keeps its table-level grants: staff read through RLS, and writes go only through the RPC.
- No data changes. Rollback: drop the column and recreate the previous function body.
- Order of work:
  1. `npm run test:db`.
  2. `npm run db:push` to **dev** (dry run first).
  3. `npm run db:types`.
- Prod waits for the Daraz release (`docs/releasing.md`).

## Auth, RLS and security

- No RLS changes. Every action re-checks permission in TypeScript, and every RPC checks it again in SQL:
  - `admin_create_order`, `admin_accept_order` and `admin_*` booking RPCs need `orders.write`;
  - the store settings update needs `settings.manage` (RLS);
  - `admin_update_provider_account` needs `delivery.manage`.
- Prices, COD amounts and addresses are always re-read on the server. The browser sends only the form values and an optional weight.
- The moved Daraz helpers live in a `server-only` module, so none of them becomes a public Server Function.
- No new service-role importers. Synchronous booking runs on the staff member's session.
- The `wa.me` message is built on the server from the order snapshot, as on the order page.

## Acceptance criteria

1. **Daraz order in one click.** A staff member with `orders.write` fills the form with a Daraz service and presses **Save and send to Daraz Express**.
   - The order is accepted, assigned to Daraz Express and booked, and the tracking number appears on the same page without leaving it.
   - The new row is at the top of Open, showing **Print label & call pickup**.
2. **Other couriers.** With a non-Daraz service, the same click accepts the order and assigns that courier. The result card and row show **Send on WhatsApp**. Tapping it opens the prefilled message and records the handoff.
3. **Label and pickup.** **Print label & call pickup** opens the PDF, and the row moves to "Waiting for Daraz pickup".
4. **Failures.** If Daraz is unreachable, not set up, or has no weight, the order stays saved and accepted. The card names the exact problem, and the row offers the matching step.
5. **Pending orders.** A pending website order shows **Accept & send to {courier}**, and one click accepts it and books or routes it.
6. **Search.** Searching a phone number, name, order number or tracking number finds the parcel. The view is shareable (`?q=`).
7. **Autopilot on.** With Autopilot on, a website checkout and a WhatsApp order both arrive accepted and routed, and Daraz ones are booked automatically.
   - Products with no weight use the usual weight.
   - **Off** stops auto-accept and auto-book.
   - **Partly on** is shown when the four switches disagree.
8. **Permissions.**
   - A user with `orders.read` only sees the list without buttons.
   - The Autopilot switch needs `settings.manage` and `delivery.manage`.
   - A customer gets a 404.
9. Existing pages behave as before: `/admin/orders/new`, the order page panel and the Daraz dashboard.
10. Accessibility and design:
    - keyboard reachable, with labelled controls;
    - status shown with words, not just colour;
    - one primary button per row;
    - design-system tokens and primitives only;
    - works at 375 px.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`.
- `npm run build` with the dev env loaded (`set -a; . ./.env.local; set +a; npx next build`).
- **Unit:**
  - `parcelStep` for every state in the table;
  - `parcelProgress`;
  - `autopilotState` (on, off, partly);
  - `searchKind`;
  - `sendParcelSchema`;
  - `defaultParcel` weight order (form, then shipment, then products, then usual, then none).
- **Component:**
  - send mode: the button label, and the weight field only for Daraz services;
  - the result card for each outcome;
  - row buttons per state;
  - the read-only list;
  - Autopilot card states and the hidden switch without permission.
- **DB:**
  - `default_weight_grams` accepted, cleared and range-checked through the patch RPC;
  - unknown keys still refused;
  - customer and anon still denied.

## Manual test (mock Daraz: `npm run daraz:mock`, `DARAZ_API_URL=http://localhost:4010`)

1. Sign in as the owner, then open **Sales › Send & track**.
2. In the Autopilot card, set the usual weight to 500 g. Leave Autopilot off.
3. **New order:** a product without a weight, a Kathmandu address, the Daraz Express service. Press **Save and send to Daraz Express**.
   - Expect the success card with a tracking number, and the row at the top of Open.
4. Click **Print label & call pickup**. The PDF opens and the row says "Waiting for Daraz pickup".
5. Click **Refresh tracking** twice. The mock moves one step per history call, and the row shows "On the way".
6. Fail the parcel (`/mock/fail/<tracking>`), refresh, choose **Try again or return › Try again**, and refresh until it shows Delivered.
7. A new order with a non-Daraz service: the card shows **Send on WhatsApp**, which opens WhatsApp with the message.
8. Search the customer's phone number. Only that customer's parcels show.
9. Turn **Autopilot on**. Place a website checkout with the Daraz service. Within seconds the row appears already booked.
10. Turn it off. A new website order shows **Accept & send**.
11. Sign in as staff with `orders.read` only. The list is read-only and there's no Autopilot switch.
12. Check the page at 375 px wide.

## Rollback

- UI: remove the `/admin/parcels` route and the nav item. The existing flows are untouched.
- Data: the migration only adds a nullable column, so it's safe to leave in place.
- Autopilot only writes existing settings, which can be reset in Settings and Daraz › Setup.

## Implementation notes (2026-10-07)

_Approved: "Yes, build both". These are the small deviations from the plan above._

- **Weight argument.** The parcel weight is not part of a `sendParcelSchema`. It goes to `sendNewOrderAction(values, weight)` as a separate argument, validated with `optionalGramsSchema`, so the shared form schema and `/admin/orders/new` stay unchanged.
- **Autopilot visibility.** The Autopilot card and the header chip are shown only to people who can change them (`settings.manage` + `delivery.manage`). Staff with only `orders.read` can't read the Daraz settings row through RLS, so their view would misreport the state.
- **Returned parcels** stay under Open with **Open the order**, so staff cancel the order and restock.
- **Icons and quick action.** Daraz Express now uses a van icon (`VanIcon`, added to `icons.ts`), so Send & track can use the paper plane. Quick actions gained "Send a parcel" (`/admin/parcels?new=1`, which opens the form).
- **Book dialog.** `FeedbackDialog` was split, and the dialog itself is exported as `FailedDeliveryDialog`, so the list rows reuse it.
- **Signed-in browser pass not done.** No browser tools were available. The checks that ran:
  - typecheck and lint;
  - unit tests: 779, all passing with `--testTimeout=20000`. With the default timeout, two geocode tests time out only under full-suite load and pass on their own;
  - DB tests: 354;
  - a dev build;
  - a signed-out request to `/admin/parcels`, which gets a 307 to sign-in.

## Follow-up: "There's no Daraz Express option" (2026-10-07)

**Report.** The delivery options were only Nepal Can Move, Goreto Valley Riders and Pathao.

**Cause.** The options come from the delivery rates of the zones that cover the address. Dev has no courier named "Daraz Express". During the earlier Daraz QA, the "Booked through the Daraz Express API" switch was turned on for the seed courier **Nepal Can Move**:

- it has 2 services, with rates in Kathmandu Valley, Major Cities and Rest of Nepal;
- 4 mock bookings were made through it.

So choosing Nepal Can Move already books Daraz, but nothing on screen says so. The seed file still has Nepal Can Move as a manual courier, so this was a hand change on dev.

**Fix.**

1. **Code, for every environment.** In send mode, every delivery option whose courier books through the Daraz API gets a visible tag, "Books through Daraz Express". A Send & track row for an API courier says "Daraz Express" next to the courier name when the names differ. The client then sees where a parcel goes, whatever the courier is called.
2. **Dev data, chosen by the user.** Either:
   - rename that courier to "Daraz Express", which keeps its rates and test bookings; or
   - add a separate "Daraz Express" courier with services and rates, and switch Nepal Can Move back to a normal WhatsApp courier.
3. **Production.** The client adds "Daraz Express" under Delivery & Courier, ticks the API switch, and adds rates for its services in each zone. Without rates, checkout and Send & track can't offer it. This is a manual step, listed in the report.

## Resume here (handoff, 2026-10-07)

**State.** Both parts are built and verified:

- typecheck and lint pass;
- 780 unit tests pass with `--testTimeout=20000`;
- 354 DB tests pass;
- the dev build passes.

All of it is **uncommitted** on `feat/daraz-courier`, together with the earlier Daraz work.

**Applied to hosted dev** (not prod):

- migration `20261007120000_parcel_default_weight`, with `src/types/database.ts` regenerated;
- courier "Nepal Can Move" (the Daraz API courier) renamed to **Daraz Express**, slug `daraz-express`. This is a direct data change and isn't in `seed.ndjson`.

**New files:**

- the page, `src/app/(admin)/admin/parcels/page.tsx`;
- components in `src/components/admin/parcels/`: `send-desk.tsx`, `send-result.tsx`, `parcel-list.tsx`, `parcel-actions.tsx` and `autopilot-card.tsx`;
- logic and data in `src/features/admin/`: `parcels.ts`, `queries/parcels.ts`, `actions/parcels.ts`, `send-parcel.ts`, `daraz-staff.ts` and `manual-order-create.ts`;
- tests: `src/features/admin/parcels.test.ts`, `src/components/admin/__tests__/parcels.test.tsx` and `src/lib/courier/daraz/booking.test.ts`;
- the client guide, `docs/couriers/send-and-track.md`.

**Still to do:**

1. **Signed-in browser pass.** Follow "Manual test" above, with `npm run daraz:mock` and `npm run dev`.
2. **Commit and PR** `feat/daraz-courier` once the browser pass is done.
3. **Production setup:**
   - apply the Daraz migrations, including this one (`docs/releasing.md` § Daraz Express);
   - add a "Daraz Express" courier with the API switch on, a Standard or Economy option on each service, and rates in each zone.
4. **Optional, dev only:** a Kathmandu Valley rate for Daraz Express "Standard Delivery". Today only "Pickup Point" has a rate there.
