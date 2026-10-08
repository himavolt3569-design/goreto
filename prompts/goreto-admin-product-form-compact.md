# Admin product form: shorter, clearer, same data

## Goal

Client feedback: "Product adding page is very long and very confusing. Can we make it more beautiful and easy, not long or big, with all the current data?"

Restructure the shared Add/Edit product form (`/admin/products/new`, `/admin/products/[id]/edit`) so a normal product can be added from one short screen. Every field that exists today stays available.

## Non-goals

- No schema, database, server action or validation changes. The form submits exactly the same `ProductFormValues` as today.
- No fields removed. "All the current data" stays.
- Bulk add (`/admin/products/bulk`) is not changed; it is already the short-card flow.
- The edit page's Media manager, AR panel and danger zone below the form stay as they are.

## Inspected

- `src/app/(admin)/admin/products/new/page.tsx` and `[id]/edit/page.tsx`.
- `src/components/admin/product-form/`:
  - `product-form.tsx`: seven stacked cards plus the status sidebar;
  - `detail-sections.tsx`: Basic, Pricing, Specs & care, Inventory, Merchandising;
  - `options-variants-section.tsx`: option editor plus an 880px variants table, shown even for a one-variant product;
  - `staged-media.tsx`, `fields.tsx`.
- `__tests__/product-form.test.tsx` (13 tests).
- `prompts/goreto-admin-products-crud.md` and `goreto-admin-products-new-media-slug.md`.
- AGENTS §4.7: sectioned, add and edit on the same structure, progressive disclosure for advanced fields.
- `designs/goreto-admin.png` and the Design System image (tokens, cards, inputs).

## Why it feels long today

- Seven full-width cards, each with a title, a description and generous padding.
- Most products have **no options**. They still get the option editor and a wide seven-column variants table just to enter one SKU and a stock count.
- The URL slug, low-stock threshold, weight and SKU are technical fields that sit in the main path, even though they have good defaults.
- Long help text sits under almost every field.

## Decisions

1. **Two zones: "Essentials" always open, "More details" folded.**
   - **Essentials** is one card with what every product needs:
     - name and category side by side;
     - price and compare-at price side by side;
     - stock (and SKU) when the product has no options;
     - short description;
     - photos (Add page; the edit page keeps its Media manager below the form).
   - **More details** holds collapsible sections. Each folded header shows a one-line summary of what's set, so nothing is hidden silently:
     - **Description & specifications**: full description, the spec rows and care instructions. Summary: "3 specs · care added".
     - **Options & variants**: the existing editor, unchanged inside. Summary: "Colour, Size · 6 variants" or "No options (single product)".
     - **Badges, tags & collections**: Featured, Bestseller, Limited and Sponsored become a compact row of toggle chips. Tags and collections follow. Summary: "Featured · 4 tags · 1 collection".
     - **Advanced**: URL slug (auto from name, as today), low-stock alert, and for a single product its weight and active state. Summary: "goreto.store/products/pearl-drop-earrings · alert at 3".
2. **Single product without the table.** With no options, the one variant's Stock and SKU appear in Essentials, and its weight in Advanced. Adding the first option shows the variants table inside Options & variants exactly as today. The data path is unchanged (`variants[0]`).
3. **Errors are never hidden.** On submit (and after server errors), every folded section that contains an invalid field opens. That section's header shows an "N to fix" badge, and focus goes to the first invalid field.
4. **Default open state.** On Add, only Essentials is open. On Edit, Essentials is open and the other sections are folded with their summaries. The open/closed state is local UI state; nothing is persisted.
5. **Tighter visual rhythm** within the existing design tokens:
   - section padding goes from 24px to 16–24px;
   - most hints become short placeholders or a single line;
   - textareas are shorter (description 4 rows, short description 2).

   The headers use the existing Card, `text-h3` and Phosphor caret, matching the storefront accordions. Nothing goes off-token.
6. **Sticky save.**
   - On desktop the right sidebar stays: Status plus Save.
   - It gains a small "On this page" list that jumps to and opens each section, with error counts.
   - Below `xl`, a sticky bottom bar shows the status select and the Save button, so a mobile user never scrolls to the end to save.
7. **Accessibility.**
   - Headers are real `<button aria-expanded aria-controls>` elements.
   - Collapsed content stays mounted (hidden with the `hidden` attribute), so React Hook Form keeps every field registered and validated.
   - Keyboard and focus-visible work as today, and motion respects reduced-motion.

## Files expected to change

- `src/components/admin/product-form/product-form.tsx`: two-zone layout, section open state, error-driven opening, sticky mobile bar, sidebar section list.
- `src/components/admin/product-form/fields.tsx`: new `CollapsibleSection` (header, summary, error badge) next to `FormSection`.
- `src/components/admin/product-form/detail-sections.tsx`:
  - split into `EssentialsSection`, `DescriptionSpecsSection`, `MerchandisingSection` (chip toggles) and `AdvancedSection` (slug, low stock, single-variant weight/active);
  - summaries.
- `src/components/admin/product-form/options-variants-section.tsx`: hide the table when there are no options (single-variant fields move out); export a summary helper.
- `src/components/admin/product-form/staged-media.tsx`: a compact grid variant for inside Essentials.
- `src/components/admin/product-form/__tests__/product-form.test.tsx`: update the selectors, and add tests for:
  - errors opening folded sections;
  - single-product stock in Essentials;
  - the summaries;
  - the aria-expanded wiring.

## Database / auth / RLS

None. Same Server Action (`saveProductAction`), same `catalog.write` and `content.manage` checks, same schema.

## Acceptance criteria

1. On Add product at 1440px, the name, category, price, stock, short description, photos, status and Create button all fit on about one screen without scrolling past the Essentials card.
2. Every field available today is still reachable and saves exactly as before. A full round trip of all fields on edit leaves the stored product unchanged.
3. A product with no options never shows the variants table. Adding an option shows it.
4. Submitting with an error in a folded section opens that section, marks it "N to fix" and focuses the field.
5. Works at 390px with a sticky save bar and no horizontal page scroll. The variants table scrolls inside its own region as today.
6. Typecheck, lint, `npm test` and the build pass.

## Checks

`npm run typecheck`, `npm run lint`, `npm test` (product-form tests in particular), and a production build against dev. A manual pass needs a signed-in owner (see the steps below); I'll do what I can headless and say what I couldn't.

## Manual test steps

1. Open `/admin/products/new`. You should see one Essentials card, four folded sections with summaries, and Status and Create on the right.
2. Enter a name, category, price and stock, add a photo and create. The editor opens and the product is saved with one variant.
3. Open **Options & variants**, add Colour with two values and choose Update variants. Fill in the table and save.
4. Clear the price and fold everything, then press Save. Essentials shows the error. Break a spec label instead, and Description & specifications opens with "1 to fix".
5. At phone width, the sticky Save bar stays visible and works.

## Rollback

UI only: revert the commit.
