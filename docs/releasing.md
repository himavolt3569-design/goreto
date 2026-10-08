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

## Daraz Express (courier API)

Reference: [docs/couriers/daraz.md](couriers/daraz.md). First release of the integration:

1. **Migrations** (prod, dry run first): `20261007090000_daraz_courier`, `20261007100000_daraz_courier_ops`, `20261007110000_daraz_tracking_autobook`, `20261007120000_parcel_default_weight` (Send & track's usual parcel weight).
2. **Variables**, on **Production only**: `DARAZ_APP_KEY`, `DARAZ_APP_SECRET` (both `--sensitive`) and `CRON_SECRET` (any random value of 16+ characters). Leave `DARAZ_API_URL` unset to use `https://api.daraz.com.np/rest`.
   - Never give Preview or `.env.local` the live Daraz keys: a preview or local booking would book a real parcel. For dev, use the mock gateway (`npm run daraz:mock` and `DARAZ_API_URL=http://localhost:4010`).
3. **Redeploy**, then in the live admin: **Daraz Express › Setup** → Test connection → save the Daraz values → Link account (OTP from DEX OMS) → save the warehouses. Mark the courier "Booked through the Daraz Express API" (Delivery & Courier) and map its services.
4. **Webhook**: in the Daraz App Console → Message Service, enter `https://goreto-kappa.vercel.app/api/courier/webhooks/daraz` and **Verify**. Daraz requires an OV/EV certificate; if it refuses ours, skip this step. Tracking still syncs without pushes.
5. **Tracking schedule**: `vercel.json` runs `/api/cron/courier-sync` once a day (the Hobby limit), and opening an order refreshes it. For a check every 15 minutes, run this once in the prod SQL editor (Supabase free plan includes `pg_cron` and `pg_net`), with the same `CRON_SECRET`:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select vault.create_secret('<CRON_SECRET>', 'courier_cron_secret');
   select cron.schedule('courier-sync', '*/15 * * * *', $$
     select net.http_get(
       url := 'https://goreto-kappa.vercel.app/api/cron/courier-sync',
       headers := jsonb_build_object('Authorization', 'Bearer ' ||
         (select decrypted_secret from vault.decrypted_secrets where name = 'courier_cron_secret'))
     )
   $$);
   ```

   Remove it with `select cron.unschedule('courier-sync');`. After changing `CRON_SECRET`, update the vault secret too.
6. **Daraz location IDs** (when Daraz sends the Nepal list): `node --env-file=.env.production.local scripts/daraz/import-locations.ts --file <csv> --dry-run`, then without `--dry-run`.

## Rollback

- Vercel → Deployments → previous production deployment → **Instant Rollback**. Then fix forward, or `git revert` on `production`.
- Migrations don't roll back with the deploy. Write a new migration to undo a schema change.

## Unfinished features

`src/config/features.ts` hides storefront entry points for pages that aren't built yet (AR try-on, offers, help/about/legal pages). They show in `next dev` and preview deployments and are hidden in every production build. When a feature ships, delete its flag and its checks in the same PR.

## Free-tier note

`goreto-prod` is on the Supabase free plan: it pauses after 7 days without traffic and has no daily backups. Unpause it in the Supabase dashboard if the site stops loading data. Upgrading to Pro keeps the same project.
