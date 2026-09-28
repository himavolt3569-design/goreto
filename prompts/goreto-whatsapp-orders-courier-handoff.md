# WhatsApp orders → admin acceptance → courier handoff

_Status: approved 2026-09-27 (with the auto-accept addition), implemented · Branch: `feat/whatsapp-orders` from `feat/cart-checkout`_

## Goal

Worklog §4.0 (client's top priority). Staff key WhatsApp orders into the admin panel. Every new pending order (WhatsApp or website) raises a live notification for the owner and for staff with `orders.read`. The order stays with the store until the owner, or a staff member with `orders.write`, **accepts** it. Only then is a courier assigned (auto or manual mode) and the order handed to that courier through a WhatsApp click-to-send (`wa.me`) link.

Client decisions recorded in worklog §4.0 (2026-09-25 and 2026-09-27):
- WhatsApp only. Intake is manual entry.
- Couriers are any Nepali courier, with no courier APIs.
- The courier-on-accept mode (auto or manual) is chosen by the owner in Settings.
- The courier is notified by a `wa.me` link first. The courier portal comes in a later phase.

Added on plan review (2026-09-27):
- **Auto-accept** is an owner setting. When it's on, a new order (website or WhatsApp) is accepted and assigned a courier automatically, with no person involved.
- The courier channel stays **`wa.me`** for now. After auto-accept, the order is "Ready to send" and the bell prompts staff to tap Send. Fully automatic delivery to the courier waits for the courier-portal phase.

## Non-goals

- No WhatsApp Business / Meta Cloud API, and no automatic intake. No Instagram, Facebook or TikTok.
- No courier portal, `courier` role or courier login (the later phase in worklog §4.0 option 2).
- No courier API integrations or webhooks, and no fake delivery confirmation. The app records only that staff **opened** the WhatsApp link, never that the message was delivered.
- No browser push notifications or service worker. A short sound is included, turned off by default (see Notifications).
- No sending the customer a tracking link for WhatsApp orders. That's a possible follow-up; the customer can still be told the order number.
- No editing an order after it's created (items, address). Staff reject it and enter a new one.
- No rate limiting on the storefront `place_order` (a known limit carried forward).

## What I read

- AGENTS.md §4.6, §4.8, §7, §9.2, §10.2, §10.7, §11.7–11.9, §12, §15.3, §16, §18.7, §26.3–26.5. CLAUDE.md. worklog.md §4.0.
- Prompts: `goreto-cart-checkout-confirmation.md` (the `place_order` core, snapshots, tracking), `goreto-admin-panel.md` (the state machine, bell counts), `goreto-admin-coupons-delivery.md` (couriers).
- Next docs: `02-guides/server-actions.md` (actions are public endpoints; `refresh()` vs `redirect`), `02-guides/forms.md`, `02-guides/interactive-apps.md`.
- Migrations:
  - `orders` (schema and RLS);
  - `foundation` (`store_settings`, `has_permission`, `staff_permissions`);
  - `delivery_promotions` (`couriers`);
  - `harden_grants`;
  - `admin_operations` (`admin_transition_order`, `admin_assign_courier`, `admin_attention_counts`);
  - `checkout_place_order` (`checkout_price`, `place_order`).
- Code:
  - `src/features/admin/{actions/orders.ts, actions/helpers.ts, actions/system.ts, order-transitions.ts, queries/orders.ts, auth.ts, nav.ts, schemas.ts, delivery-forms.ts}`;
  - `src/components/admin/{order-actions.tsx, header-menus.tsx, admin-shell.tsx, settings-form.tsx, courier-form.tsx, product-picker.tsx}`;
  - `src/app/(admin)/admin/{layout.tsx, orders/[orderNumber]/page.tsx}`;
  - `src/features/checkout/{actions.ts, schemas.ts}`;
  - `src/components/store/checkout/{address-section.tsx, delivery-section.tsx}`;
  - `src/features/delivery/nepal-address.ts`, `src/lib/supabase/{server.ts, boundaries.test.ts}`, `src/lib/validation/phone.ts`;
  - `tests/db/{harness.ts, admin.test.ts, checkout.test.ts}`.
- `node_modules/@supabase/realtime-js`: RealtimeClient calls the `accessToken` callback on connect and on every heartbeat, so a short-lived Clerk token is refreshed without extra code.

## Decisions

### 1. One order core for both channels (SQL)

- `place_order`'s body moves into a private `create_order_core(...)`. It takes the same inputs plus `p_user_id`, `p_channel`, `p_whatsapp_e164` and `p_created_by`.
  - It keeps the pricing (`checkout_price`), locks, stock decrement, coupon counter, snapshots, shipment and first event exactly as they are today.
  - `place_order` keeps its signature and behaviour. It calls the core with `current_profile_id()` and channel `website`. The existing checkout tests guard this.
- New `admin_create_order(...)` (security definer) calls the same core.
  - It needs `orders.write`, checked in SQL.
  - The channel is `whatsapp` and the status is always `pending_confirmation`, so the accept step always happens.
  - `user_id` is the **linked customer**, never the staff member. Linking a customer needs `customers.read` too, and the target must be an active `customer` profile.
  - The browser still sends only variant ids, quantities, address codes, a service id, a coupon code and contact details. It never sends prices.
- New `admin_order_quote(...)` gives the same preview for the form. It needs `orders.write` and uses the linked customer for per-customer coupon limits.
- `cod_enabled` and `cod_max_order_paisa` apply to WhatsApp orders too, because they are COD orders. If the owner pauses COD, manual entry is paused as well, and the form says why.

### 2. Schema (one migration: `20260929090000_whatsapp_orders.sql`)

- `order_channel` enum: `website`, `whatsapp`. It can grow later.
- New `orders` columns:
  - `channel` (default `website`);
  - `whatsapp_e164` (nullable, E.164 check);
  - `accepted_at` and `accepted_by` (FK to profiles);
  - `canceled_by` (FK to profiles);
  - `created_by` (the staff member who keyed the order in).
- `orders.contact_email` becomes **nullable**, because WhatsApp customers often have no email. A check still requires it for `channel = 'website'`, so the storefront is unchanged.
- Backfill: `accepted_at = confirmed_at` for orders already past pending. `accepted_by` stays null, which the page shows as "before acceptance tracking".
- `orders.accepted_via` enum `staff | auto`: null until accepted, `auto` when the store setting accepted it (with `accepted_by` null).
- `store_settings` gets four columns:
  - `courier_assignment_mode` enum `auto | manual`, default **`manual`**. It decides what happens when a **person** accepts.
  - `default_courier_id`, the auto-rule fallback (FK to couriers, `on delete set null`).
  - `auto_accept_website_orders` and `auto_accept_whatsapp_orders` (boolean, default **off**). They're one switch per channel, so the owner can, for example, auto-accept WhatsApp orders staff have already checked while still reviewing anonymous website orders.
- `couriers.dispatch_whatsapp_e164`: nullable, with an E.164 check. It's the courier's dispatch contact, not a secret.
- `notifications` table, **one row per recipient**:
  - columns: `recipient_id`, `kind` (`order_pending`), `order_id` (cascade), `title`, `body`, `href`, `created_at`, `read_at`;
  - RLS: select, and update of `read_at` only, where `recipient_id = current_profile_id()` **and** `has_permission('orders.read')`, so revoking the permission hides old rows too;
  - no insert or delete for any user-context role;
  - grants follow `harden_grants`.
- `courier_handoffs` log:
  - columns: `order_id`, `shipment_id`, `courier_id`, `channel` (`whatsapp_link`; `portal` comes later), `status` (`pending | sent | superseded`), `attempts`, `first_sent_at`, `last_sent_at`, `last_sent_by`, timestamps;
  - a partial unique index allows **one active (non-superseded) handoff per order**;
  - staff with `orders.read` can read it; writes happen only through definer functions and triggers.
  - There's no error column, because a `wa.me` link can't report failure. The portal phase can add one when there's something real to record.
- Realtime: the migration adds `notifications` to the `supabase_realtime` publication if that publication exists. It's guarded, so PGlite skips it.

### 3. Notifications

- `create_order_core` calls a private `notify_new_order(order_id)` **at its end, after any auto-accept**, so the notification describes the order's real state. It inserts one row for the owner and for each active staff member with `orders.read`.
  - It's an explicit call rather than an insert trigger. That way seed loads and scripts that insert orders directly don't flood the bell, and an auto-accepted order isn't first announced as pending.
  - `order_pending`: "New WhatsApp order #GT…" or "New website order #GT…", with the customer name and COD total. If auto-accept was on but found no courier, the body says "Couldn't auto-accept: no courier matches. Accept it by hand."
  - `order_auto_accepted`: "Auto-accepted #GT… → Pathao. Ready to send to the courier."
- Notifications are marked read for everyone when their work is done, so the count stays "things waiting for someone":
  - `order_pending`: when the order leaves `pending_confirmation` (an `after update of status` trigger);
  - `order_auto_accepted`: when the first courier handoff is sent, or the order is canceled.
- The bell merges today's attention counts with a **"New orders" feed**: the latest 20, unread first, with time, a link to the order, "Mark all read", and clicking an item marks it read.
- For live updates, a client component subscribes to `postgres_changes` on `notifications` filtered by `recipient_id`. RLS applies to Realtime as well.
  - On any change, it refetches the feed through a server action, so the feed and count always come from the database and never from the event payload.
  - It also refetches when the window regains focus, and polls every 60 s if the Realtime channel errors or times out.
  - A polite `aria-live` message announces "New WhatsApp order #…".
- Sound: an optional short chime generated with Web Audio (no audio file). A toggle in the bell turns it on, it's remembered in `localStorage`, and it's off by default.
- The browser Supabase client is `src/lib/supabase/browser.ts`. It uses the anon key plus Clerk `useSession().getToken()` through `accessToken` (AGENTS §9.4), with no service role and no cookies. `boundaries.test.ts` is updated to allow exactly this one client-side file and to assert that it never references a service key.

### 4. Accept and reject

- `admin_accept_order(p_order_id, p_courier_id default null)` is security definer and checks `orders.write` in SQL. It locks the order first.
  - **Idempotent.** An order already accepted returns its current state with no new events. A canceled order raises "already rejected".
  - **Courier resolution:**
    - with `p_courier_id`, that courier is used, and it must be active;
    - otherwise, in **auto** mode, the courier comes from the order's purchased service if that courier is active, then `default_courier_id` if active;
    - otherwise it raises `accept:courier_required`, and the dialog asks staff to pick one;
    - in **manual** mode `p_courier_id` is required.
  - It sets `confirmed`, `confirmed_at`, `accepted_at` and `accepted_by`, assigns the shipment's courier (keeping the purchased service when the courier offers it, as `admin_assign_courier` does), and appends the "Order accepted" and "Assigned to X" shipment events.
- `admin_transition_order` is recreated with two changes:
  - it **refuses `pending_confirmation → confirmed`** ("Use Accept"), so every confirmed order goes through acceptance;
  - it records `canceled_by`.
- **Reject** is the existing cancel from pending: a reason is required, stock is restocked, and payment is marked failed. The UI labels it "Reject order" while the order is pending.
- A trigger on `shipments` (after insert or update of `courier_id`, on an accepted order) supersedes the active handoff and opens a new `pending` one. So "Change courier" after acceptance means the new courier has to be notified, and the old link disappears.
- UI:
  - pending orders show **Accept order** and **Reject order** in "Next steps";
  - in auto mode, the Accept dialog names the courier the rule picked ("Pathao, from the customer's chosen service"); if nothing matches, it shows the courier select;
  - in manual mode, the dialog always requires the courier select.

### 4b. Auto-accept

- Auto-accept runs **inside `create_order_core`, in the same transaction** as the order, for both `place_order` (website) and `admin_create_order` (WhatsApp), when that channel's switch is on.
- It always uses the **automatic courier rule**, whatever `courier_assignment_mode` is set to: the purchased service's courier if active, else the default courier if active.
  - If a courier is found, the order becomes `confirmed` with `accepted_via = auto`. It gets the same courier assignment, a pending handoff, and "Order accepted" and "Assigned to X" events as a manual accept. All of it shares one private `accept_order_core` with `admin_accept_order`, so the rules can't drift.
  - If no courier is found, the order is still created, stays `pending_confirmation`, and the notification says why. **Placing an order never fails because of auto-accept.**
  - _Found while coding:_ at order time this branch can't really happen. Checkout and manual entry only offer services whose courier is active, and that courier is the rule's first choice. The branch stays as a safety net. The default courier matters for **manual** accepts later, for example when the purchased service's courier was turned off while the order waited.
- The courier is still reached by the `wa.me` button: a person taps Send. The order page shows "Accepted automatically · Ready to send to Pathao", and the bell keeps the order unread until it's sent.
- Settings copy says this plainly, for example: "Orders are accepted and a courier is assigned automatically. You still tap Send to pass the order to the courier on WhatsApp."
- The manual-entry submit button reads "Create and accept order" when WhatsApp auto-accept is on.
- The storefront shows the truth. An auto-accepted website order's confirmation page shows "Confirmed" right away, with the "Order accepted" event.

### 5. Courier handoff (only after acceptance)

- `src/features/orders/courier-handoff.ts` (pure, tested) builds the message server-side:
  - store name, order number, recipient, phone, full address snapshot, delivery service, **COD amount to collect**, and item lines (title, variant, qty);
  - no email and no internal notes.
  - It then builds `https://wa.me/<digits>?text=<encoded>`.
- The order page renders the **Courier handoff** panel only when:
  - the order is accepted;
  - its status is `confirmed`, `processing` or `packed`;
  - a courier is assigned.
  - Before acceptance, no link or message is built at all.
- Panel states:
  - **Not sent:** "Send to Pathao on WhatsApp", plus "Copy message".
  - **Sent:** "Sent 10:42 by Anita · 2 attempts", plus "Send again".
  - **No WhatsApp number:** a warning linking to the courier's edit page, and "Copy message" so staff can send it another way.
- Clicking the link opens WhatsApp in a new tab and calls `recordCourierHandoffAction`, which runs `admin_record_courier_handoff(order_id)`.
  - It needs `orders.write`.
  - It refuses orders that aren't accepted or have no courier.
  - It upserts the active handoff: `status = sent`, attempts + 1, sent times and sender.
  - Only the **first** send appends a shipment event ("Order details sent to Pathao."). Resends add nothing to the timeline, which keeps retries safe.
- Couriers page and form: a new "Dispatch WhatsApp number" field, a Nepal number stored as E.164.

### 6. Manual WhatsApp order entry (`/admin/orders/new`, `orders.write`)

- It's one sectioned client form: React Hook Form + Zod, with the same Zod schema parsed again in the action.
  1. **Customer.**
     - Name and phone (+977 prefix, libphonenumber).
     - WhatsApp number: "Same as phone" is ticked by default.
     - Email is optional.
     - "Link existing customer" is a search shown only to staff with `customers.read`. It prefills name, phone and email.
  2. **Items.**
     - Search products (reusing `ProductPicker`'s pattern), then pick a variant and a quantity.
     - Each line shows the server price and stock from the quote.
     - Up to 20 lines, and up to 10 per line (same limits as the cart).
  3. **Address.** Province → District → Municipality → Ward, street/landmark, postal code. No geolocation, because staff aren't at the customer's location.
  4. **Delivery.** The services the quote offers for that address, with real fees and day ranges.
  5. **Coupon (optional) and note.**
- The **summary** shows subtotal, discount, delivery and **COD total**, always from `admin_order_quote`. It's labelled "Calculated by the server".
- On submit, `createManualOrderAction` calls `admin_create_order` and then **redirects to `/admin/orders/[orderNumber]`**. The order is pending there, with Accept and Reject visible. Errors like stock changes, unavailable delivery or a bad coupon come back through the checkout error map.
- To share UI without forking: the Province/District/Municipality/Ward cascade is extracted from the checkout `AddressSection` into `src/components/delivery/nepal-address-fields.tsx` (AGENTS §19). Checkout keeps its location button and map around it, and the existing checkout tests must still pass.
- Entry points:
  - a "New WhatsApp order" button on `/admin/orders`;
  - a Quick Actions item;
  - both shown only with `orders.write`.

### 7. Admin list, detail and settings changes

- **Orders list:**
  - a channel badge (WhatsApp shows the Phosphor `WhatsappLogo` icon plus text, never icon alone);
  - a `?channel=` filter;
  - email may be empty.
- **Order detail:**
  - channel, the WhatsApp number (a `wa.me` link to message the customer), "Entered by", "Accepted by / at" and "Rejected by";
  - the stepper labels step 2 "Accepted" in admin.
  - Staff names come from a new definer function, `admin_staff_names(ids)`. It needs admin access and returns names for owner and staff profiles only, because staff without `customers.read` can't read `profiles`.
- **Settings:** a new "Order acceptance & couriers" card, which needs `settings.manage`:
  - **Auto-accept new orders:** two switches, "Website orders" and "WhatsApp orders", each with a one-line explanation;
  - **When someone accepts:** Auto or Manual courier choice, as a radio group;
  - a default courier select (active couriers), used by auto-accept and by Auto mode;
  - a warning when auto-accept is on but no default courier is set: "Orders whose delivery service has no active courier will wait for a person."
- **Order detail:** "Accepted automatically" (with the time) when `accepted_via = auto`.
- **Storefront:** unchanged. The tracking page already shows "Confirmed" when the order is accepted, and the "Order details sent to courier" event appears in its timeline, which is true.

## Files expected to change

New:
- `supabase/migrations/20260929090000_whatsapp_orders.sql`
- `tests/db/whatsapp-orders.test.ts`
- `src/lib/supabase/browser.ts`
- `src/features/orders/courier-handoff.ts` (+ `.test.ts`)
- `src/features/admin/manual-order-forms.ts` (+ `.test.ts`)
- `src/features/admin/actions/manual-orders.ts` (quote, create, customer search, variant search)
- `src/features/admin/actions/notifications.ts` (feed, mark read, mark all read)
- `src/features/admin/queries/notifications.ts`
- `src/features/admin/notifications.ts` (feed view model and mapping, + test)
- `src/app/(admin)/admin/orders/new/page.tsx`
- `src/components/admin/manual-order/*` (form, customer, items, address, delivery, summary; + tests for item lines, "same as phone" and summary states)
- `src/components/admin/notifications-menu.tsx` (+ test; replaces `NotificationsMenu` in `header-menus.tsx`)
- `src/components/admin/accept-order.tsx` (accept and reject dialogs, + test for auto/manual/fallback)
- `src/components/admin/courier-handoff-panel.tsx` (+ test for states)
- `src/components/delivery/nepal-address-fields.tsx`

Changed:
- `tests/db/admin.test.ts`: confirm now goes through accept; new transition guard.
- `src/lib/supabase/boundaries.test.ts`
- `src/features/admin/{order-transitions.ts, actions/orders.ts, actions/system.ts, actions/delivery.ts, queries/orders.ts, queries/system.ts, queries/delivery-editor.ts, queries/dashboard.ts, schemas.ts, delivery-forms.ts}` (+ existing tests)
- `src/components/admin/{order-actions.tsx, header-menus.tsx, admin-shell.tsx, settings-form.tsx, courier-form.tsx}`
- `src/app/(admin)/admin/{layout.tsx, orders/page.tsx, orders/[orderNumber]/page.tsx, settings/page.tsx}`
- `src/components/store/checkout/address-section.tsx` (uses the extracted fields)
- `src/components/ui/icons.ts` (`WhatsappLogoIcon`, plus any others needed)
- `src/types/database.ts`: regenerated with `npm run db:types`, never hand-edited
- `worklog.md`: tick off §4.0

## Database / RLS impact

- One migration. It adds columns (all nullable or defaulted), enums (channel, acceptance source, courier mode, notification kind, handoff status and channel) and 2 tables.
  - It recreates `place_order` (same signature) and `admin_transition_order`.
  - New functions: `create_order_core`, `accept_order_core`, `notify_new_order`, `admin_create_order`, `admin_order_quote`, `admin_accept_order`, `admin_record_courier_handoff`, `admin_staff_names`.
  - New triggers: notifications read on leaving pending, and handoff on courier change.
- **Auto-accept is off by default**, so behaviour doesn't change until the owner turns it on.
- The backfill touches only `orders.accepted_at` on already-confirmed rows.
- `contact_email` drops `NOT NULL` behind a channel check, so website orders still require it.
- New grants are explicit per `harden_grants`:
  - `notifications`: select, and update(`read_at`), to authenticated;
  - `courier_handoffs`: select to authenticated;
  - new functions: execute to authenticated only;
  - `create_order_core`: no grants (internal).
  - `anon` gets nothing new.
- **Rollback:**
  - drop the new functions, triggers, tables and columns;
  - restore the previous `place_order` and `admin_transition_order` bodies from their migrations;
  - WhatsApp orders without an email would first need a placeholder or deletion before restoring `NOT NULL`. Because of this, rollback is only realistic on dev.
- **Apply:** run `npm run test:db`, then `npm run db:push` (hosted dev), then `npm run db:types`.

## Security checklist

- Accept, reject, create and handoff are each checked in SQL (`orders.write`) and again in the action (`authorizeAndParse`). RLS is the last guard.
- Staff never become the order's customer: `user_id` is only a linked customer profile, and linking needs `customers.read`.
- Prices, fees, discounts and totals come only from `checkout_price`.
- Nothing reaches a courier before acceptance: the message is built server-side only for accepted orders, and the record function refuses otherwise.
- The courier message holds only what delivery needs. There's no email and no internal data.
- Notifications are only visible to their recipient while that recipient holds `orders.read`. Realtime can't widen this, because it applies the same RLS, and the feed is refetched from the DB anyway.
- The browser client uses the anon key and a Clerk token only.

## UI references and constraints

- There's no screenshot for these screens. They're built from the Design System and the existing admin patterns (`goreto-admin.png`): `Panel`, `FormDialog`, `ActionForm`, `Field`/`Input`/`Select`, and the status pills.
- The notification menu keeps the current bell styling and menu popover.
- Tokens only. Phosphor icons come through `icons.ts`. Controls are 44 px with visible focus. Statuses and channels always have text. Dialogs trap focus.
- The chime is off by default and never plays without a user gesture having enabled it. Motion respects reduced-motion.

## Acceptance criteria

1. Staff with `orders.write` can enter a WhatsApp order.
   - Prices, delivery fee and total come from the server.
   - It's saved as `pending_confirmation`, channel `whatsapp`, with the WhatsApp number, and links to a customer only when one was chosen.
2. Staff without `orders.write` don't see "New WhatsApp order", and the page and action refuse them.
3. A new WhatsApp or website order appears in the bell of the owner and of `orders.read` staff **without a page reload**. A customer, or staff without `orders.read`, gets nothing.
4. Clicking a notification opens the order and marks it read. Accepting or rejecting clears it for everyone.
5. A pending order can't be confirmed through the old "Confirm" transition, only through Accept.
6. **Auto mode:** Accept picks the purchased service's courier, then the default courier. With neither available, the dialog asks for a courier.
7. **Manual mode:** Accept requires choosing a courier.
8. Accept records who and when. Pressing it twice creates no duplicate events.
9. Reject requires a reason, restocks, and records who rejected it.
10. The "Send to courier on WhatsApp" button appears only after acceptance with a courier. It opens `wa.me` with the prefilled message, and the first click adds one timeline event. "Send again" increments attempts only.
11. Changing the courier after acceptance resets the handoff to "Not sent" for the new courier.
12. The owner can switch the courier mode, default courier and both auto-accept switches in Settings. Staff without `settings.manage` can't.
13. **Auto-accept on** for a channel:
    - a new order on that channel is created already `confirmed`, marked "Accepted automatically", with the courier assigned by the rule and "Ready to send" shown;
    - the bell shows "Auto-accepted … ready to send" until the handoff is sent.
14. Auto-accept on but no courier matches: the order is still created, waits as pending, and the notification explains why. This is defensive only: an order can only be placed with an active courier's service (see 4b).
15. Auto-accept off: orders wait for a person, as in criteria 5–9.
16. The storefront checkout, confirmation and tracking behave as before. An auto-accepted website order simply shows "Confirmed" immediately.

## Checks to run

```bash
npm run typecheck
npm run lint
npm test
npm run test:db       # includes new tests/db/whatsapp-orders.test.ts and the updated admin tests
npm run build
npm run db:push       # hosted dev, after test:db passes
npm run db:types
```

`tests/db/whatsapp-orders.test.ts` covers:
- `admin_create_order`:
  - `orders.write` is required;
  - totals are computed server-side, since the signature has no price inputs;
  - channel, status and WhatsApp number are saved;
  - email is optional for WhatsApp but still required for the website;
  - linking needs `customers.read` and a customer profile;
  - staff are never set as `user_id`;
  - stock is decremented.
- `place_order` is unchanged (the existing checkout suite passes).
- Notifications:
  - fan-out to the owner and `orders.read` staff only;
  - a customer and `orders.read`-less staff see none;
  - a recipient sees only their own;
  - only `read_at` is updatable;
  - no insert or delete;
  - accept and reject mark them read.
- Accept:
  - auto via the service courier, the default fallback, and courier required;
  - manual requires a courier;
  - an inactive courier is refused;
  - idempotent;
  - refused on canceled orders and without `orders.write`;
  - the old confirm transition is refused.
- Reject sets `canceled_by` and restocks.
- Handoff:
  - refused before acceptance or without a courier;
  - the first send adds one event, and a resend adds attempts only;
  - reassigning supersedes and opens a new pending handoff;
  - one active handoff per order.
- Auto-accept:
  - off: the order is pending;
  - on for a channel: that channel's orders are confirmed with `accepted_via = auto`, the courier comes from the service then the default, and a pending handoff exists;
  - on for one channel only: the other channel stays pending;
  - on with no courier match: pending, plus an explanatory notification, and the order is still created;
  - the `order_auto_accepted` notification is cleared by the first handoff send and by cancel;
  - works for anon website checkout (`place_order`) and for `admin_create_order`.
- Seed-style direct inserts create no notifications.
- Settings changes (mode, default courier, auto-accept) need `settings.manage`.
- Grants on every new table and function.

Manual browser check on the dev server:
- Two sessions: the owner, plus a staff member with only `orders.read`.
- Enter a WhatsApp order as the owner and watch the other session's bell update live.
- Accept in auto mode, then in manual mode.
- Send to the courier, then change the courier.
- Reject an order.
- Place a website order from the storefront and watch it notify.
- Keyboard-only pass through the new-order form and both dialogs, plus a mobile-width pass.

## Implementation notes (2026-09-27)

- Shared UI: the Province → District → Municipality → Ward cascade moved from `components/store/checkout/address-section.tsx` to `components/delivery/nepal-address-fields.tsx`. Checkout keeps its location button and map around it, and its tests pass unchanged.
- The bell (`components/admin/notifications-menu.tsx`) replaced the count-only `NotificationsMenu` in `header-menus.tsx`. The permission-filtered counts moved to `features/admin/attention.ts` so the layout and the live refetch share them.
- The handoff "Order details sent to X" event and the accept event use the `assigned` shipment status. Auto-accept stamps its event with `clock_timestamp()` so it sorts after "Order placed" in the same transaction.
- The hosted dev DB has the migration, and `notifications` is in the `supabase_realtime` publication (checked with psql).

## Manual test steps (for the report)

1. In `/admin/delivery/couriers`, add a dispatch WhatsApp number to a courier.
2. In `/admin/settings`, set the courier mode to Auto and pick a default courier.
3. In a second browser, sign in as staff with `orders.read` and keep `/admin` open.
4. As the owner, go to `/admin/orders` → "New WhatsApp order".
   - Fill in the customer, two items, an address and a delivery option.
   - Check that the summary total matches the server figure, then create the order.
5. In the second browser, the bell shows the new order without a reload. Click it.
6. As the owner, click Accept. The courier from the rule is shown. Confirm, then check "Accepted by".
7. Click "Send to courier on WhatsApp". WhatsApp opens with the message. Check the timeline event, then "Send again".
8. Change the courier. The handoff shows "Not sent" for the new courier.
9. Switch Settings to Manual, enter another order, and accept it. A courier must be picked. Enter a third order and reject it with a reason.
10. Place a website order from the storefront and check that it notifies too.
11. In Settings, turn on "Auto-accept WhatsApp orders". Enter a WhatsApp order. It opens already "Accepted automatically", with the courier assigned and "Ready to send". The bell says "ready to send" until you tap Send.
12. Turn on "Auto-accept website orders" and place a storefront order. The confirmation page shows Confirmed, and the admin bell shows it auto-accepted.
13. With Settings on Auto, open a pending order whose delivery-service courier you then turn off in Delivery. Accept picks the default courier, or, with no default, asks you to choose one.
