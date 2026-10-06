# Releasing Goreto.store

Live: **https://goreto-kappa.vercel.app** (since 2026-10-04). Owner: himavolt3569@gmail.com.

The live site deploys **only** from the `production` branch. Everything else stays in development.

## Branches

| Branch | What it is | Deploys to |
| --- | --- | --- |
| `feat/*` | One feature, opened as a PR | Vercel **preview** URL (dev database, dev Clerk) |
| `feat/design-system-homepage` | Integration branch; finished PRs merge here | Vercel preview |
| `production` | What the client uses | Vercel **production** (prod database, "Goreto Live" Clerk) |

Merging a PR never changes the live site. Only a push to `production` does.

## Environments

| | Development | Production |
| --- | --- | --- |
| Env file | `.env.local` | `.env.production.local` (untracked) |
| Supabase project | `goreto-dev`, ref `jkjrfgictvpolvohgwcg`, Mumbai (demo seed) | `goreto-prod`, ref `etfcgwvdshhcxkrkytne`, Mumbai, free plan (real data, never seeded) |
| Supabase account | Org "hamroofficialprojects's Org" (since 2026-10-06; the earlier projects `lvvjnedwyrmmcagkixpn` / `znliqwobpljclodooexx` belong to the old account and are no longer used) | same org |
| Clerk application | Goreto (dev instance, `precise-bunny-2406.clerk.accounts.dev`) | Goreto Live, `app_3KEipwYZZ8YqhL0692wQxOglYc7` (development instance until a custom domain exists) |
| Vercel env scope | Preview | Production |

The npm scripts (`db:push`, `seed:*`, `owner:bootstrap`) load `.env.local`, so by default they hit **dev**. To target production, run the script with the prod file:

```bash
node --env-file=.env.production.local scripts/db/supabase.ts push --dry-run   # check first
node --env-file=.env.production.local scripts/db/supabase.ts push
node --env-file=.env.production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/auth/bootstrap-owner.ts
```

`.env.production.local` sets `GORETO_DATA_ENV=production`, so the seed scripts refuse to run against it.

## Release

1. Make sure the integration branch passes: `npm run typecheck && npm run lint && npm test && npm run test:db && npm run build`.
2. **Migrations first.** If the release adds files in `supabase/migrations/`, push them to production (dry run, then push) **before** step 3. New code must never run against an old schema.
3. Release:
   ```bash
   git checkout production
   git pull
   git merge --ff-only origin/feat/design-system-homepage
   git push
   ```
4. Open the live URL and check the changed pages.

## Changing a production setting

Vercel project `goreto` (team "projectshamro-2560's projects"). Production builds read their variables at build time, so redeploy after any change:

```bash
vercel env add NAME production --sensitive --force     # value from stdin; use --no-sensitive for NEXT_PUBLIC_*
vercel redeploy https://goreto-kappa.vercel.app --target production
```

Keep `.env.production.local` in sync. Never send the script-only names (`SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN`, `GORETO_DATA_ENV`) to Vercel. Preview uses the dev values from `.env.local`.

In Git Bash, `vercel api` needs `MSYS_NO_PATHCONV=1`, or the `/v9/...` paths get mangled.

## Rollback

- Vercel → Deployments → previous production deployment → **Instant Rollback**. Then fix forward, or `git revert` on `production`.
- Migrations don't roll back with the deploy. Write a new migration to undo a schema change.

## Unfinished features

`src/config/features.ts` hides storefront entry points for pages that aren't built yet (AR try-on, offers, help/about/legal pages). They show in `next dev` and preview deployments and are hidden in every production build. When a feature ships, delete its flag and its checks in the same PR.

## Free-tier note

`goreto-prod` is on the Supabase free plan: it pauses after 7 days without traffic and has no daily backups. Unpause it in the Supabase dashboard if the site stops loading data. Upgrading to Pro keeps the same project.
