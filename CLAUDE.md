# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

AGENTS.md is the product and process contract: the READ → PLAN → ASK → EXECUTE → VERIFY → REPORT workflow, the design tokens, and the business rules. The notes below describe how the repository actually works today. Where AGENTS.md shows a target that does not exist yet (pnpm, `test:e2e`, `supabase start`), follow these notes.

`worklog.md` records what each phase built and what work remains. The WhatsApp order intake in §4.0 is the client's top priority. `prompts/` holds the approved plan for every past feature, so read the matching prompt before you change a feature.

## Commands

The package manager is **npm** (`package-lock.json`), not pnpm.

```bash
npm run dev
npm run typecheck                 # tsc --noEmit
npm run lint                      # eslint (flat config)
npm test                          # Vitest + RTL, jsdom: src/**/*.test.ts(x), scripts/**/*.test.ts
npm run test:db                   # PGlite: real migrations + full seed + per-role RLS (tests/db)
npm run build

npx vitest run src/features/cart/store.test.ts            # one unit test file
npx vitest run -t "name of test"                          # by test name
npx vitest run --config vitest.db.config.mts tests/db/rls.test.ts   # one DB test file
```

Playwright is not installed yet, so no E2E suite exists.

### Database (no Docker on this machine)

`supabase start` and `supabase db reset` do not run here because WSL and Docker are unavailable. Use this flow instead:

- A new migration goes in `supabase/migrations/<timestamp>_<name>.sql`. Verify it first with `npm run test:db`, which applies every migration to PGlite.
- `npm run db:push` applies migrations to the hosted **dev** project (`SUPABASE_DB_URL` in `.env.local`).
- `npm run db:types` regenerates `src/types/database.ts` from the hosted project and needs `SUPABASE_ACCESS_TOKEN`. Never hand-edit that file.
- `npm run seed:generate` rebuilds the deterministic `supabase/seed.ndjson`. `seed:load` and `seed:purge` apply or remove it, and they are guarded by `GORETO_DATA_ENV=development`.
- `npm run owner:bootstrap` promotes a Clerk user to owner.

Supabase Cloud grants `anon`/`authenticated` access to every new table and function by default. Each migration must revoke and grant explicitly, following `20260925050144_harden_grants.sql`. The PGlite harness (`tests/db/harness.ts`) reproduces these permissive defaults, so a missing revoke fails the tests.

### Production (live since 2026-10-04)

The live site is https://goreto-kappa.vercel.app. Vercel deploys production **only** from the `production` branch, and every other branch gets a preview build. `docs/releasing.md` describes the full process.

- Production uses its own Supabase project, `goreto-prod` (no seed), and its own Clerk app, "Goreto Live". Their values live in the untracked `.env.production.local` in the main checkout. The npm scripts load `.env.local`, so they always target **dev**. To reach prod, run a script with `node --env-file=.env.production.local ...`, and do a `--dry-run` before any push.
- To release: apply migrations to prod first, then merge `feat/design-system-homepage` into `production`. Never seed prod.
- `src/config/features.ts` hides links to unbuilt pages in production builds. When a feature ships, delete its flag rather than flipping it.

## Architecture

**Three Supabase clients, chosen by trust level** (`src/lib/supabase/`):

- `public.ts` is anonymous and never calls `auth()`. It serves storefront catalog reads, so those pages stay cacheable (ISR plus the `CATALOG_CACHE_TAG` tag).
- `server.ts` (`getUserSupabase`) passes the Clerk session token through `accessToken`, so RLS sees the user. Calling it makes the route dynamic. Use it for account and admin work.
- `admin.ts` holds the service role. Its only allowed importer is `src/lib/auth/profile-sync.ts`, and `boundaries.test.ts` enforces that. Do not add importers.

**Identity → authorization chain.** Clerk `sub` maps to `profiles.clerk_user_id`, which SQL helpers (`current_profile_id()`, `is_owner()`, `has_permission()`) resolve inside RLS. `src/lib/auth/profile.ts` provides `getCurrentProfile`, `requireProfile`, `authorize`, `requirePermission` and `requireOwner`, and lazily upserts the profile when the Clerk webhook (`src/app/api/webhooks/clerk`) has not run yet.

**Admin** (`src/features/admin/`):

- `nav.ts` defines the grouped sidebar and the `AdminAccess` vocabulary: `"admin"`, `"owner"`, or a permission key.
- Pages call `requireAdminAccess()` from `auth.ts`, which returns 404 when access is denied.
- Server Actions in `actions/` use `authorizeAndParse()` from `actions/helpers.ts`, which authorizes, parses FormData with Zod, and returns an `ActionResult`. After a mutation they revalidate only the affected paths and tags.
- Reads live in `queries/`.
- State-changing business logic (the order state machine, stock, product save, staff) runs in `security definer` Postgres functions from the `admin_*` migrations. Actions call these RPCs and do not write multi-table changes from TypeScript.

**Storefront** (`src/features/catalog/`): `queries.ts` loads rows and `mappers.ts` turns them into view models. Tests use fakes and fixtures from `src/test/` instead of a live database, and `boundaries.test.ts` also blocks fixtures from app code.

**Tokens and UI:**

- Tailwind v4 `@theme` in `src/app/globals.css` resets the default palette, radii and shadows, so off-system classes generate no CSS.
- Primitives live in `src/components/ui/`. The dev-only `/design-system` page shows them.
- Icons come from the curated deep imports in `src/components/ui/icons.ts`. Add new icons there. Importing from the Phosphor barrel slows tests roughly 40×.
- Money is integer paisa. Format it with `formatNpr` from `src/lib/money`.

`scripts/` are TypeScript files that Node runs directly with type stripping. Each script folder has its own `package.json` with `"type": "module"`.
