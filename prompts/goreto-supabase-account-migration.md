# Move Goreto to a new Supabase account (dev + prod)

The client opened a new Supabase account. Its organisation has no projects yet. Create both projects there, apply every migration, switch all keys (local env files and Vercel) and keep the app working.

## Decisions (client, 2026-10-06)

| Question | Answer |
| --- | --- |
| Projects | **Dev + Prod**: `goreto-dev` and `goreto-prod` (the free plan allows 2) |
| Old data | **Fresh start.** Schema only. Dev is re-seeded and prod starts empty. **Real data on the old `goreto-prod` (orders, products, customers, images) is not copied** and stops showing on the live site. |
| Region | Mumbai `ap-south-1` |
| Vercel | Installed and run through `npx vercel`; Production and Preview env vars are switched and production is redeployed |

## Non-goals

- Copying any data or storage objects from the old projects. The old projects are left untouched (not paused or deleted), so the switch can be rolled back.
- Clerk changes. Both Clerk apps (dev "Goreto" and "Goreto Live") stay, and the Clerk webhook URL stays the same.
- Code changes, apart from `docs/releasing.md` and `worklog.md` (new refs) and the `.env.example` comments if needed.

## What I inspected

`CLAUDE.md` (database and production notes), `docs/releasing.md` (environment table, the prod flow `node --env-file=.env.production.local …`, `vercel env add … --sensitive`, names never sent to Vercel), `.env.example` (variable names), `scripts/db/supabase.ts` (push and types), `scripts/auth/bootstrap-owner.ts` (bootstrap by `--email` through the Clerk Backend API), `package.json` scripts, `.gitignore` (`.env*` ignored) and `worklog.md` §4.8 and §5.

Tools on this machine: the Supabase CLI 2.117 (via npm). There is no `pg_dump`, `psql`, Docker or global Vercel CLI.

## Steps

1. **Logins (you):** `! npx supabase login` with the **new** account, and later `! npx vercel login`.
2. **Projects:**
   - `supabase orgs list` finds the new org.
   - `supabase projects create goreto-dev …` and `goreto-prod …` in `ap-south-1`, each with a generated strong database password. The passwords are written only into the env files and never printed.
   - Wait until both projects are healthy.
3. **Keys:**
   - `supabase projects api-keys` returns the anon/publishable and service-role/secret keys.
   - The Management API returns the session-pooler connection string, which becomes `SUPABASE_DB_URL` with the password percent-encoded.
4. **Env files**: first back them up to `.env.local.old-supabase` and `.env.production.local.old-supabase` (gitignored). A small Node script then replaces only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` and `SUPABASE_DB_PASSWORD` (if present), in place. Values are never printed, and the Clerk keys and other lines stay as they are.
5. **Schema:** `npm run db:push` (dev). For prod, `node --env-file=.env.production.local scripts/db/supabase.ts push --dry-run`, then the real push. Both get all 32 migrations, including `product_reviews`.
6. **Clerk third-party auth** on both projects, through the Management API: dev trusts the dev Clerk instance's domain, read from its publishable key, and prod trusts `natural-tetra-315.clerk.accounts.dev` (Goreto Live). Without this, RLS sees every signed-in user as anonymous.
7. **Data:**
   - `npm run seed:load` on dev (guarded by `GORETO_DATA_ENV=development`); it also uploads the seed images.
   - Prod stays unseeded; the `store_settings_singleton` migration creates its settings row.
8. **Owner:** `owner:bootstrap -- --email himavolt3569@gmail.com` on dev, then on prod with the prod env file (dry run first).
9. **Types:** `npm run db:types` from the new dev project. This also unblocks the reviews work (`prompts/goreto-account-3-reviews-profile.md`).
10. **Vercel**:
    - `npx vercel env add NAME production|preview --force` for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`--no-sensitive`) and `SUPABASE_SERVICE_ROLE_KEY` (`--sensitive`). Values are piped from the env files and never printed.
    - Then redeploy the current production deployment, because `NEXT_PUBLIC_*` values are inlined at build time.
    - Script-only names are never sent to Vercel.
11. **Docs:** add the new refs to the environment table in `docs/releasing.md` and record the move in `worklog.md`.

## Safety

- Code already on the `production` branch works against a database with all current migrations, because they are additive for that code. The reviews migration only tightens review inserts, which production code doesn't make.
- Prod gets a dry run before every write. Keys are only ever moved from one file or command to another and never echoed.
- **Rollback:** restore the `.old-supabase` env files, put the old values back in Vercel and redeploy. The old projects are unchanged.

## Verification

- `db push` reports up to date on both projects.
- `npm run test:db` still passes (it runs on PGlite and is unaffected).
- `npm run db:types` succeeds, followed by typecheck, lint, `npm test` and the build against dev.
- On the dev server, the storefront shows seeded products and the signed-in owner can open `/admin`, which proves third-party auth.
- After the redeploy, https://goreto-kappa.vercel.app loads with an empty catalogue and no errors, and `/admin` works for the owner after sign-in.

## Needs you

- The two logins (step 1).
- Afterwards, re-enter the store settings, couriers, zones, rates and products on the new prod, because it starts empty.
- Optionally pause the old projects once the new ones are confirmed working.

## Changes made during execution

- Both projects were created as `goreto-dev` (`jkjrfgictvpolvohgwcg`) and `goreto-prod` (`etfcgwvdshhcxkrkytne`) in "hamroofficialprojects's Org", region ap-south-1. The Supabase CLI requires `--db-password` in non-interactive mode, so the generated password was passed as a flag and never printed.
- Keys:
  - The new **publishable / secret** keys are used, which `.env.example` allows. `projects api-keys` masks secret keys unless `--reveal` is passed; the first write stored a masked key (seed: "Invalid API key") and was redone with `--reveal`.
  - `SUPABASE_DB_URL` uses the session pooler `aws-0-ap-south-1.pooler.supabase.com:5432`; `aws-1` refused the connection. `.env.local` had an old `SUPABASE_ACCESS_TOKEN` line, which is now blank so the CLI login is used.
  - Backups: `.env.local.old-supabase`, `.env.production.local.old-supabase`.
- **Third-party auth**: `config push` doesn't manage it in CLI 2.117 ("up to date", nothing pushed).
  - With the client's approval, the CLI's own token was read in-process from Windows Credential Manager (`Supabase CLI:supabase`, never printed). The Management API then added `https://precise-bunny-2406.clerk.accounts.dev` (dev) and `https://natural-tetra-315.clerk.accounts.dev` (prod); both show `resolved_jwks`.
  - Proved end to end: a real Clerk session token for the owner reads their own profile through RLS (`role=owner`) and calls `account_summary` on both projects. The session was revoked afterwards.
- **Owner:**
  - dev: `--replace-existing`, so the seed placeholder `user_seed_owner` became a customer;
  - prod: promoted from empty.
- **Vercel**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plain) and `SUPABASE_SERVICE_ROLE_KEY` (sensitive) were replaced for Production and Preview.
  - The plain values pulled back match the env files. Sensitive values can't be pulled back.
  - Production was redeployed from the same deployment (`vercel redeploy`), aliased to https://goreto-kappa.vercel.app, ready in about 1 minute.
- The old production deployment also showed 0 products and 0 categories, so the old prod had no catalogue to lose.

### Verification

- Every migration was applied to both projects (prod had a dry run first).
- The dev seed loaded fully: 195 products, 2,209 orders and 632 images.
- `npm run db:types` was regenerated from the new dev project.
- Live site after the redeploy:
  - `/`, `/categories`, `/search` and `/collections` return 200;
  - `/admin` and `/account/reviews` return Clerk's 307 handshake for page requests, the same as before;
  - the old project ref appears nowhere in the HTML.
