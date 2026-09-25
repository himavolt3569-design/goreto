# Goreto admin: add, edit, delete and link products

## Goal

Phase 1 of the admin CRUD work. The earlier admin pass left this out (see `goreto-admin-panel.md` non-goals). This phase turns the Products section into a full editor per AGENTS §4.7:

- **Add** a product: `/admin/products/new`.
- **Edit** a product: `/admin/products/[id]/edit`. Add and edit use the same form component and the same data model.
- **Delete** a product, but only if it has never been ordered. Otherwise staff are told to archive it.
- **Link** a product to:
  - its category;
  - collections;
  - variant-specific photos.

  Existing admin surfaces also link to the new pages.
- **Media**: upload images straight to Supabase Storage, then set alt text, reorder, tie a photo to a variant, and delete.

## Non-goals (later phases)

- Category and collection create/edit/delete (phase 2). This phase only *links* a product to existing ones.
- Coupons, couriers, zones, rates (phase 3). Staff invitations and AR asset upload (phase 4). The editor shows a product's AR assets read-only and links to `/admin/ar`.
- Video media. The `product-media` bucket accepts images only.
- A "Duplicate product" action. `storage_path` is unique, so copying media would mean copying objects. Left for later.
- SEO title/description. There are no columns for them, so the section is omitted (AGENTS §4.7: "only when the project actually supports them").
- A cleanup job for orphaned uploads (see Security, point 6).
- Drag-and-drop reordering. Photos are reordered with Move up/down buttons, which are keyboard-accessible and need no new library.

## What I inspected

- `AGENTS.md` §4.7, §5, §8, §10.2–10.4, §11.2, §12, §16, §18.3–18.4, §18.7, §20, §22, §26.8–26.11.
- `prompts/goreto-admin-panel.md`: decisions, the conventions below, and deferred items.
- Migrations:
  - `catalog` (products, variants, media, collections, RLS);
  - `storage` (public `product-media` bucket, 10 MB, jpeg/png/webp/avif, `catalog.write` for select/insert/update/delete);
  - `admin_operations` (`admin_set_product_status`, invoker plus explicit `has_permission`).
- FK rules:
  - `order_items.product_id` / `variant_id` are `on delete set null`;
  - media, AR, collection links, wishlist and reviews cascade from products.
- RLS on `order_items` requires `orders.read`, so a catalog-only staff member can't see whether a product was ordered. This drives decision 4.
- Storefront consumers of product JSON:
  - `features/catalog/mappers.ts` (`options` = `[{name, values:[{value,label,swatch_hex?}]}]`, `specs` = `[{label,value}]`, variant `option_values` = `{[optionName]: valueKey}`);
  - `variants.ts`. `defaultVariant` throws when a product has no active variants, so an active product must keep at least one.
- Seed conventions (`scripts/seed/build/catalog.ts`):
  - SKU `GRT-<STEM>-<COLOR>-<SIZE>` or `GRT-<STEM>-STD`;
  - storage keys `products/<slug>/NN.jpg`.
- Admin code:
  - `features/admin/{auth,schemas,nav}.ts`;
  - `actions/{catalog,helpers}.ts` (`authorizeAndParse`, `revalidateStorefrontCatalog`, `NOT_UPDATED`);
  - `queries/catalog.ts`;
  - `components/admin/{action-forms,settings-form,admin-ui,product-actions-menu}.tsx`;
  - products list and detail pages.
- UI primitives: `Field`, `Input`, `Select`, `Button`, `Card`, `Badge`, `icons.ts`.
- `lib/supabase/{server,public,admin}.ts`. There is no browser client yet.
- `lib/money/format.ts` (`formatNpr` only; no rupee-string parser yet).
- Next.js 16.3.6 docs:
  - `02-guides/forms.md`;
  - `02-guides/server-actions.md` (1 MB action body limit, which is why uploads go direct to Storage; "send a reference plus the change");
  - `01-getting-started/07-mutating-data.md` (`redirect` after mutation).
- Skills: `supabase` and `supabase-postgres-best-practices` (definer only with explicit caller check, `search_path = ''`, locked grants).
- Memory: hosted dev DB with no Docker. `npm run db:push` for migrations; PGlite for DB tests. New tables and functions need explicit grants.

## Decisions

1. **Routes**, per AGENTS §7:
   - `/admin/products/new` and `/admin/products/[id]/edit` need `catalog.write`. Others get 404, via `requireAdminAccess`.
   - `/admin/products/[id]` stays the read-only overview. It gains an **Edit** button and a **Delete** action.
   - The sidebar's "Products" item stays active on both new routes.

2. **Form stack.** React Hook Form, `@hookform/resolvers` and Zod, as AGENTS §5 specifies for complex forms. These are **two new dependencies**.
   - One schema, `features/admin/product-form/schema.ts`, runs in the browser for inline errors and again in the Server Action.
   - The action takes a typed object, not FormData, because variants and options are nested arrays.
   - Server field errors come back keyed by path (e.g. `variants.2.sku`) and are shown on the matching field.

3. **Sections.** One sectioned page, with a sticky summary/actions column on `xl` that stacks below it on smaller screens:

   | # | Section | Fields |
   |---|---|---|
   | 1 | Basic information | Title; slug (auto from title until edited; on edit, a warning that changing it breaks shared links); category (grouped `Parent › Child` select); short description (≤ 200); description (≤ 5,000); tags (comma input shown as chips, ≤ 20, slug form) |
   | 2 | Pricing | Base price (Rs.); compare-at price (optional; must be greater than base, which matches the DB check) |
   | 3 | Options & variants | Up to 3 options (e.g. Colour, Size). Each has up to 20 values: label, a stable key made from the label, and an optional swatch colour. **Generate variants** builds the combinations, capped at 100. The variant table has SKU (suggested in the seed's `GRT-…` format, editable), price override, weight (g), active, and stock. |
   | 4 | Specifications & care | Spec rows (label/value, ≤ 30); care instructions |
   | 5 | Inventory | Low-stock alert threshold (the new-product default comes from `store_settings.default_low_stock_threshold`) |
   | 6 | Merchandising & links | Featured, Bestseller, Limited edition; **Collections** checklist (only for `content.manage`, see decision 6) |
   | 7 | Media (edit only) | Upload, alt text, variant link, reorder, delete (decision 7) |
   | 8 | AR Try-On (edit only) | Read-only list of assets, plus a link to `/admin/ar` |
   | Side | Status & save | Status (Draft / Active / Archived), **Save**, "View on store" when active, last-updated time |

   - A product with no options has exactly one variant (`option_values = {}`). The variant table then shows a single row.
   - **Stock rules.** A new variant takes an initial stock. An existing variant shows its current stock read-only, with an "Adjust" link to the existing relative stock control. The form never overwrites stock, so a sale made during editing isn't lost.
   - **Regenerating variants** keeps existing rows whose option combination still exists, with their id, SKU, price and stock. Only new combinations are added. Rows whose combination disappeared are marked "will be removed" before saving.
   - **Unsaved changes.** A `beforeunload` guard runs while the form is dirty.
   - **Create flow.** Creating a product saves it as a draft or active and redirects to `/edit#media` so photos can be added. Uploads need the product id for the storage path.

4. **Migration `supabase/migrations/<ts>_admin_product_editor.sql`.** It follows the `harden_grants` pattern: `search_path = ''`, `revoke … from public, anon`, and `grant execute … to authenticated`.

   - **`admin_ordered_variant_ids(p_product_id uuid) returns setof uuid`**
     - `security definer`, stable. Raises `42501` without `catalog.write`.
     - Returns only the variant ids of this product that appear in `order_items`, and nothing else.
     - Definer is needed because `order_items` RLS hides orders from catalog-only staff.
   - **`admin_product_has_orders(p_product_id uuid) returns boolean`**
     - Definer, same check. Used by the delete guard and by the page to decide whether to show Delete or "Archive instead".
   - **`admin_save_product(p_product_id uuid, p_product jsonb, p_variants jsonb, p_collection_ids uuid[]) returns jsonb`**
     - `security invoker`, so RLS on products, variants and collection_products stays the enforcement. Explicit `catalog.write` check. One transaction.
     - **Validates** (`22023` with a readable message):
       - 1–100 variants;
       - option names unique, 1–3 options, value keys unique per option;
       - every variant's `option_values` has exactly the option names as keys, with values from that option;
       - no duplicate combinations;
       - SKUs match the existing check and are unique within the payload;
       - an `active` status needs at least one active variant.
       - Existing checks still apply: slug and SKU uniqueness (`23505`), and compare-at greater than base (`23514`).
     - **Product:** insert when `p_product_id` is null, otherwise update. Status sets `published_at`/`archived_at` exactly as `admin_set_product_status` does. The browser never sends `published_at`.
     - **Variants:**
       - A row with an `id` must belong to this product (`P0002` otherwise). It updates SKU, price, weight, active and sort. **Stock is never changed.**
       - A row without an `id` first reuses an existing variant of this product with the same `option_values`. This reactivates a variant that was deactivated earlier. Otherwise it inserts, with `stock_quantity = initial_stock` (0–100,000).
       - Existing variants missing from the payload are **deleted if never ordered**. If they have been ordered, they are **set inactive**, so order analytics and snapshot links survive (AGENTS §26.11).
     - **Collections:** when `p_collection_ids` is not null, it requires `content.manage` (`42501`) and replaces the product's `collection_products` rows, appending new links at the end of each collection. When it is null, links are untouched. This lets a catalog-only staff member save without touching links.
     - **Returns** `{ id, slug, deactivated_skus[] }`.
   - **`admin_delete_product(p_product_id uuid) returns text[]`**
     - `security invoker` plus a `catalog.write` check.
     - Raises `22023` "This product has orders. Archive it instead." when `admin_product_has_orders` is true.
     - Otherwise deletes the product. Media, variants, AR assets, collection links, wishlist items and reviews cascade.
     - Returns the deleted media `storage_path`s so the action can remove the objects.
   - **`admin_reorder_product_media(p_product_id uuid, p_media_ids uuid[])`**
     - Invoker. The ids must be exactly the product's media (`22023` otherwise). Sets `sort_order` to the array index in one statement.
   - **`admin_set_product_status`** is replaced (`create or replace`, same signature) to add the "active needs at least one active variant" check.
   - **Index:** `create unique index product_variants_product_option_values_key on product_variants (product_id, option_values)`. It stops duplicate combinations at the database level.
     - Before applying, I'll check the dev DB and seed for existing duplicates. If there are any, I stop and ask.
   - No new tables and no data rewrites.

5. **Money input.** A new pure `parseRupeesToPaisa("2,499.50") → 249950` in `lib/money/parse.ts`:
   - it uses string arithmetic, never floats (AGENTS §26.9);
   - it accepts commas and up to 2 decimals.

   Forms show rupees; the schema outputs paisa. For editing, `paisaToRupeesInput` does the reverse.

6. **Linking.**
   - Category: a required select, grouped by parent.
   - Collections: a checklist of all collections, showing inactive/scheduled state. It is only rendered and sent when the user has `content.manage`. Otherwise the form shows the current links read-only.
   - Media ↔ variant: a per-photo select of "All variants" or one variant. The storefront already shows a variant's own photos first.
   - Links into the new pages:
     - Products list: **Add product** button (`catalog.write`).
     - Row menu: Edit, View details, View on store, status items, Delete.
     - Product detail: Edit button and Delete.
     - Dashboard Quick Actions: "Add product".
     - Dashboard product menu: Edit.
     - Media page: each item links to `/admin/products/[id]/edit#media`.
     - Inventory rows: product link.

7. **Media upload** (AGENTS §18.3–18.4; the action body limit rules out sending files through Server Actions).
   1. The browser checks type (jpeg/png/webp/avif), size (≤ 10 MB), and magic bytes. It reads dimensions and warns under 800 px on the shortest side. Each image uploads one at a time, with a progress state.
   2. `createProductMediaUploadAction({ productId, contentType, size })`:
      - authorizes `catalog.write`, validates with Zod, and checks the product is visible;
      - generates the key `products/<productId>/<uuid>.<ext>` on the server, so the client never picks the path;
      - returns `{ path, token }` from `storage.createSignedUploadUrl` on the **user-context client**, so the Storage insert policy (`catalog.write`) is enforced.
   3. The browser uploads with `uploadToSignedUrl` using a new anon-key browser client, `lib/supabase/browser.ts`. It holds no session and is used only for signed uploads.
   4. `attachProductMediaAction({ productId, path, altText, variantId })`:
      - The path must match `^products/<productId>/<uuid>\.(jpg|png|webp|avif)$`.
      - The server reads the first 32 bytes of the object with an HTTP Range request, checks the file signature against the extension, and checks the stored size.
      - It then inserts `product_media` with `sort_order = max + 1`.
      - On any failure it deletes the object.
   - **Edit:** alt text (≤ 200, required before publish is **not** enforced; missing alt is flagged in amber, as the Media page already does) and variant link.
   - **Delete:** removes the row, then the object. If the object delete fails, the orphan is logged and the row stays deleted.
   - **Reorder:** Move up/down buttons call `admin_reorder_product_media`.
   - The first photo is the cover, and is labelled "Cover".

8. **Delete product.**
   - The page calls `admin_product_has_orders`.
   - With no orders, it shows a destructive **Delete product** button in a "Danger zone" card on the edit and detail pages. The button opens a confirm dialog that names the product and lists what else is removed: photos, variants, AR assets, collection links, wishlist saves, reviews.
   - With orders, the card explains why deletion isn't possible and offers **Archive** instead.
   - After deletion, the action removes the storage objects, revalidates, and redirects to `/admin/products` with a status message.

9. **Mutations and cache.**
   - Every action goes through `authorizeAdmin` + Zod + RLS, and returns the existing `ActionResult` shape.
   - After a save or delete: `revalidateStorefrontCatalog(oldSlug)` and, if the slug changed, the new slug too. Then `refresh()`, or `redirect` on create/delete.
   - Media changes revalidate the product page.

10. **Pure helpers** (tested, importable without `server-only`) in `features/admin/product-form/`:
    - `schema.ts`;
    - `variant-matrix.ts` (cartesian product, merging with existing rows, removed-row detection);
    - `sku.ts` (suggestion from title and value keys, uppercase and deduplicated);
    - `option-keys.ts` (label → key);
    - `file-signature.ts` (magic bytes).

## Implementation notes (after execution)

Differences from the plan above, and why:

- **No browser Supabase client.** `boundaries.test.ts` requires every `lib/supabase/*` module to be `server-only`, so `lib/supabase/browser.ts` would break a project guard.
  - The browser uploads with a plain `fetch` `PUT` (multipart, `x-upsert: false`) to the server-issued signed URL. That URL carries its own token.
  - I checked this against the dev bucket with a throwaway script: the key-less `PUT` returned 200, a reused token was refused (400), a Range read returned 206 with the total size, and the test object was cleaned up.
  - `boundaries.test.ts` is unchanged.
- **Deferrable unique constraint instead of a unique index** on `(product_id, option_values)`. A save that swaps two variants' combinations is checked at commit, not halfway through. The dev DB had no duplicates before it was applied.
- **Saved option keys** are marked with a `locked` flag on each option value (stripped before saving), instead of a separate `savedValueKeys` list.
- **"In sync" rule for variants.** The warning shows when a row doesn't fit the options, *or* when a combination has no row and wasn't removed on purpose. Without the second part, adding a new value (e.g. Black) raised no warning, and staff could save without its variant.
- **Delete lives in a "Danger zone" card** on the product overview and the editor, not in the row "⋯" menu. The menu gained **Edit**. The Delete/Archive choice needs `admin_product_has_orders`, which the list doesn't load per row.
- **Created products** redirect to `/admin/products/[id]/edit?created=1`, which shows a "Product created. Add photos" notice linking to `#media`. Deleting redirects to `/admin/products?deleted=1`.
- **Quick Actions** gained "Add product" (`catalog.write`). The Media page gained "Edit photo" links to the editor.
- **Dev DB owner.** The real owner account has been bootstrapped; `user_seed_owner` is now a customer on the dev DB. I ran the rolled-back dev check as the real owner, with the id looked up inside SQL and never printed.
- **Known limits:**
  - Creating a signed upload URL with the Clerk-token client wasn't exercised end to end, because that needs a signed-in session. It is covered by the manual steps.
  - Swapping SKUs between two variants in one save is refused as a conflict. Save twice instead.
  - AR assets tied to a deleted (never-ordered) variant are removed with it by the existing FK cascade.
  - Orphaned uploads from abandoned browser sessions are not cleaned up yet.

## Files expected to change

New:

- `supabase/migrations/<ts>_admin_product_editor.sql`
- `src/app/(admin)/admin/products/new/page.tsx`
- `src/app/(admin)/admin/products/[id]/edit/page.tsx`
- `src/components/admin/product-form/`:
  - `product-form.tsx` (client, RHF, with the status panel);
  - `fields.tsx`, `detail-sections.tsx` (basic, pricing, specs, inventory, merchandising), `options-variants-section.tsx`;
  - `media-manager.tsx` (client);
  - `delete-product.tsx`;
  - `__tests__/*`.
- `src/features/admin/product-form/{schema,variant-matrix,keys,file-signature}.ts`, with tests
- `src/features/admin/actions/products.ts`: save, delete, media upload/attach/update/delete/reorder
- `src/features/admin/queries/product-editor.ts`: form defaults, collection options, has-orders
- `src/lib/money/parse.ts`, with a test
- `tests/db/admin-products.test.ts`

Changed:

- `package.json` / `package-lock.json`: `react-hook-form`, `@hookform/resolvers`
- `src/app/(admin)/admin/products/page.tsx`: Add product button
- `src/app/(admin)/admin/products/[id]/page.tsx`: Edit, Delete
- `src/components/admin/product-actions-menu.tsx`: Edit, Delete
- `src/components/admin/header-menus.tsx`: Quick Actions "Add product"
- `src/app/(admin)/admin/media/page.tsx`: links to the editor
- `src/features/admin/nav.ts`: only if active matching needs it
- `src/app/(admin)/admin/layout.tsx`: "Add product" quick action
- `src/components/ui/icons.ts`: `PlusIcon`, `PencilSimpleIcon`, `TrashIcon`, `UploadSimpleIcon`, `ArrowUpIcon`/`ArrowDownIcon` if not already there
- `src/types/database.ts`: regenerated

## Database / RLS impact

- **Additive:**
  - 5 new functions;
  - 1 replaced function (same signature, one extra check);
  - 1 unique index.

  No table or column changes, and no RLS policy changes.
- **Definer functions** (`admin_ordered_variant_ids`, `admin_product_has_orders`) check `catalog.write` and return only ids or a boolean for one product. They expose no order data.
- **Data effects** are real on the hosted dev DB: products created or deleted through the panel, and objects in `product-media`.
- **Rollback:** drop the 5 functions, restore the previous `admin_set_product_status` body from `admin_operations`, and drop the index. No data loss from the rollback itself.
- **Applying:** `npm run db:push -- --dry-run`, then `npm run db:push`, then `npm run db:types`.

## Security requirements

1. Every page and action re-checks `catalog.write` on the server, with `content.manage` for collection links. RLS and the function checks are final.
2. The browser never sends `published_at`, stock for existing variants, storage URLs, or storage paths it chose itself. The server builds paths and re-reads prices.
3. Uploads go through server-issued signed tokens on a server-chosen path. The file signature and size are verified server-side before a row exists, and a failed attach deletes the object.
4. There's no service role and no new env vars. The browser client uses the public anon key only.
5. All text is trimmed and length-capped. JSON arrays are bounded. Swatch colours are `#RRGGBB` only.
6. **Known gap:** if the browser abandons an upload between signing and attaching, an orphaned object stays in the bucket. It's small and admin-only; a cleanup job is noted as a follow-up.

## Acceptance criteria

1. Owner, or staff with `catalog.write`:
   - creates a product with 2 options (Colour × Size = 4 variants), saves it as a draft, and lands on the edit page;
   - uploads 3 photos, ties one to a variant, reorders them, sets alt text, and publishes;
   - the storefront page shows the right price, options, variant photos and stock.
2. Editing the title, prices and specs of a seeded product changes the storefront after save. Existing variant stock is unchanged.
3. Removing an option value:
   - an ordered variant becomes inactive, and the save message lists its SKU;
   - an unordered variant is deleted.
4. The following show inline errors on the right field:
   - duplicate SKU;
   - duplicate slug;
   - compare-at ≤ base;
   - an active product with no active variant;
   - a 101st variant.
5. Deleting a never-ordered product removes its rows and storage objects and redirects to the list. A product with orders offers Archive only.
6. A catalog-only staff member (`user_seed_staff_catalog_manager`) can edit products but sees collections read-only. A fulfilment staff member gets 404 on `/new` and `/edit`, and their action calls are refused.
7. A non-image file, or a file renamed to `.jpg`, is rejected. A file over 10 MB is rejected.
8. Keyboard only: every section, adding/removing options, values and variants, upload, reorder, and the delete dialog (focus trap, Escape, focus return) all work. Errors are announced.
9. At 375 px there's no horizontal page scroll. The variant table scrolls inside its card.

## Checks to run

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`
- `npm run db:push -- --dry-run`, `npm run db:push`, `npm run db:types`
- Dev DB pre-check for duplicate `(product_id, option_values)` before the unique index, with read-only psql and the URL from env (never printed).
- Dev-server smoke check: signed-out `/admin/products/new` gives 307 to sign-in.

## Tests

- **Unit:**
  - `parseRupeesToPaisa` (commas, decimals, rejects 3 decimals, negatives and floats);
  - variant matrix (cartesian product, merge keeps ids and stock, removed detection, cap);
  - SKU suggestion;
  - option keys;
  - file signature (jpeg/png/webp/avif, a spoofed extension);
  - schema (compare-at, duplicate combinations and SKUs, no-option single variant).
- **Component (RTL):**
  - options editor adds and removes values;
  - Generate variants preserves existing rows;
  - server path errors land on the right inputs;
  - the delete dialog shows Archive when the product has orders.
- **DB (PGlite) `admin-products.test.ts`:**
  - save as owner (create and update);
  - catalog staff can save but is refused collection links;
  - fulfilment staff, customer and anon are refused;
  - validation errors;
  - existing stock is never changed by save;
  - an ordered variant is deactivated, not deleted;
  - an unordered variant is deleted;
  - reuse by `option_values`;
  - delete is blocked when ordered and cascades when not;
  - reorder needs the exact id set;
  - the status check needs an active variant;
  - definer helpers are refused without `catalog.write`;
  - existing `rls.test.ts` / `admin.test.ts` still pass.

## Manual test steps

1. `npm run dev`. Sign in as the owner. Open `/admin/products` and click **Add product**.
2. Fill in the basics, a price of Rs. 2,499.50, a Colour option (Tan, Black) and a Size option (S, M). Generate variants, set stock 5 on each, and save as draft. You land on the edit page at the Media section.
3. Upload 3 photos. Tie one to "Black / M", move it to the top, fill in alt text, set the status to Active and save. Open "View on store": pick Black / M and see that photo and price.
4. Back in the editor, remove size S and save. The message says whether variants were deleted or deactivated.
5. Try saving with a duplicate SKU, a compare-at below the price, and an existing slug. Each shows an inline error.
6. Open a seeded product that has orders. The Danger zone offers Archive only. On the product created in step 2, delete it. It disappears from the list and the storefront URL returns 404.
7. Try uploading a `.txt` renamed to `.jpg`. It's rejected.
8. Tab through the whole form without a mouse. Resize to 375 px.
9. If you have a catalog-manager staff account, sign in as them. Collections are read-only and saving works.
