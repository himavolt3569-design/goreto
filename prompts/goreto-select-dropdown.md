# Design-system Select (dropdown) + hierarchical category options

## Goal

1. Replace the native-`<select>` dropdown with a design-system **Select** whose open list is styled with Goreto tokens (today the closed field matches the reference, but the open list is the OS picker — grey, system font, no hover/selected states — which is what "feels off").
2. Show **categories as a tree** in every category dropdown: each parent followed by its own children, indented. Today options are ordered by `sort_order` across the whole table, so children of different parents interleave with top-level rows as `Jewelry › Earrings`, `Bags › Handbags`, `Dresses`, …
3. Give every dropdown surface (Select list, admin `Menu`, date-range panel) one shared panel/item style so they read as one family.
4. Document it in `/design-system` §08 Inputs.

## Non-goals

- No new UI/headless library (no Radix/Headless UI) — the repo already hand-rolls an accessible `Menu`; Select follows the same approach.
- No searchable combobox (category list is ~40 rows; type-ahead covers it). Can be added later.
- No change to storefront nav (it links to `/categories`, it is not a dropdown), variant option chips, or data/queries beyond ordering categories.
- No DB/migration/RLS changes.

## Inspected

- `src/components/ui/select.tsx` (native select + caret), `input.tsx` (`fieldControlClasses`), `field.tsx` (id/aria wiring via render prop).
- `src/components/admin/menu.tsx` (WAI-ARIA menu button; panel `rounded-md border shadow-lg p-2`, items `min-h-11 rounded-sm hover:bg-neutral-100`).
- `src/components/admin/range-controls.tsx` (`DateRangePicker` panel, `WindowSelect` auto-submit + no-JS Apply).
- Select call sites: admin products (status, category), orders (payment), customers (sort), dashboard `WindowSelect`, `order-actions` (courier — `required`, status), `product-form/detail-sections` (category via RHF `register`), `product-form/media-manager` (variant), storefront `category-sort` (router.replace + no-JS Apply), `/design-system` page.
- `src/features/admin/queries/catalog.ts` `fetchCategoryOptions` (flat list ordered by sort_order, title); seed catalog: 12 parents, ~30 children, 2 levels.
- Tests: `ui/__tests__/field.test.tsx` (Select with Field), `admin/__tests__/admin-components.test.tsx` (Menu).
- Reference: `designs/Goreto-designsystem.png` §08 (Select field: 44px, 12px radius, `#E2E8F0`, caret right, Inter Medium value).
- Next docs: not needed beyond existing client/server boundary conventions (no routing/caching changes).

## Decisions

1. **API**: `Select` takes `options: SelectOption[]` instead of `<option>` children.
   `SelectOption = { value: string; label: string; disabled?: boolean; depth?: 0 | 1; context?: string }`
   - `depth: 1` renders indented under the previous depth-0 row; depth-0 rows that have children render in medium weight.
   - `context` (e.g. parent title) is shown muted in the closed field for child rows: `Jewelry › Earrings`.
   - Props: `name`, `id`, `value`/`defaultValue`, `onValueChange(value)`, `placeholder` (shown muted when value is `""` and no option has `""`), `required`, `disabled`, `aria-*` from `Field`, `className`, `onBlur` (for RHF).
2. **Accessibility**: WAI-ARIA APG *select-only combobox*: trigger `button role="combobox"` with `aria-expanded`, `aria-controls`, `aria-activedescendant`; list `role="listbox"`, options `role="option"` + `aria-selected`. Keys: Enter/Space/ArrowDown/ArrowUp open; arrows/Home/End/PageUp/PageDown move; type-ahead; Enter/Space select; Escape closes; Tab selects-and-moves-on (APG behaviour); click outside closes. Focus stays on the trigger. `<label htmlFor>` from `Field`/`FilterField` still labels the trigger.
3. **Forms + progressive enhancement**: a visually hidden, `aria-hidden`, `tabIndex=-1` native `<select name>` mirrors the value, so GET filter forms, Server Action `FormData`, `required` validation and form reset keep working. Before hydration (and without JS) the **native select is rendered visibly** with identical closed styling (via the existing `useSyncExternalStore` "scripted" pattern), so no-JS filter/sort forms still work and there is no visual jump.
4. **Look** (tokens only): trigger = `fieldControlClasses`, caret rotates 180° when open, `primary-500` border while open. Panel = shared `popoverPanelClasses`: white, `border-neutral-200`, `rounded-md` (12px), `shadow-lg`, `p-2`, `max-h-72` scroll, width = trigger width (min 224px). Option rows = shared `popoverItemClasses`: `min-h-11`, `rounded-sm` (8px), `px-3`, Inter 14/20; active (keyboard/hover) `bg-neutral-100`; selected `bg-primary-100 text-primary-700 font-medium` + trailing check icon (state not colour-only); disabled `text-neutral-300`. Depth-1 rows `pl-8`. Opens below; flips above when there isn't room. 120ms fade/translate, off under `prefers-reduced-motion`.
5. **Shared dropdown styles**: add `src/components/ui/popover.ts` exporting `popoverPanelClasses` and `popoverItemClasses`; `Menu` and `DateRangePicker` adopt them (visual result same as today except consistent radius/spacing).
6. **Category tree**: add pure `categoryOptions(rows)` in `src/features/catalog/category-options.ts` → orders parents by `sort_order, title`, each followed by its children (same order), children `depth: 1` with `context: parent.title`; orphaned children (parent missing) are appended as depth-0. Used by admin Products filter and the product form. Unit-tested.
7. **Call sites** move to `options=`; RHF category field uses `Controller`; `WindowSelect`/`CategorySortControl` use `onValueChange`.

## Files expected to change

```
src/components/ui/select.tsx                         rewrite (client) — Select + SelectOption
src/components/ui/popover.ts                         new — shared panel/item classes
src/components/ui/__tests__/select.test.tsx          new — keyboard, selection, form value, placeholder, required mirror
src/components/ui/__tests__/field.test.tsx           update Select case to options API
src/features/catalog/category-options.ts (+ .test.ts) new — tree ordering
src/components/admin/menu.tsx                        use popover classes
src/components/admin/range-controls.tsx              popover classes; WindowSelect options API
src/components/admin/order-actions.tsx               options API (courier required, status)
src/components/admin/product-form/detail-sections.tsx Controller + categoryOptions
src/components/admin/product-form/media-manager.tsx  options API
src/components/store/category/category-sort.tsx      options API
src/app/(admin)/admin/products/page.tsx              categoryOptions + options API
src/app/(admin)/admin/orders/page.tsx                options API
src/app/(admin)/admin/customers/page.tsx             options API
src/app/design-system/page.tsx                       §08: Select + grouped category example + open-state spec list
```

(`products/page.tsx`, `detail-sections.tsx`, `media-manager.tsx` already have uncommitted work on this branch; edits are additive to it.)

## DB / auth / security

None. No schema, RLS, secrets or server-trust changes. Server actions still validate submitted ids.

## Acceptance criteria

- Every dropdown in the app opens a token-styled list (no OS picker) with hover, keyboard-active, selected (check + tint) and disabled states.
- Category dropdowns list `Dresses → Maxi/Midi/Party (indented) → Jewelry → Earrings…`; the closed field shows `Jewelry › Earrings` for a child.
- Full keyboard operation per decision 2; screen reader announces label, value, expanded state and options.
- Admin filter forms, courier/status dialogs, product form, media variant form, dashboard window and category sort submit the same values as before; `required` courier still blocks empty submit.
- With JS disabled, filter/sort forms still work (native select).
- List flips upward near the viewport bottom and scrolls when long.
- `/design-system` §08 shows the Select closed, a category example, and spec bullets.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; manual browser pass (below).

## Manual test

1. `/design-system` §08: open Select with mouse and keyboard (Tab, Space, arrows, type "p", Enter, Escape); compare to reference field.
2. `/admin/products`: open Category — parents with indented children; pick "Earrings", Apply → URL `?category=<id>`, field shows `Jewelry › Earrings`.
3. `/admin/products/new`: Category required error shows on submit when empty; choose one, save succeeds.
4. `/admin/orders/<id>`: Assign courier dialog — empty courier blocked; pick one, save.
5. `/admin` dashboard: change revenue window → page updates.
6. `/categories/<slug>`: change Sort → URL updates without reload; Back restores value.
7. Scroll so a Select sits near the bottom of the viewport → list opens upward.
8. Disable JS on `/admin/orders` → native select still filters with Apply.

## Rollback

Pure front-end; revert the commit.
