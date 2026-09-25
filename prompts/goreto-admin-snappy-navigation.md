# Admin: fix CategorySelect crash, remove loading skeleton, snappy navigation

## Goal
1. Stop the "Element type is invalid … Check the render method of `Controller`" crash on `/admin/products/new`.
2. Remove the admin loading skeleton (`src/app/(admin)/admin/loading.tsx`). The documents never asked for skeleton/buffering UI.
3. Make admin navigation (Products, Categories, etc.) open instantly in production, without a loading state.

## Non-goals
- No new loading/buffering UI of any kind (no skeletons, spinners, progress bars).
- No per-user cross-request caching of profiles or permissions (AGENTS §18.2).
- No changes to data access, RLS or schema.

## Findings (inspected)
- `detail-sections.tsx` imports `CategorySelect` from `../category-form`. The export exists, `tsc`, the 33 admin component tests and a fresh `next build` all pass, and an import-graph scan found no circular import. The dev log shows the error right after `detail-sections.tsx` (19:20:08) was saved a minute before `category-form.tsx` (19:21:09) gained the export. The running `next dev` kept the stale module, so the fix is a dev-server restart / hard reload. No code change needed.
- `src/app/(admin)/admin/loading.tsx` is the only `loading.tsx`, with `animate-pulse` skeleton blocks. The `animate-pulse` dots in media-manager/staged-media are upload-progress indicators for a real upload, not page skeletons. They stay.
- Hosted Supabase round trip from this machine: about 170–250 ms per query (measured).
- 7–8 s page opens come from `next dev`: every route is compiled on first visit, and prefetching is disabled in development (Next docs: `link.md` → `prefetch`, "Prefetching is only enabled in production").
- Admin pages are dynamic (`ƒ`). Per Next 16 docs (`linking-and-navigating.md`, `prefetching.md`), dynamic routes without `loading.js` are **not prefetched**, so each click waits for the server. `<Link prefetch={true}>` prefetches the full dynamic route, data included, so the click is instant.
- `/admin/products` waits for the category query before starting the products query, one extra round trip.
- `/admin/products/[id]` waits for the product before `fetchProductHasOrders`, one extra round trip.

## Docs read
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`, `02-guides/prefetching.md`, `03-api-reference/02-components/link.md` (prefetch), `03-api-reference/05-config/01-next-config-js/staleTimes.md`.

## Changes
1. Delete `src/app/(admin)/admin/loading.tsx`.
2. `src/components/admin/sidebar-nav.tsx` (the desktop and mobile nav share it): intent-based full prefetch. `prefetch={intent ? true : false}`, with intent set on `onMouseEnter`, `onFocus` and `onTouchStart`. This is the pattern from the Next prefetching guide, using `true` so the dynamic page and its data are fetched. Pointer-down to click is typically 100–300 ms, and the page data arrives in about the same time, so the click swaps instantly. Only links the user shows intent for are rendered, so the database isn't hit about 20 times per admin page view.
3. `next.config.ts`: `experimental.staleTimes.static = 30`. A fully prefetched admin page is reused for at most 30 s instead of the 5 min default, so counts and orders are never minutes old. Server-action mutations already refresh the client cache via `revalidatePath`.
4. `src/app/(admin)/admin/products/page.tsx`: fetch categories and products in parallel. The category filter is applied only when the id is a known category, and the products query accepts only a UUID-shaped id.
5. `src/app/(admin)/admin/products/[id]/page.tsx`: start `fetchProductHasOrders(id)` in parallel with `fetchProductDetail(id)`.

## Auth/RLS
Unchanged. Prefetch requests go through the same proxy, `requireAdminAccess` and RLS. A prefetch is only issued for hrefs the server already allowed in the nav.

## Acceptance criteria
- No `loading.tsx` or skeleton blocks in the admin.
- `/admin/products/new` renders the category dropdown without the runtime error after a dev-server restart.
- In a production build (`npm run build && npm start`), hovering a sidebar link then clicking opens the page immediately with real data, and the old page never shows a placeholder.
- typecheck, lint, tests and build pass.

## Checks
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Manual test
1. Restart `npm run dev`, open `/admin/products/new`, then open the Category dropdown.
2. `npm run build && npm start`, sign in as owner, open `/admin`.
3. Hover **Products**, click: the page appears instantly. Repeat for Categories, Orders and Inventory.
4. Confirm no skeleton appears on any navigation.

## Rollback
Revert the commit. There's no data impact.
