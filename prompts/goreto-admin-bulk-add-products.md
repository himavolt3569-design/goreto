# Bulk add products: short cards, "Add another", up to 7 photos + 3 videos each

A separate feature requested before the next item in `worklog.md`. It does not replace the full product editor (`goreto-admin-products-crud.md`, `goreto-admin-products-new-media-slug.md`).

## Goal

1. A new page, **`/admin/products/bulk`**, for adding many products in one sitting:
   - The page starts with one short **product card**.
   - An **"Add another product"** button sits at the bottom of the list and appends a new empty card.
   - **"Create N products"** creates them all, one after another, with progress shown on each card.
2. The card is short and plain-language, not the full editor's wall of options, SKUs and specs.
3. Each product can have **up to 7 photos and 3 videos**. The limit holds everywhere: the bulk page, the full editor and the database.

## Non-goals

- Options and variants (sizes, colours), specs, care text, tags, collections, AR and merchandising flags. Each created card links to the full editor for those.
- CSV/spreadsheet import.
- Video transcoding, thumbnails or posters. Files are stored as uploaded.
- Changing the existing Add product page, apart from applying the new 7-photo cap.

## What I inspected

- `src/app/(admin)/admin/products/page.tsx` (list, "Add product" button) and `products/new/page.tsx`
- `src/components/admin/product-form/*` (`product-form.tsx`, `staged-media.tsx`, `media-manager.tsx`, `upload-photo.ts`)
- `src/features/admin/actions/products.ts`: `saveProductAction`, staging uploads, `verifyAndInsertMedia`, duplicate slug/SKU collision loop
- `src/features/admin/product-form/{schema,keys,file-signature}.ts` and `src/features/admin/media-verify.ts`
- Migrations: `catalog` (`product_media.kind` enum `image | video` already exists), `storage` (bucket `product-media`, 10 MB, images only), `admin_orphaned_size_guard` (cleanup regex), `storefront_search` (cover lateral join)
- Storefront media reads: `src/features/catalog/queries.ts`, `product-detail.ts`, `product-gallery.tsx`, and the admin thumbnails in `queries/catalog.ts`, `ar-editor.ts` and `collection-editor.ts`
- Seed: at most 4 images per product, no videos, so the new limits fit existing data.

## Decisions

### 1. The card (what staff fill in)

| Field | Notes |
|---|---|
| Product name | Required. Slug and SKU are made from it automatically and never shown. |
| Category | Required. Uses the existing category select. A **"Same as above"** default copies the previous card's category. |
| Price (Rs.) | Required. |
| Was price (Rs.) | Optional compare-at price. |
| Stock | Whole number, default `1`. |
| Short description | Optional, 200 characters, one textarea. |
| Photos | Up to 7. A drop zone plus a thumbnail strip: first photo = Cover, drag-free Move left/right, Remove. |
| Videos | Up to 3, MP4 or WebM, ≤ 50 MB each. Same strip, with a play-icon tile and the file name. |
| Publish now | A switch, off by default (draft). It can only be turned on when the card has at least one photo. |

- Alt text defaults to the product name, plus " – photo 2" and so on. It can be edited later in the full editor. This keeps the card short and stops the "missing alt text" warning from appearing everywhere.
- Each card has a small header with "Product 3", a Duplicate card button (copies category and prices, not media) and a Remove card button.
- At most **20 cards** per batch, so one sitting stays reliable.
- On desktop the card is two columns: fields on the left, media on the right. On mobile it stacks. It uses existing primitives only: `Card`, `Field`, `Input`, `Select`, `Button`, `Badge` and Phosphor icons from `icons.ts`.

### 2. Creating

- The client validates every card first (with a shared `quickProductSchema`) and scrolls to the first error.
- It then calls **`quickCreateProductAction(card, media)`** once per card, in order. Each call:
  1. authorizes `catalog.write`;
  2. parses with Zod;
  3. picks a free slug and SKU (`GRT-<STEM>-STD`) using the same collision loop as Duplicate, so two "Silver Hoop" cards both succeed;
  4. builds a normal `ProductFormValues` (no options, one variant, stock as initial stock) and saves it through the existing `admin_save_product` RPC;
  5. verifies and attaches staged media in order (photos first, then videos).
- Per-card status: *Waiting → Creating… → Created* (with "Open in editor" and "View on store" links) or *Failed* (inline message, card stays editable).
- When all cards are done, a summary shows "8 created, 1 needs attention". **Retry failed** re-runs only the failed cards, and created cards collapse into a compact row.
- Products are not created atomically as a batch. Each product is atomic, as today. A failure in card 4 does not undo cards 1–3, and the summary says so.
- Leaving the page with unsent cards triggers the browser's unsaved-changes warning.

### 3. Videos

- **Formats:** MP4 (`ftyp` box whose brand is not `avif/avis`) and WebM (EBML `1A 45 DF A3`), detected from the file's first bytes in the browser and again on the server, like photos. MOV files are rejected with the hint "Export as MP4". iPhone HEVC `.mov` doesn't play in most browsers.
- **Size:** up to 50 MB each. That is Supabase's default per-file upload limit. Photos stay at 10 MB.
- **Paths:** `products/<productId|new-stagingId>/<uuid>.(mp4|webm)`. The server picks the path, signs the upload and verifies it, the same as photos. The existing `uploadImageFile` flow is generalized to `uploadMediaFile(kind)`.
- **Storefront:** the product gallery shows videos after the photos. The thumbnail is a neutral tile with a play icon and "Video". The main frame renders `<video controls playsinline preload="metadata" muted>`, with no autoplay, and respects reduced motion. Cards, search results, admin thumbnails, collection pickers and the cart all keep using **images only**. Every `product_media` cover query gains `kind = 'image'`, so a video can never become a cover.
- **Full editor:** `media-manager.tsx` accepts videos too, with the same list, remove and reorder. The variant link applies to photos only. Duplicate copies videos as well.

### 4. Limits enforced in three places

- The UI disables upload at 7 photos / 3 videos and explains why.
- Server actions count existing rows before attaching.
- A **database trigger** on `product_media` (before insert, or update of `product_id`/`kind`) raises `22023` when a product would exceed 7 images or 3 videos. It takes a row lock on the parent product, so two concurrent uploads can't both pass.
- `MAX_STAGED_PHOTOS` drops from 30 to 7 on the existing Add product page.

### 5. Entry point

- The Products list header changes to **"Add products"** (primary, → `/admin/products/bulk`) plus **"Full form"** (secondary, → `/admin/products/new`) for products that need variants on day one.
- The sidebar is unchanged: Catalog → Products.

## Files expected to change

New:
- `supabase/migrations/<ts>_product_media_videos.sql`
- `src/app/(admin)/admin/products/bulk/page.tsx`
- `src/components/admin/bulk-products/bulk-products-form.tsx` (list, Add another, Create all, summary)
- `src/components/admin/bulk-products/product-card.tsx` (one card)
- `src/components/admin/bulk-products/media-strip.tsx` (photos + videos picker, used by the bulk card)
- `src/features/admin/product-form/quick-product.ts` (`quickProductSchema`, `toProductFormValues`, alt text defaults)
- `src/features/admin/product-form/media-limits.ts` (`MAX_PHOTOS = 7`, `MAX_VIDEOS = 3`, `MAX_VIDEO_BYTES`)
- Tests: `quick-product.test.ts`, `file-signature.test.ts` (video detection), `__tests__/bulk-products-form.test.tsx`, plus DB test cases

Changed:
- `src/features/admin/product-form/file-signature.ts`: `detectVideoFormat`, video content types
- `src/features/admin/media-verify.ts`: `verifyStoredVideo`
- `src/features/admin/actions/products.ts`: `quickCreateProductAction`, video-aware upload ticket, attach, staging, discard and duplicate, limit counts, shared slug/SKU resolver
- `src/components/admin/product-form/upload-photo.ts` → generalized media upload
- `src/components/admin/product-form/media-manager.tsx` and `staged-media.tsx`: videos and limits
- `src/app/(admin)/admin/products/page.tsx`: header buttons
- `src/features/catalog/queries.ts`, `product-detail.ts`, `types.ts`, `src/components/store/product/product-gallery.tsx`: `kind` on media, video rendering
- `src/features/admin/queries/{catalog,ar-editor,collection-editor,product-editor}.ts`: image-only covers, `kind` in editor media
- `src/app/(admin)/admin/products/[id]/page.tsx`: count "N photos, M videos"
- `src/types/database.ts`: regenerated with `npm run db:types`, not hand-edited
- `worklog.md`

## Database impact

One migration:

1. `update storage.buckets set file_size_limit = 52428800, allowed_mime_types = array[...images, 'video/mp4', 'video/webm'] where id = 'product-media'`. The per-type limits (10 MB images / 50 MB videos) stay enforced in the app and server verification.
2. A trigger function `product_media_enforce_limits()`: `security definer`, `search_path = ''`. Execute is revoked from `public/anon/authenticated`, following `harden_grants`.
3. `admin_orphaned_storage_objects` is re-created with `mp4|webm` added to the product-media path regex.
4. `search_products` is re-created with `and pm.kind = 'image'` in the cover join. Same signature and grants.

There is no data change: existing rows are all images and under the limits. Rollback means dropping the trigger and function, then restoring the previous bucket values and function bodies from the earlier migrations.

## Auth / RLS

- No new tables or policies. All actions require `catalog.write` (`authorizeAdmin`). The RPC and Storage policies check again.
- Videos sit in the existing public `product-media` bucket. That's fine for merchant catalog media. Customer try-on media stays separate (§10.4).

## Validation and security

- Zod at every boundary: card fields, staged media list (≤ 7 image paths + ≤ 3 video paths tied to the staging id), and upload ticket (content type + size per kind).
- File type comes from the bytes, never the extension, checked in the browser and on the server. Rejected files are deleted.
- Prices are parsed to paisa on the server (`parseRupeesToPaisa`). The browser never sends paisa as truth.

## UI references

- Design System tokens only: 44 px controls, 12 px radius, orange primary, soft shadows, 4 px spacing scale.
- The card follows the Admin Dashboard's configuration-card language.
- There is no screenshot for this page. Composition follows §4.7: sectioned and short, with progressive disclosure through "Open in full editor".

## Acceptance criteria

1. `/admin/products/bulk` opens with one card. "Add another product" appends a card at the bottom and focuses its name field.
2. Three cards with photos and videos create three draft products. Each shows Created with working editor links.
3. An 8th photo or 4th video can't be added. The UI explains why, and a forced server or DB attempt fails.
4. A `.mov`, a renamed `.txt`, or a 60 MB MP4 is rejected with a clear message.
5. Two cards with the same name both create, with distinct slugs and SKUs.
6. One failing card (bad price) doesn't block the others. Retry failed works after fixing it.
7. On the storefront, a product with a video shows it in the gallery after the photos and plays with controls. Cards and search show the cover photo, never a video.
8. A user without `catalog.write` gets 404 on the page and denial from the action.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db` (trigger limits, bucket update, orphan regex, search cover), `npm run build`. Then `npm run db:push` and `npm run db:types` against the dev project.

## Manual test steps

1. Products → **Add products**. One card is shown.
2. Fill card 1 (name, category, price, stock 5) and add 3 photos plus 1 MP4. Move photo 3 to Cover.
3. Click **Add another product** twice. Use "Same as above" for the category on the new cards.
4. Try an 8th photo, a 4th video and a `.mov` file. Each is blocked with a message.
5. Leave card 3's price empty and click **Create 3 products**. Card 3 is flagged, and cards 1–2 are created.
6. Fix card 3 and click **Retry failed**. All three are created.
7. Open card 1 in the full editor. The media order matches, and the video is listed.
8. Publish card 1 and open it on the storefront. The video plays from the gallery, and the product card shows the photo cover.

## Branch

This work goes on a new branch, `feat/bulk-product-add`. The uncommitted quick-view work on `feat/discovery-quick-view` must be committed or stashed first so the two features don't mix.

## Implementation notes (after execution)

- **Invalid cards don't block valid ones.** The plan had two conflicting rules: "validate every card first" and acceptance step 5 ("card 3 is flagged, and cards 1–2 are created"). Acceptance step 5 wins. Create validates all cards, flags and focuses the first invalid one, and still creates every valid card. A flagged card stays flagged until it's sent again, so the button reads **Retry**.
- **Blank cards are ignored.** A card nobody touched (for example, the last one after "Add another") isn't sent.
- **"Same as above" became the default.** A new card starts with the previous card's category, so there's no extra option. **Duplicate** copies category, prices, stock and description, but not the name or media.
- **Limits live in `file-signature.ts`** (`MAX_PHOTOS`, `MAX_VIDEOS`, `MAX_VIDEO_BYTES`, video detection), next to the image rules. No separate `media-limits.ts` was needed.
- **Staged media payload.** The payload is renamed `photos` → `media` (`{ path, altText }[]`, photos then videos). The full Add product form sends the same shape. Empty alt text is filled from the product name only on Bulk add.
- **Slug/SKU collisions.** `freeKeys` looks up the exact slug and SKU and numbers past existing ones (`-2`, `-3`, …). It also retries once if a concurrent save hits the unique constraint.
- **Video detection.** MP4 is any `ftyp` box whose brand isn't QuickTime (`qt  `), HEIF/AVIF or audio-only (`M4A `/`M4B `). WebM is identified by its EBML header. MOV gets a specific "Export it as MP4" message.
- **Storefront.** `ProductMedia` has a `kind`. `mediaForVariant` puts videos last. The cart image, swatches and the try-on preview use photos only. The gallery plays a video in the main frame and in the lightbox, with controls and no autoplay. "View larger" is hidden for videos.
- **Admin thumbnails.** `Thumb` takes `kind` and shows a video's first frame with a play icon. Every admin cover query filters `kind = 'image'`.
- **Top-bar quick action.** "Add product" now opens Bulk add.
- **Build check.** The build ran with a temporary `distDir` because `.next` can't be cleaned on this machine (folder ACL). The config was restored afterwards.
