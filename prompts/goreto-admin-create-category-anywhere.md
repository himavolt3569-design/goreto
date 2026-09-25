# Create a category from any category dropdown

Follow-up to `goreto-admin-categories-collections.md`, from user feedback.

## Goal

- Every admin category dropdown used for *choosing* a category gets a **"+ Create new category"** option at the bottom. This covers the product editor's Category field, and the Parent field on Add/Edit category, where the option reads "+ Create new parent category".
- Choosing it opens the Add category form as a **pop-up over the current form**, so nothing already typed is lost. After **Create category**, the pop-up closes and the new category is selected in that dropdown.
- The Parent dropdown's pop-up creates a **top-level** category and has no parent field. Top-level categories can also still be made from the full page ("None — top-level").
- `/admin/categories/new` keeps working as a full page.

## Non-goals

- The products list filter dropdown. It filters, it doesn't choose, so it gets no create option.
- A parent and its first subcategory created in one form (user chose the dropdown option instead).
- A Next.js intercepted-route modal. The pop-up is a client dialog reusing the same `CategoryForm`, so a pop-up opened from inside the category form works too (a top-level category from the Parent field). Nesting intercepted routes for that would be awkward.

## Decisions

- **Dialog:** a native `<dialog>` opened with `showModal`, rendered into `document.body` through a portal. This keeps its `<form>` outside the product form's DOM.
  - React bubbles events through portals, so the category form's submit calls `stopPropagation`. Otherwise the product form would submit too.
  - Focus moves into the dialog and returns to the dropdown on close. Escape closes it.
  - A new `crypto.randomUUID()` staging id per opening covers the image upload.
- **`CategoryForm` variants:**
  - `page`: today's layout.
  - `dialog`: single column, with Visibility and Sort order under the image, and Create/Cancel buttons.
  - `topLevelOnly`: hides the parent field.
- **Server:** `createCategoryInlineAction(prev, formData)`.
  - Same auth (`catalog.write`), Zod schema, image check and database rules as `saveCategoryAction`. The shared save steps move into one internal helper.
  - Returns `{ ok: true, message, category: { id, title, parentId } }` instead of redirecting.
  - Revalidates the storefront and calls `refresh()`, so every dropdown on the page gets the new list. The product form keeps unsaved edits, because its reset is keyed on the saved product version.
- **`CategorySelect`** (new client component): wraps `Select`.
  - Adds the create option, a reserved value that is never submitted as a choice.
  - Opens the dialog, and merges the new category into its options at once, so it can be selected before the refresh arrives.
  - The product editor and the category form's Parent field both use it. The Parent field becomes controlled so choosing "+ Create…" never becomes its value.
- **No JS:** the native select would submit the reserved value. The server rejects it as "Invalid choice" (`z.uuid`) and nothing is created.

## Files expected to change

- `src/features/admin/actions/categories.ts`: shared save helper; `createCategoryInlineAction`
- `src/components/admin/category-form.tsx`: `variant`, `topLevelOnly`, `onCreated`, stop propagation; `CategorySelect` + `CreateCategoryDialog`
- `src/components/admin/product-form/detail-sections.tsx`: Category field uses `CategorySelect`
- `src/features/catalog/category-options.ts`: unchanged; reused
- Tests: `src/components/admin/__tests__/catalog-forms.test.tsx` covers:
  - the create option opens the dialog;
  - a created category is selected;
  - submitting the dialog doesn't submit the outer form;
  - the Parent pop-up has no parent field.

## Security

Unchanged. The inline action re-checks `catalog.write`, validates with Zod, verifies the image bytes, and runs under RLS and the two-level trigger. No migration.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`. I'll do a manual browser pass only if you allow the sign-in token command; otherwise the steps are below.

## Manual test steps

1. `/admin/products/new`. Type a product name and a price.
2. Open Category → **+ Create new category**. The pop-up opens.
3. In the pop-up's Parent field, choose **+ Create new parent category**. Create "Festive Wear" in the second pop-up. It closes and Festive Wear is the selected parent.
4. Name the category "Saris" and create it. The pop-up closes, Category shows "Festive Wear › Saris", and the product name and price are still there.
5. Press Escape in the pop-up: it closes and focus returns to the dropdown.
6. `/admin/categories/new` still opens as a full page.

## Implementation notes (after execution)

- **The parent comes back with the new category.** `createCategoryInlineAction` returns the new category's parent (`{ id, title }`). A category made under a parent that was itself just created then shows as "Parent › Child" straight away, before the page refresh arrives.
- **Page Parent field.** The full-page form's Parent field is now the same `CategorySelect` in `parent` mode, controlled with local state.
- **Tests.** jsdom has no modal dialogs, so the component tests stub `showModal`/`close`. The product-form test now also mocks the category and image actions, because the product form imports `CategorySelect`.
- **No browser pass.** The owner sign-in token command was not permitted in this session.
