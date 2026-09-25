# Add product: photos before creating, and a stronger URL slug

Follow-up to `goreto-admin-products-crud.md`, from user feedback on the Add product page.

## Goal

1. **Photos on Add product.** The Add product page gets a Media section. Photos can be uploaded, described, reordered and removed **before** the product exists, and are attached when **Create product** is clicked.
2. **URL slug.** The slug is generated from the product name with visible validation and a word count, and can also be typed by hand.

## Non-goals

- Linking a photo to a variant before the product exists. New variants have no ids until they're saved, so that choice is made in the editor after creating.
- No database migration. `product_media.storage_path` is only an object key, so photos uploaded before creation keep the path they were uploaded to.
- Cleanup of photos uploaded to an Add product page that is then abandoned. This is the existing orphaned-upload gap, noted as a follow-up.

## Decisions

### 1. Staged photos

- The Add product page creates a **staging id** (a server-side `randomUUID()`) for this form session.
- Uploads go to `products/new-<stagingId>/<uuid>.<ext>`. The server still picks the path and signs the upload URL with the caller's session, so the Storage `catalog.write` policy applies.
- `createProductMediaUploadAction` accepts either `{ productId }` (existing product, must exist) or `{ stagingId }` (new product).
- The Add product form shows a **Media** section:
  - upload (same browser checks: image type from the file's bytes, ≤ 10 MB, small-image warning);
  - thumbnail preview from the local file;
  - alt text;
  - Move up/down;
  - Remove. Remove deletes the uploaded object through a new `discardStagedMediaAction`, which only accepts paths under that staging id.
  - First photo = Cover.
- `saveProductAction(null, input, stagedMedia)`:
  1. creates the product;
  2. for each staged photo, in order, **verifies the stored bytes** (same signature and size check as today) and inserts `product_media` with its alt text and sort order;
  3. deletes rejected files.

  The existing check-and-insert code becomes one shared helper used by both the editor and create. The redirect notice then says how many photos were added, plus any that were rejected.
- Staged photos are validated with Zod (path pattern tied to the staging id, alt text ≤ 200, at most 30 photos).
- The Media section appears on Add product in the same place as the editor's.

### 2. URL slug

- **Limits:**
  - 3–80 characters;
  - at most **8 words** (dash-separated);
  - lowercase letters, digits and single dashes, not starting or ending with a dash.

  The longest seed slug is 5 words / 36 characters, so existing products stay valid. The database keeps its format check and uniqueness.
- **Auto mode (default for new products):** the slug follows the product name as you type, using the first 8 words and at most 80 characters. Accents are stripped and symbols dropped.
- **Manual mode:** typing in the slug field switches to custom.
  - Spaces and underscores become dashes as you type; everything else is cleaned on blur.
  - A **"Generate from name"** button switches back to auto.
  - On the edit page the slug starts in custom mode, and the existing warning about breaking shared links stays.
- **Live hint:** under the field, `goreto.store/products/<slug> · N/8 words · N/80 characters` in plain text, plus an "Auto from name" or "Custom" label. Errors are inline and name the rule that failed (too short, too many words, invalid characters).
- The same rules apply in the shared schema (browser and server). "Slug already used" still comes from the database.

## Files expected to change

- `src/features/admin/product-form/keys.ts`: slug rules (`SLUG_MAX_WORDS`, `SLUG_MAX_LENGTH`, `slugFromTitle` word cap, `sanitizeSlugInput`)
- `src/features/admin/product-form/schema.ts`: slug validation messages; staged media schema
- `src/features/admin/actions/products.ts`: staging support in upload/create; shared verify-and-insert helper; `discardStagedMediaAction`
- `src/components/admin/product-form/detail-sections.tsx`: slug field (auto/custom, counts, Generate from name)
- `src/components/admin/product-form/product-form.tsx`: slug mode state; staged media passed to save
- `src/components/admin/product-form/staged-media.tsx` (new): Media section for Add product
- `src/components/admin/product-form/media-manager.tsx`: share the upload helper
- `src/app/(admin)/admin/products/new/page.tsx`: staging id
- `src/app/(admin)/admin/products/[id]/edit/page.tsx`: notice with photo count
- Tests: `product-form.test.ts` (slug rules), `__tests__/product-form.test.tsx` (auto/custom slug, staged photos list)

## Security

- Only `catalog.write` can request staging uploads. The server picks the paths, and they are tied to the staging id sent with create and discard. Stored bytes are verified before any row is inserted.
- The staging id isn't secret authority. All callers already hold `catalog.write`, which can write the bucket anyway.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`

## Manual test steps

1. On `/admin/products/new`, type the name "Hand Woven Dhaka Topi With Silver Pin For Festival Wear Extra". The slug shows 8 words and "Auto from name".
2. Type a custom slug with spaces, e.g. "dhaka topi festival". It becomes `dhaka-topi-festival`, labelled Custom. Click **Generate from name** to switch back.
3. Try `ab` and a 9-word slug. Each shows an inline error.
4. Upload 3 photos, add alt text to one, move one up, and remove one.
5. Create the product. The editor opens with "Product created with 2 photos", in the order you chose.
6. Upload a `.txt` renamed to `.jpg` on Add product. It's rejected.

## Implementation notes (after execution)

- **Shared upload helper.** The browser upload code moved into `components/admin/product-form/upload-photo.ts`, which the editor's media manager and the new `staged-media.tsx` both use. On the server, one `verifyAndInsertMedia` helper handles the editor's attach and the staged attach on create.
- **Photo limit location.** `MAX_STAGED_PHOTOS` (30) lives in `file-signature.ts`, because a `"use server"` module may only export async functions.
- **Staged state.** Staged photos live in the form's React state and use functional updates. Local previews are object URLs, revoked when a photo is removed or the page closes.
- **Where the section sits.** On Add product, Media sits right after Basic information, so it's visible without scrolling past the variants.
- **Redirect after create.** It carries `photos=<n>` and, when any failed the server check, `rejected=<n>`. The editor shows "Product created with N photos" and an error notice for rejected ones.
- **Slug field.** "Generate from name" is disabled while the slug is already in auto mode. The live hint shows the URL, the word and character counts (red when over), and Auto/Custom.
