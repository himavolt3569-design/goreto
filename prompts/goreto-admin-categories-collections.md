# Admin phase 2: categories and collections (create, edit, delete)

Phase 2 of the admin CRUD work (see `worklog.md` §4.5 and the non-goals in `goreto-admin-products-crud.md`). Phase 1 (product editor) only *links* products to existing categories and collections. This phase lets the owner and permitted staff manage those records themselves.

## Goal

1. **Categories** (`catalog.write`): add, edit and delete categories and subcategories from `/admin/categories`.
2. **Collections** (`content.manage`): add, edit and delete campaign collections from `/admin/promotions`, including choosing and ordering the products in a collection and its schedule.
3. One image per category / collection, uploaded with the same signed, server-verified flow the product editor uses.

## Non-goals

- Coupons, couriers, zones, rates (phase 3). Staff invites and AR asset upload (phase 4).
- Storefront `/collections` pages (worklog §4.2). The admin links a collection to its future URL only as text.
- Drag-and-drop ordering. Ordering uses Move up/down buttons and a numeric sort order, like the product media manager.
- Cleanup of images uploaded to a form that is then abandoned (existing orphaned-upload gap).
- Deeper category trees. The storefront, the Select tree and the seed are all two levels; this phase makes that a database rule.

## Inspected

- `AGENTS.md` §3, §4.6–4.8, §7, §10, §11.2, §16, §18.3–18.7, §26.
- Migrations `catalog` (categories, collections, collection_products, RLS: categories → `catalog.write`, collections and links → `content.manage`), `storage` (product-media bucket: writes need `catalog.write`), `harden_grants`, `admin_product_editor` (RPC and grant conventions).
- `src/app/(admin)/admin/categories/page.tsx`, `promotions/page.tsx`, `content/page.tsx`, `products/new`, `products/[id]/edit`.
- `src/features/admin/actions/{catalog,products,helpers}.ts`, `auth.ts`, `schemas.ts`, `nav.ts`, `queries/{catalog,engagement,product-editor}.ts`.
- `src/features/admin/product-form/{keys,file-signature}.ts`, `components/admin/product-form/{upload-photo,staged-media,detail-sections,fields,delete-product}.tsx`, `components/admin/{action-forms,admin-ui,settings-form}.tsx`.
- `src/features/catalog/{categories,category-options,queries,mappers}.ts` (storefront reads, the `catalog` cache tag).
- `tests/db/harness.ts`, `tests/db/admin-products.test.ts`.
- Seed: 38 categories (12 top-level, none deeper than 2 levels), 6 collections. Seed images live at `categories/<slug>.jpg` and `collections/<slug>.jpg`.
- Next docs: `revalidateTag.md`, `updateTag.md`, `refresh.md`. The existing `revalidateStorefrontCatalog` helper (`revalidateTag(tag, { expire: 0 })` + paths) is reused.

## Decisions

### Categories

- **Routes:** `/admin/categories/new` and `/admin/categories/[id]/edit` (pages need `catalog.write`; the list stays `catalog.read`). The list gets an **Add category** button, an Edit link per row, and "Add subcategory" per top-level row (`/admin/categories/new?parent=<id>`).
- **Form sections** (one card each, FormData + `useActionState`, submitted by hand so fields survive errors, like `SettingsForm`):
  - Basic information: name (required, ≤ 80), URL slug, parent ("None — top-level category" or a top-level category), description (≤ 500).
  - Image: one photo (upload / replace / remove) with preview.
  - Visibility and order: shown on storefront (checkbox), sort order (0–9999, lower first).
- **Slug:** same rules and live hint as the product slug (3–80 characters, ≤ 8 words, auto from name until typed). The hint reads `goreto.store/categories/<slug>`. Editing an existing slug shows the "breaks shared links" warning. The auto/custom slug input becomes a shared `SlugField` component used by the new forms; the product editor's slug hint reuses its hint piece.
- **Two levels only (database rule):** a trigger on `categories` rejects a parent that itself has a parent, and rejects giving a parent to a category that has subcategories (`22023`, detail `parentId`, shown inline). In the form, a category with subcategories has its parent select disabled with a hint.
- **Delete:** only when the category has no products (any status) and no subcategories. `admin_delete_category(id)` checks and raises readable messages; otherwise the danger zone says why and offers Hide instead. Deleting removes the uploaded image from storage.

### Collections

- **Routes:** `/admin/promotions/new` and `/admin/promotions/[id]/edit` (`content.manage`). The Promotions list gets **Add collection** and an Edit link per row.
- **Form sections:**
  - Basic information: title (≤ 120), URL slug (hint `goreto.store/collections/<slug>`), eyebrow (≤ 40, e.g. "New collection"), description (≤ 300).
  - Hero image: one photo plus alt text. Alt text is required when an image is set.
  - Schedule and visibility: enabled (checkbox), starts / ends (`datetime-local`, entered and shown in Asia/Kathmandu, both optional, end after start), sort order.
  - Products: ordered list (thumbnail, title, status pill) with Move up/down and Remove; an **Add products** search box (debounced server action, max 20 results, excludes products already listed). Max 200 products.
- **Live state** in the header uses the existing `CollectionStatePill` (Live / Scheduled / Ended / Off).
- **Save** goes through `admin_save_collection(id, collection jsonb, product_ids uuid[])` so the collection row and its ordered product links change in one transaction (security invoker: RLS `content.manage` applies; the function checks it too and validates dates, slug and ids).
- **Delete** is always allowed (links cascade; products are untouched), from a confirm dialog. Removes the uploaded hero image from storage.

### Images (both)

- New `createCatalogImageUploadAction({ kind: "category" | "collection", ownerId | stagingId, contentType, size })`: `category` needs `catalog.write`, `collection` needs `content.manage`. The server chooses the path: `categories/<id|new-<stagingId>>/<uuid>.<ext>` / `collections/...`, and signs it with the caller's token.
- On save, a **changed** image path must match that pattern for this record (or this form's staging id); the server verifies the stored bytes (signature + size, the product editor's check, moved to a shared server-only helper) before writing `image_path` / `hero_image_path`, and deletes a rejected upload.
- The old object is removed from storage after a successful replace/remove/delete **only if it is an admin upload** (matches the pattern above). Seed images (`categories/<slug>.jpg`) are left for `seed:purge`.
- **Storage policy (migration):** `content.manage` staff may select/insert/update/delete objects under `collections/` in `product-media`. Today only `catalog.write` can write the bucket, so a content-only staff member couldn't upload a hero image.
- The browser half reuses `upload-photo.ts` (bytes pre-check, ≤ 10 MB, small-image warning), generalized to take the ticket action as a parameter.

### Revalidation

- Category changes: `revalidateStorefrontCatalog()` (catalog tag, `/`, `/categories`) plus `/categories/<old slug>` and `/categories/<new slug>`.
- Collection changes: catalog tag and `/` (homepage carousel).

## Files expected to change

- `supabase/migrations/<ts>_admin_categories_collections.sql` (new): two-level trigger, `admin_delete_category`, `admin_save_collection`, storage policies for `collections/`, grants.
- `src/types/database.ts`: regenerated (`npm run db:types`).
- `src/features/admin/media-verify.ts` (new, server-only): `readObjectHead`, `verifyStoredImage`, shared by product and catalog-image actions.
- `src/features/admin/actions/products.ts`: use the shared verifier (no behaviour change).
- `src/features/admin/actions/catalog-images.ts` (new): upload ticket action.
- `src/features/admin/actions/categories.ts` (new): save, delete.
- `src/features/admin/actions/collections.ts` (new): save, delete, product search.
- `src/features/admin/catalog-forms.ts` (new): Zod schemas for both forms, image path patterns, Kathmandu datetime helpers.
- `src/features/admin/queries/catalog.ts`, `queries/engagement.ts`: editor reads (category by id with child count/product count; collection by id with ordered products).
- `src/components/admin/slug-field.tsx` (new), `components/admin/image-field.tsx` (new), `components/admin/category-form.tsx` (new), `components/admin/collection-form.tsx` (new), `components/admin/collection-products.tsx` (new).
- `src/components/admin/product-form/upload-photo.ts`, `detail-sections.tsx`: generalized upload, shared slug hint.
- Pages: `admin/categories/{page,new/page,[id]/edit/page}.tsx`, `admin/promotions/{page,new/page,[id]/edit/page}.tsx`.
- Tests: `src/features/admin/catalog-forms.test.ts`, `src/components/admin/__tests__/catalog-forms.test.tsx`, `tests/db/admin-categories-collections.test.ts`.

## Auth / RLS

- Pages: `requireAdminAccess("catalog.write")` / `("content.manage")`. Actions: `authorizeAdmin` again, then Zod, then RLS, then the SQL function's own check.
- No service role. All writes run on the Clerk-token client.
- New functions: `security invoker`, `set search_path = ''`, execute revoked from `public, anon`, granted to `authenticated`.

## Acceptance criteria

- Owner creates a top-level category with an image, then a subcategory under it; both appear in the product editor's category Select and (when active) on `/categories`.
- Choosing a subcategory as parent is impossible in the UI and rejected by the database.
- A category with products or subcategories can't be deleted; the message says why. An empty one deletes and its uploaded image is removed.
- Owner creates a collection with a hero image, alt text, schedule and 3 ordered products; the Promotions list shows the right state and count; reordering persists; the homepage carousel shows it while live.
- A `content.manage`-only staff member can manage collections (including the hero image) but gets 404 on category editing; a `catalog.write`-only staff member the reverse.
- Invalid slugs, duplicate slugs, end-before-start, missing alt text and a renamed `.txt` image each show an inline error.
- Keyboard: all controls reachable, dialogs trap and return focus, Move up/down announce state; empty/error states present.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`
- `npm run db:push` then `npm run db:types` against the hosted **dev** DB.
- Browser check of both editors as the owner.

DB tests (PGlite, per role): two-level trigger (both directions); `admin_delete_category` with products / children / empty, and denied for non-`catalog.write`; `admin_save_collection` create + update + product order replacement, denied for staff without `content.manage` and for customers/anon; date validation; storage policy lets `content.manage` write under `collections/` only.

## Manual test steps

1. `/admin/categories` → **Add category**. Name "Festive Wear"; slug follows. Upload an image, leave it visible, save. It opens its edit page with "Category created".
2. On the Festive Wear row, **Add subcategory** → "Saris". Parent is preselected. Save.
3. Edit "Saris": the parent list offers only top-level categories. Edit "Festive Wear": the parent list is disabled (it has subcategories).
4. Try to delete "Festive Wear": blocked (has subcategories). Delete "Saris", then "Festive Wear": both go; the image is gone from storage.
5. Try deleting a seeded category with products: blocked, offers Hide.
6. `/admin/promotions` → **Add collection** "Dashain Edit". Upload a hero image without alt text → inline error; add alt text. Set starts tomorrow 09:00. Add 3 products, move the last one up. Save → state "Scheduled", 3 products.
7. Change the start to the past → "Live"; the homepage carousel shows it (after refresh).
8. Delete the collection → gone from the list; its products still exist.
9. Upload a `.txt` renamed to `.jpg` → rejected.

## Rollback

- The migration only adds a trigger, functions and storage policies; no data changes. Rollback: drop the trigger, the two functions and the three `collections/` storage policies.

## Implementation notes (after execution)

- **Content-only staff could not see scheduled or switched-off collections.** Collections were readable only when live or with `catalog.read`, but Promotions is gated by `content.manage`. The migration adds a `content.manage` read policy.
- **Linked products the editor can't read** (drafts, for staff without `catalog.read`) are kept in the list by id as "Hidden product". Saving therefore never drops them.
- **Category delete** handles `restrict_violation` as well as `foreign_key_violation`. `products.category_id` is `ON DELETE RESTRICT`, which raises 23001, not 23503.
- **The parent select is disabled** for a category that has subcategories. Disabled selects don't submit, so a missing `parentId` means top-level. For the same reason, the collection alt text defaults to "" when the field is disabled because there's no image.
- **Where the code lives:** `media-verify.ts` holds the shared stored-bytes check, used by products and catalog images. `upload-photo.ts` has a generic `uploadImageFile(file, requestTicket)`. `SlugHint` is shared with the product slug field.
- **Removing a just-uploaded image before saving** leaves the file in storage. This is the existing orphaned-upload gap.
- **Browser check:** Playwright ran as the owner against the dev server and the hosted dev DB. It checked create, subcategory, blocked delete, duplicate slug, deleting both categories, collection create with image, schedule, 3 products and a reorder, the missing-alt error, collection delete, and mobile overflow. Test records were deleted afterwards.
