# Admin follow-ups: AR asset upload, Media upload, orphan cleanup, Duplicate product

Covers the remaining items in `worklog.md` §4.5. Scope was confirmed with the user on 2026-09-27: the §4.5 follow-ups only. §4.0 (WhatsApp orders) is next, and for courier notification the user chose "wa.me click-to-send now, portal later". That choice is recorded here for the §4.0 plan and is not built in this task.

## Goal

1. **AR asset upload (phase 4b).** Staff with `ar.manage` can add, edit, replace and delete try-on assets from the admin panel. The file uploads straight to a new Storage bucket and is verified by its bytes.
2. **Upload on the Media page.** Staff with `catalog.write` can pick a product and upload photos to it from `/admin/media` without opening the product editor.
3. **Orphaned-upload cleanup.** Staff with `catalog.write` (AR files: `ar.manage`) can see and delete uploaded files that no record references and that are older than 24 hours. This covers abandoned signed uploads, photos staged on an abandoned Add product page, and staged category or collection images.
4. **Duplicate product.** A product can be copied into a new **draft**, including its photos, and opens in the editor.

## Non-goals

- **Courier webhooks** (`api/courier/webhooks/[provider]`). The client has ruled out courier API integrations, so every courier stays `manual`.
- **Mirroring `role` into Clerk `publicMetadata`.** It's optional and nothing needs it yet.
- **Video media.** It's optional, the `media_kind` enum already allows it, and it's left for a later task.
- **Storefront try-on** (`/try-on`, MediaPipe, photo try-on jobs). That's §4.4. This task only manages the asset records and files.
- **A scheduled cron** for cleanup. `admin.ts` may be imported only by `profile-sync.ts`, so an unattended job would need a new service-role path. Cleanup runs from an admin button for now. A scheduled route can be added once deployment exists (§4.8).
- **Fixing the seed AR rows.** They point to `ar/<slug>/…` files that don't exist. The admin page will label them "File missing" (see §1), but the storefront badge logic is not changed in this task.

## Inspected

- `worklog.md` §4.5 and §6; prompts `goreto-admin-panel.md`, `goreto-admin-products-crud.md`, `goreto-admin-products-new-media-slug.md`, `goreto-admin-categories-collections.md`.
- Migrations: `catalog` (`product_ar_assets`, `ar_mode`, `ar_placement`, AR RLS), `storage` (`product-media` bucket and policies), `harden_grants`, `admin_operations` (`product_ar_assets: ar.manage read`), `admin_product_editor`.
- `src/app/(admin)/admin/ar/page.tsx`, `media/page.tsx`, `products/[id]/edit/page.tsx`, `products/[id]/page.tsx`.
- `src/features/admin/actions/products.ts`, `catalog.ts`, `catalog-images.ts`, `collections.ts` (product search for the picker); `media-verify.ts`, `catalog-images.ts`, `product-form/file-signature.ts`, `product-form/schema.ts`, `queries/catalog.ts`, `queries/product-editor.ts`, `nav.ts`.
- `src/components/admin/product-form/upload-photo.ts`, `media-manager.tsx`, `collection-products.tsx`, `product-actions-menu.tsx`.
- `src/lib/media/storage.ts`, `src/lib/supabase/boundaries.test.ts`, `tests/db/harness.ts` (its `storage.objects` shim has no `created_at` or `metadata` yet).
- Seed: `scripts/seed/build/catalog.ts` and `types.ts`. The calibration shape is `{ anchor, scale, offset_x, offset_y, rotation_deg }`.
- Next docs: `01-app/01-getting-started/07-mutating-data.md` (Server Functions, `refresh`, `revalidatePath`, `redirect`).

## Decisions

### 1. AR asset upload

**Storage.** A new migration adds a public bucket, `ar-assets`, separate from `product-media`, because the write permission is `ar.manage` rather than `catalog.write`.
- Limit: 25 MB. Allowed types: `image/png`, `image/webp`, `model/gltf-binary`, `model/vnd.usdz+zip`.
- Storage policies grant select, insert, update and delete to `ar.manage`.
- Public read is fine because the files are product overlays and models, not customer data (§10.4). Customer try-on photos still get their own private bucket in §4.4.

**Paths.** The server picks the key: `products/<productId>/<uuid>.<ext>`. A new `arAssetUrl(path)` sits in `src/lib/media/storage.ts` next to `productMediaUrl`.

**Mode and format rules**, enforced in Zod and by a new DB check:

| Mode | Allowed formats | What the file is |
|---|---|---|
| `live_2d` | png, webp | Transparent overlay anchored to a landmark |
| `live_3d` | glb, usdz | 3D model (usdz for iOS Quick Look) |
| `photo_ai` | png, webp | Flat garment image sent to the provider |

`gltf` stays allowed by the existing column check for old rows, but it can't be uploaded because it's multi-file.

**Byte verification.** `media-verify.ts` gains a generic `verifyStoredObject(bucket, path, detect, maxBytes)`.
- PNG and WebP are detected by the existing `detectImageFormat`.
- GLB: magic `glTF` and version 2.
- USDZ: a ZIP local header (`PK\x03\x04`) whose first entry name ends in `.usda`/`.usdc`.

Rejected files are deleted.

**Calibration.** A strict Zod object that matches the seed shape:
- `anchor`: a string from a per-placement list, e.g. `ear` → `ear_lobe_left`, `ear_lobe_right`, `both`. The list is taken from the seed families.
- `scale`: 0.1–5.
- `offset_x`, `offset_y`: -1–1.
- `rotation_deg`: -180–180.

Unknown keys are rejected. The fields sit in a collapsed "Advanced calibration" section with defaults, so a normal asset needs no tuning (§4.7 progressive disclosure).

**UI.**
- `/admin/ar` gains an **Add AR asset** button and an Edit link per row. Rows whose file isn't in the `ar-assets` bucket show a "File missing" warning pill, so the seed rows are flagged truthfully.
- New `/admin/ar/new?product=<id>` and `/admin/ar/[id]/edit` share one form (`ar-asset-form.tsx`):
  - product picker (search, reusing the collection picker's search action pattern);
  - optional variant;
  - mode, placement and file (the accepted types follow the mode);
  - a preview for PNG/WebP, and for GLB/USDZ the file name and size only (`three` is not added, §14.3);
  - calibration;
  - active toggle.
- Delete is in a danger zone and removes the uploaded file. Seed paths are left alone, like `removeUploadedImage`.
- Replacing the file on edit removes the old uploaded file after a successful save.
- The product editor's read-only AR panel gains **Add AR asset** (links to `/admin/ar/new?product=<id>`) and per-asset Edit links, shown only to `ar.manage`.

**Data writes.** These are single-table insert, update and delete calls under RLS through the Clerk-token client, with the existing `ar.manage` policies. No RPC is needed because only one table changes. The variant must belong to the product; the action checks this and a new trigger enforces it too. Mutations revalidate the product's storefront paths with `revalidateStorefrontCatalog`.

**Permission edge.** A staff member with only `ar.manage` sees active products only (products RLS), so they can attach assets only to live products. This is documented in the UI hint and not widened.

### 2. Upload on the Media page

- `/admin/media` gains an **Upload photos** panel, shown to `catalog.write` only. It contains:
  - a product search (same pattern as above);
  - a multi-file picker using the existing `uploadPhotoFile({ productId })` and `attachProductMediaAction`, which append to the end of the gallery;
  - optional alt text per file;
  - per-file progress, error and warning lines.
- No new server action. The existing product upload and attach actions already check `catalog.write`, the path and the bytes. After upload, `refresh()` shows the new images at the top of the library.

### 3. Orphaned-upload cleanup

- A new SQL function, `admin_orphaned_storage_objects(p_bucket text, p_older_than interval default '24 hours')`.
  - It returns `(name, size_bytes, created_at)` for objects under admin-upload prefixes that no row references:
    - `product-media`: `products/`, `categories/`, `collections/`. Referenced means `product_media.storage_path`, `categories.image_path` or `collections.hero_image_path`.
    - `ar-assets`: `products/`. Referenced means `product_ar_assets.asset_path`.
  - It is `security definer` with a fixed `search_path`. It checks `catalog.write` for `product-media` and `ar.manage` for `ar-assets`, and raises `42501` otherwise.
  - Execute is revoked from `public`/`anon` and granted to `authenticated`.
  - Seed files (`seed/…` or other prefixes) are never listed.
- Deletion goes through the Storage API with the caller's token, because Supabase blocks direct `delete from storage.objects`. The Storage delete policies already limit it to the same permissions.
- The action deletes at most 500 per click and re-lists before deleting, so a file attached in the meantime is never removed.
- UI: a "Storage cleanup" panel on `/admin/media` shows the count and total size of unused uploads older than 24 hours, with a confirm button. A matching panel appears on `/admin/ar` for AR files.
- Why 24 hours: signed upload URLs expire after 2 hours, and an open Add product form can stage photos for a working day. Anything older than 24 hours and unreferenced can't be attached any more.
- `tests/db/harness.ts`: the `storage.objects` shim gains `created_at timestamptz default now()` and `metadata jsonb`, matching Supabase, so the function can be tested.

### 4. Duplicate product

- The **Duplicate** item goes in the existing product actions menu (list and detail pages) and in the editor header, for `catalog.write` only.
- `duplicateProductAction(productId)` runs in trusted server code:
  1. Loads the editor data (`fetchProductEditor`).
  2. Builds form values:
     - title `"<title> (copy)"`;
     - slug `<slug>-copy`, then `-copy-2`, and so on, trimmed to the slug rules;
     - status `draft`;
     - featured and bestseller off;
     - variants with `id: null`, SKU `<sku>-COPY` (then `-COPY-2`, …) checked against existing SKUs;
     - `initialStock` 0;
     - the same options, prices, specs and category;
     - collection links copied only when the caller has `content.manage`, otherwise left out.
  3. Runs `productFormSchema` → `toSavePayload` → `admin_save_product`, the same RPC and validation as Create.
  4. Copies each photo with the Storage `copy()` API to `products/<newId>/<uuid>.<ext>` and inserts `product_media` in the same order with the same alt text. Variant links are dropped because the variant ids are new. A failed copy is skipped and counted.
  5. Redirects to `/admin/products/<newId>/edit?duplicated=1&photos=<n>[&rejected=<n>]`. The editor shows "Draft copy created" and any photo count.
- AR assets are **not** copied. An asset's calibration belongs to one product's artwork, and copying it would mark the draft AR READY without review.
- No migration is needed. If the RPC fails (e.g. a slug race), nothing is created. If photo copies fail after the product exists, the draft is kept and the notice says how many photos were skipped.

## Files expected to change

**New**
- `supabase/migrations/20260927090000_admin_ar_media.sql`: `ar-assets` bucket and policies, the mode/format check, the variant-belongs-to-product trigger, `admin_orphaned_storage_objects`, revokes and grants.
- `src/features/admin/ar-forms.ts`: the AR Zod schema, the mode→format map, placement→anchor lists, calibration defaults.
- `src/features/admin/ar-forms.test.ts`
- `src/features/admin/asset-signature.ts` (+ `.test.ts`): GLB and USDZ detection.
- `src/features/admin/actions/ar.ts`: upload ticket, create, update, delete, cleanup for AR.
- `src/features/admin/actions/media.ts`: cleanup action for `product-media`.
- `src/features/admin/queries/ar-editor.ts`: asset for editing, file-exists check for the list.
- `src/app/(admin)/admin/ar/new/page.tsx`, `src/app/(admin)/admin/ar/[id]/edit/page.tsx`
- `src/components/admin/ar-asset-form.tsx`, `src/components/admin/media-upload.tsx`, `src/components/admin/storage-cleanup.tsx`, `src/components/admin/product-picker.tsx` (extracted from the collection picker's search behaviour, which `collection-products.tsx` then uses)
- `tests/db/admin-ar-media.test.ts`
- Component tests in `src/components/admin/__tests__/ar-media.test.tsx`

**Changed**
- `src/lib/media/storage.ts`: `AR_ASSETS_BUCKET`, `arAssetUrl`.
- `src/features/admin/media-verify.ts`: generic object verification.
- `src/features/admin/actions/products.ts`: `duplicateProductAction`.
- `src/features/admin/queries/catalog.ts`: AR list includes the path for the file check; picker search moves to a shared query.
- `src/app/(admin)/admin/ar/page.tsx`, `media/page.tsx`, `products/[id]/edit/page.tsx`, `products/[id]/page.tsx`
- `src/components/admin/product-actions-menu.tsx`, `collection-products.tsx`
- `tests/db/harness.ts`: `storage.objects.created_at` and `metadata`.
- `src/types/database.ts`: regenerated with `npm run db:types`, never hand-edited.
- `next.config.ts`, only if `next/image` needs the `ar-assets` path pattern for previews.
- `worklog.md`: §4.5 items ticked.

## Database / migration impact

- One additive migration. No data is changed.
- The new check `(mode, asset_format)` must pass the existing seed rows: live_2d→png and live_3d→glb, which it does. The check is added `not valid` and then validated in the same migration, so a bad row fails loudly on PGlite first.
- The trigger rejects a `variant_id` from another product. The seed never does this.
- Rollback: drop the function, trigger and check, delete the `ar-assets` policies, and remove the bucket once it is empty.

## Auth / RLS

- AR: `ar.manage` at the page (`requireAdminAccess`), in the action (`authorizeAndParse`/`authorizeAdmin`), in table RLS (existing) and in Storage RLS (new).
- Media upload and cleanup: `catalog.write` at all four layers. The cleanup function also re-checks the permission for the bucket it's asked about.
- No service role is used. `admin.ts` gets no new importers.

## Validation and security

- The server chooses every storage key. Paths are regex-checked and tied to the product id. Stored bytes are verified before a row references them. Size limits apply in the browser, in Zod and in the bucket.
- The calibration JSON is strict, so no arbitrary keys go into `calibration` (§11.3).
- Cleanup only touches admin-upload prefixes, re-lists before deleting, and deletes at most 500 per click.
- Duplicate never copies stock, AR assets, featured flags or active status.

## UI reference and design constraints

No screenshot covers these screens. They use the Design System and the existing admin patterns: `PageHeader`, `Panel`, `EditorParts`, `Field`/`Select`, `Button`, `Pill`, the danger-zone pattern, and confirm dialogs. There are no new tokens, icons come from `icons.ts` (new ones added there if needed), and every control is 44 px.

## Acceptance criteria

1. An `ar.manage` user can add a live 2D PNG overlay to a product. It appears on `/admin/ar` and the product page counts it as AR READY.
2. A `.txt` renamed to `.glb`, a PNG chosen for `live_3d`, and a file over 25 MB are each rejected with an inline error. Nothing is stored.
3. Editing an asset's calibration and replacing its file works. The old uploaded file is removed.
4. Deleting an uploaded asset removes the row and the file. Seed rows show "File missing".
5. A `catalog.write` user uploads 3 photos to a chosen product from `/admin/media`, and they are added to the end of that product's gallery.
6. The cleanup panel lists only unreferenced admin uploads older than 24 hours. Cleaning them removes the files, and attached or seed files are untouched.
7. Duplicating a product gives a draft with "(copy)", a free slug, `-COPY` SKUs, zero stock, the same photos (as new files), no AR assets, and the editor opens.
8. Users without the permission get 404 on the pages, and "denied" from the actions and the SQL.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`
- DB tests (`tests/db/admin-ar-media.test.ts`):
  - the mode/format check;
  - the variant/product trigger;
  - AR RLS for owner, `ar.manage` staff, staff without it and customer;
  - Storage policies on `ar-assets`;
  - `admin_orphaned_storage_objects`: permission per bucket, 24-hour cutoff, referenced vs unreferenced, prefix filter, anon/customer denied.
- Unit tests: GLB/USDZ signatures, AR schema (mode→format, calibration bounds, unknown keys), duplicate slug/SKU naming.
- Component tests: the AR form's accepted types follow the mode and calibration is collapsed by default; the Media upload panel is hidden without `catalog.write`.
- After approval: `npm run db:push` to the dev project, then `npm run db:types`.
- Manual browser check as the owner.

## Manual test steps

1. `/admin/ar` → **Add AR asset** → pick a live product → Live 2D, Ear → upload a transparent PNG → Save. The row appears with a thumbnail and is active.
2. Change the mode to Live 3D. The file input now accepts only GLB/USDZ, and the PNG is flagged. Upload a `.glb` and save.
3. Rename a `.txt` to `.glb` and upload it. You get "That file isn't a GLB or USDZ model."
4. Open a seed asset row. It shows "File missing".
5. Delete the asset from step 1. The row and file are gone.
6. `/admin/media` → **Upload photos** → search "dhaka" → pick a product → upload 3 photos with alt text. They appear first in the library and at the end of the product's gallery.
7. On `/admin/products/new`, upload a photo and leave the page. After 24 hours (or with the test's backdated rows), the Media cleanup panel counts it, and **Clean up** removes it.
8. Products → a product's menu → **Duplicate**. The editor opens on "Name (copy)", status Draft, with `-COPY` SKUs, stock 0 and the same photos.
9. Sign in as staff without `ar.manage`: `/admin/ar/new` returns 404.

## Rollback

Revert the commit. For the database, drop `admin_orphaned_storage_objects`, the AR trigger and check, and the `ar-assets` policies, then delete the empty `ar-assets` bucket from the dashboard.

## Implementation notes (after execution)

- **Migration** `20260927090000_admin_ar_media.sql` was applied to the hosted dev project (`db:push`), and `src/types/database.ts` was regenerated. The PGlite `storage.objects` shim gained `metadata` and `created_at`.
- **"File missing" is a path check, not a Storage call.** A row counts as having a file only when its `asset_path` is a server-issued key (`products/<productId>/<uuid>.<ext>`). The seed's `ar/<slug>/…` rows show a **No file uploaded** pill on `/admin/ar`, and the editor shows the same warning. This avoids one Storage request per row.
- **Product picker.** A new single-choice `product-picker.tsx` is used by the AR editor and the Media upload. The collection editor keeps its own multi-add list. Only its search query moved into the shared `searchPickerProducts` (`queries/collection-editor.ts`), which the three search actions (collections, media, AR) call after their own permission checks.
- **AR edit keeps the product fixed.** Moving an asset to another product would leave its file in the wrong folder, so the editor asks for a new asset instead. Changing mode to one the stored file doesn't suit returns a field error on Mode until a matching file is uploaded.
- **Duplicate** lives in `actions/products.ts` as `duplicateProductAction`, with pure naming helpers in `product-form/duplicate.ts`. It appears in the product row menu and as a **Duplicate** button on the product overview and editor headers. Photos are copied with the Storage `copy()` API. Failed copies are counted and reported on the editor ("N photos couldn't be copied").
- **Cleanup** panels are on `/admin/media` (product-media, `catalog.write`) and `/admin/ar` (ar-assets, `ar.manage`). The action re-lists from SQL, deletes in batches of 100, and removes at most 500 per click.
- **Manual browser check as the owner wasn't run.** Creating a Clerk sign-in ticket for the owner was blocked in this session. Signed-out requests to `/admin/ar`, `/admin/ar/new`, `/admin/ar/<id>/edit` and `/admin/media` redirect to sign-in on the running dev server. Everything else is covered by the automated checks above and still needs the manual steps.
