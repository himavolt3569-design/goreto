# PR #8 review fixes

## Goal
Fix the three still-valid review findings on PR #8. Keep the changes minimal.

## Findings, verified against current code
1. **`/admin/products` category filter.** Valid. An unknown UUID in `?category=` filters the products query, but the dropdown shows "All categories" and the reset link is hidden. The result is an empty list with no visible filter.
2. **Self-parent category.** Partly valid. The table already has `check (parent_id is null or parent_id <> id)`, so data can't be corrupted. The user sees the raw 23514 constraint text, though, instead of a field error on `parentId`.
3. **`admin_delete_category`.** Valid.
   - The subcategory check runs as the caller. A staff member with `catalog.write` but not `catalog.read` can't see inactive subcategories through RLS (`categories: public read active`).
   - The delete then hits `categories_parent_id_fkey` (ON DELETE RESTRICT), and the handler wrongly reports "still has products".

## Decision: new migration, not an edit
`20260925170000_admin_categories_collections.sql` is already applied to the dev database. Editing it would never reach dev, and would make dev and a future production database diverge. The fixes go in a new migration: `supabase/migrations/20260925180000_admin_category_guards.sql`.

## Changes
- **`src/app/(admin)/admin/products/page.tsx`:** keep the parallel fast path. When the requested id isn't a known category, refetch products without the category filter, so the list matches "All categories". This only happens on a hand-edited URL.
- **New migration:**
  - `categories_enforce_two_levels`: first rejects `new.parent_id = new.id` with 22023 and `detail = 'parentId'`.
  - `public.category_has_children(uuid)`: new. It is `security definer`, `stable`, with `set search_path = ''`. It raises 42501 without `catalog.write`, so it reveals nothing to other callers. Execute goes to `authenticated` only.
  - `admin_delete_category`: uses the helper. The exception handler reads `CONSTRAINT_NAME` through `GET STACKED DIAGNOSTICS`. It shows the products message only for `products_category_id_fkey` and re-raises everything else.
- **`tests/db/admin-categories-collections.test.ts`:** adds tests for:
  - the self-parent error message;
  - delete refused because of a hidden inactive subcategory, for a staff member with `catalog.write` only;
  - the helper refused to customers.

## Auth/RLS
The helper is definer-scoped to a single boolean and gated on `catalog.write`. The delete stays security invoker, so the RLS delete policy is still what enforces it.

## Checks
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`. After approval, apply the migration to dev with `npm run db:push`.

## Rollback
The migration only replaces functions and adds one. To roll back, re-create the previous function bodies from `20260925170000` and drop `category_has_children`.
