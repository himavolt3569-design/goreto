# Pick an address on a map: automatic province, district, municipality and ward

## Goal

Next to **Street / Landmark** in every Nepal address form, add a **Pick on map** button. It opens a free, open-source map (Leaflet + OpenStreetMap tiles, already in the app). The shopper clicks the map (approximate location) or taps **Use my current location** (precise GPS). The app then fills in **Province, District, Municipality and Ward** by itself. The shopper only types the street or landmark.

Decided with the user (2026-09-29): the municipality comes from Open Knowledge Nepal's local-level boundaries (CC BY 4.0). The ward comes from OpenStreetMap ward boundaries (ODbL). Where OSM has no ward for the point, the ward list opens already narrowed to that municipality, as the one choice left.

## Non-goals

- Filling in the street text (that would need a third-party geocoder such as Nominatim; AGENTS §15.4 and the checkout decision avoid one).
- Place search on the map, and delivery-zone changes.
- Saving coordinates on admin WhatsApp orders. The picker fills the area fields there, but the form has no coordinate fields.
- Dropping the old `nearest_municipality` function (unused after this; a later cleanup can drop it).
- Rate limiting the lookup route. It only runs a local in-memory lookup, with no provider behind it.

## What I inspected

- `AGENTS.md` §4.4, §11.6, §15.4, §15.5, §18.8, §22; `worklog.md` §4.1, §6; `prompts/goreto-cart-checkout-confirmation.md`, `goreto-account-2-wishlist-addresses.md`.
- `src/components/delivery/nepal-address-fields.tsx` (used by checkout, account addresses, admin WhatsApp order), `src/components/store/checkout/address-section.tsx` (Use Current Location + draggable pin + `/api/geocode/reverse`), `src/components/store/map/location-map{,-client}.tsx` (Leaflet, lazy, OSM tiles via `NEXT_PUBLIC_MAP_TILE_URL`).
- `src/app/api/geocode/reverse/route.ts` → `nearest_municipality` (**nearest town centre**, not a boundary, and no ward).
- `supabase/migrations/20260924144022_foundation.sql` (`nepal_*` tables: `ward_count` not null 1–40, lat/lng centroid), `scripts/seed/data/nepal.ts`: **the geography only exists in the dev seed, and municipalities are a 76-row subset of the 753 local levels**. Production has no Nepal data today.
- `account_save_address` (migration `account_addresses_wishlist`), `src/features/account/address-schema.ts`, `src/features/admin/manual-order-forms.ts`.
- `tests/db/harness.ts` (PGlite 0.5.8 has no PostGIS), `scripts/seed/{load,lib/ndjson,types}.ts` (nepal tables upserted by `code`).
- Sources checked:
  - OKN `public/data/local-level/nepal.topojson`: 1.0 MB; properties `STATE_CODE, DISTRICT, GaPa_NaPa, Type_GN`; no codes and no ward counts.
  - Overpass: Nepal has 77 `admin_level=6` districts, 749 `admin_level=7` local levels and **6,741 `admin_level=9` wards** tagged `ward=<n>`. Nepal officially has 6,743 wards.

## Decisions

1. **Canonical geography becomes real data** (it was always meant to live in `src/data/nepal/`, AGENTS §15.5).
   - A build script, `scripts/geo/build-nepal.ts` (run by hand, output committed), downloads the OKN local levels and the OSM wards, then:
     - keeps the 753 local levels and drops protected areas;
     - maps each district to our existing district codes (and fails on any mismatch);
     - gives each municipality a code in the seed's scheme (`slug(name)-<type suffix>`), with an alias file `scripts/geo/aliases.json` for spellings that differ, so **all 76 existing codes are kept** (the script fails if any existing code is unmatched);
     - assigns each OSM ward to the local level that contains its interior point;
     - sets `ward_count` = the highest ward number found there. Where OSM coverage has gaps, the value comes from `src/data/nepal/ward-count-overrides.json`, and the script fails if a local level has neither.
   - It writes three things:
     - migration `supabase/migrations/20261003090000_nepal_geography.sql`: upserts 753 municipalities (name, type, district, `ward_count`, centroid; known postal codes kept). Codes that already exist are updated in place, so no foreign key breaks.
     - `src/data/nepal/boundaries.topojson`: simplified local-level and ward polygons, quantised. The target is under 4 MB.
     - `src/data/nepal/README.md`: the sources, their licences, the date fetched and the counts.
   - The seed stops generating `nepal_municipalities` (the migration owns them). Seed addresses, zones and tests draw codes from the canonical list.
2. **Lookup runs on the server, in Node, not PostGIS** (PGlite can't test PostGIS). `src/features/delivery/locate.ts` (server-only):
   - decodes the TopoJSON once per server process;
   - checks the bounding boxes first, then runs a point-in-polygon test (ray casting, holes and multipolygons handled);
   - returns `{ provinceCode, districtCode, municipalityCode, ward | null, postalCode }`, or `outside_nepal` / `no_match`.
   - A point that lands in a ward whose number is higher than the municipality's `ward_count` is treated as no ward.
3. **`GET /api/geocode/reverse` switches to `locate`** and adds `ward`. The response shape stays compatible, so the existing checkout "Use Current Location" also fills in the ward now.
4. **`MapPicker` dialog** (`src/components/delivery/map-picker.tsx`, client; Leaflet stays lazy-loaded):
   - A native `<dialog>` with focus trap and return, opened by a **Pick on map** button beside Street / Landmark (a secondary button with a map-pin icon).
   - The map starts at the current pin if there is one, else the chosen municipality's centre, else Kathmandu.
   - **Click** the map to move the pin, or drag it. **Use my current location** uses the browser's GPS (high accuracy) and pans to it; it asks for permission only when tapped, and a denial is a normal message, not an error page.
   - Keyboard: the map pans with the arrow keys, and **Place pin at centre** drops the pin there.
   - Each pin change looks up the area (the previous request is aborted). A live readout shows "Ward 26 · Kathmandu Metropolitan City · Kathmandu · Bagmati Province", or "Ward not found here: you'll pick it", or "That point is outside Nepal".
   - **Use this location** closes the dialog and fills Province → District → Municipality → Ward (plus the postal code when known and the field is empty). It then moves focus to Street / Landmark.
   - Every field stays editable (AGENTS §4.4: geolocation is assistance, not truth). The note under the fields reads "Filled from the map. Check they're right."
   - Attribution in the dialog: map © OpenStreetMap contributors; boundaries from Open Knowledge Nepal (CC BY 4.0) and OpenStreetMap (ODbL).
5. **`NepalAddressFields` gets an optional `onLocationPicked(lat, lng)`** so forms that store coordinates keep them:
   - **Checkout**: sets latitude/longitude, so the existing preview map and order snapshot get the pin.
   - **Account addresses**: a new migration step replaces `account_save_address` with a version that takes `p_latitude` and `p_longitude` (null keeps the old coordinates while the municipality is unchanged). The address schema gains nullable lat/lng.
   - **Admin WhatsApp order**: fields only.

## Files expected to change

```text
scripts/geo/{build-nepal.ts,aliases.json,package.json}             new (build-time only: topojson-client/server, osmtogeojson)
src/data/nepal/{boundaries.topojson,ward-count-overrides.json,README.md}   new, generated
supabase/migrations/20261003090000_nepal_geography.sql              new: 753 municipalities + account_save_address with coords
src/types/database.ts                                                regenerated
src/features/delivery/locate.ts (+ test)                             new: point-in-polygon lookup
src/app/api/geocode/reverse/route.ts (+ test)                        uses locate, returns ward
src/components/delivery/map-picker.tsx (+ test)                      new dialog
src/components/store/map/location-map-client.tsx                     click-to-place, centre pin, fly-to
src/components/delivery/nepal-address-fields.tsx                     Pick on map button, onLocationPicked
src/components/store/checkout/address-section.tsx                    ward from suggestion, message wording
src/features/account/{address-schema,address-actions,addresses}.ts   lat/lng
src/components/store/account/address-form.tsx                        keep picked coords
scripts/seed/{data/nepal.ts,generate.ts,...}, supabase/seed.ndjson   seed stops owning municipalities
tests/db/nepal-geography.test.ts                                     new
package.json                                                         topojson-client (runtime, ~10 kB)
worklog.md
```

## Database / migration impact

- Reference data: 753 rows upserted into `nepal_municipalities`. The 76 existing rows are updated in place (name/centroid/ward count can change, codes don't).
- Existing addresses and orders keep their codes. A saved ward number that is higher than a municipality's new `ward_count` would fail validation the next time that address is edited; the build script reports any such rows in dev.
- `account_save_address` gets two optional arguments: drop the old signature, create the new one, re-grant.
- Rollback: restore the previous function, then delete the municipalities that no address, order or zone references. Kept rows are harmless.
- Apply to hosted dev with `npm run db:push`. Production gets its geography this way too (it has none today).

## Auth / RLS

No new tables or policies. `nepal_*` stay public read. The lookup route is public, like today's, and reads no user data. Account writes keep going through the invoker function, own rows only.

## Validation and security

- The lookup route validates lat 26–31 and lng 80–89 with Zod, as today.
- Coordinates from the client are only an input to the area suggestion. `place_order` and `account_save_address` still validate the hierarchy and ward in SQL.
- No third-party calls at runtime: tiles come from the configured tile server, and the lookup uses local data.

## UI / design

Existing tokens and components: secondary button, 44 px targets, native dialog pattern (as in admin `FormDialog`), `Field` errors, status text + icon (never colour alone). On mobile the dialog fills the screen and the map fills most of the height, with the readout and actions pinned at the bottom.

## Tests

- **Unit**: point-in-polygon (inside, outside, hole, multipolygon, on a bounding-box edge); `locate` against a small fixture topology (municipality + ward; municipality with no ward; outside Nepal); a ward above `ward_count` → null.
- **Data** (`scripts/geo` test over the committed files):
  - 753 local levels, 77 districts, and every local level has a code, a district and `ward_count ≥ 1`;
  - total wards within ±2 of 6,743, all 76 old codes present;
  - known points resolve correctly (Kathmandu Durbar Square → Kathmandu Metropolitan City, ward 24; Pokhara Lakeside → Pokhara Metropolitan City, ward 6; Biratnagar, Dharan, Butwal, Nepalgunj, Dhangadhi). Expected wards are taken from OSM when writing the test.
- **DB**: migration applies; hierarchy intact; `account_save_address` stores and keeps coordinates; existing seed addresses still valid.
- **Components**: the picker readout for found / no-ward / outside results; "Use this location" fills all four fields and focuses Street; permission denied shows the message; `NepalAddressFields` passes coordinates to `onLocationPicked`.
- **Route**: returns ward; 422 outside Nepal.

## Acceptance criteria

1. Checkout, account addresses and the admin WhatsApp order each show **Pick on map** beside Street / Landmark.
2. Clicking a point in Kathmandu ward 24 and confirming fills Bagmati → Kathmandu → Kathmandu Metropolitan City → Ward 24 without touching a dropdown.
3. **Use my current location** fills the same way from GPS. A denied permission shows a clear message and the map still works.
4. Where OSM has no ward, the municipality is filled in and the ward list shows only its wards, with a note.
5. A click outside Nepal changes nothing and says why.
6. All four fields stay editable after being filled. The saved order and account address keep the picked coordinates.
7. Every one of the 753 local levels can be chosen by hand in the dropdowns.
8. Keyboard only: open the dialog, pan with the arrows, press Place pin at centre, confirm, and focus lands on Street / Landmark.
9. No horizontal scroll at 375 px. Leaflet isn't in the bundle of pages without an address form.

## Checks

```bash
node scripts/geo/build-nepal.ts        # once; output committed
npm run typecheck && npm run lint && npm test && npm run test:db
npm run db:push && npm run db:types && npm run seed:generate
npm run build
npm run dev                            # manual steps below
```

## Manual test steps

1. `/checkout` → Pick on map → click near Kathmandu Durbar Square → readout shows ward 24 → Use this location → the four fields are filled, and focus is on Street.
2. Repeat with Use my current location; then deny the permission in the browser and check the message.
3. Click in the middle of India → "outside Nepal", nothing changes.
4. `/account/addresses/new` → pick on map, save, edit again → the fields and pin are kept.
5. `/admin/orders/new` → pick on map fills the area fields.
6. Mobile width 375 px; keyboard-only run of step 1.

## Rollback

Revert the commit and restore the previous `account_save_address`. Keep the municipality rows (harmless reference data), or delete the ones nothing references.

## Changes made during execution

- **Ward counts come from the government**, not from OSM. The build found tail gaps in OSM (e.g. Nagarjun's ward 10 is missing, so "highest ward number" undercounts), and an undercount would reject real addresses. `scripts/geo/build-nepal.ts` now reads the Department of Postal Services local-level directory (753 local levels, 6,743 wards; JSON copy in `Forgesaroj/nepal-reference-data`).
  - Its names are Nepali only, so `scripts/geo/devanagari.ts` transliterates them and matches them one-to-one to the OKN names within the same district and type. The build fails on a loose match unless OSM's ward numbers agree.
  - `ward-count-overrides.json` was dropped as no longer needed. `scripts/geo/aliases.json` maps the four ambiguous Nepali district names.
  - The official counts equal the old hand-entered counts for all 76 legacy municipalities.
- **Wards decide the municipality**: a point inside an OSM ward polygon takes that ward's local level. Only points with no ward polygon fall back to the OKN local-level polygon. Wards were assigned to local levels at build time by interior point, or by ward name for wards inside national parks (which OKN leaves out of every local level). 14 wards mapped as two relations were merged, and 2 OSM wards numbered above the official count were dropped.
- The boundary file is `src/data/nepal/boundaries.json` (not `.topojson`), so it imports as a JSON module on the server only: 3.9 MB, 35% of points kept, 99.55% of 4,000 random lookups agree with full detail. The build checks this and fails below 99%.
- The account-address function change is its own hand-written migration, `20261003090100_account_address_coordinates.sql`. The generated `20261003090000_nepal_geography.sql` holds reference data only.
- The seed still writes `nepal_*` rows but builds them from `src/data/nepal`, so its foreign-key checks keep working. The PGlite harness inserts them with `on conflict (code) do nothing`. Seed addresses and orders got new coordinates (the canonical municipality centres).
- The lookup lives in `src/features/delivery/{geo,area-lookup,locate}.ts`: pure geometry, a pure index, and the server-only loader. `area-client.ts` is the browser helper, shared by the picker and checkout's "Use Current Location".
- A point inside Nepal's box but in no local level (across the border, or in a national park) returns `no_match` (404) with its own message.

### Verification

- `npm run typecheck` and `npm run lint` pass.
- `npm test`: 83 files, 576 tests (new: geometry, lookup index, the real-data lookup at 7 known places, the route, the picker dialog, the checkout ward fill). `npm run test:db`: 15 files, 288 tests (new `tests/db/nepal-geography.test.ts`).
- `npm run db:push` applied both migrations to hosted dev; `npm run db:types` regenerated `src/types/database.ts`; `npm run seed:generate` rebuilt the seed.
- `npm run build` passes. The boundary data is only in the server output (no hits in `.next/static`).
- Dev server: `/api/geocode/reverse` gives Kathmandu Durbar Square → ward 24 and Pokhara Lakeside → ward 6, 404 near Siliguri and 422 outside the box.
- Headless Chromium (Playwright's cached build, run from the scratchpad) on `/checkout`, at 1280 px and 375 px:
  - a map tap filled "Ward 1 · Kathmandu Metropolitan City · Kathmandu · Bagmati Province";
  - GPS (Pokhara) filled all four fields; focus landed on Street / Landmark;
  - no horizontal scroll and no page errors. Screenshots were checked.
- **Not run:** the signed-in account-address and admin-order pickers (no Clerk test user here). They use the same component, which the tests cover.
