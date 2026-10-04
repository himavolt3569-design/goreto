# Goreto.store — First production release (Vercel + production Supabase + production Clerk)

## Goal

Ship the current, half-complete store to a live Vercel URL that the client can use for real orders. Keep development fully separate from production:

- **Code:** a `production` branch is the only thing the live site deploys. Feature branches and the integration branch never reach it until you merge.
- **Unfinished features:** hidden on the live site, still visible in `next dev` and Vercel preview deployments.
- **Database:** a new, empty Supabase project for production. The current `goreto.store` project stays as the dev database with its demo seed.
- **Auth:** a new Clerk application for production users. Your dev Clerk app and its test users stay separate.

## Decisions (answered 2026-10-04)

| Question | Answer |
| --- | --- |
| Domain | None yet. Launch on `*.vercel.app`. A Clerk **production** instance needs an owned domain, so the live app uses the **development instance of a new Clerk application** ("Goreto Live"). When a domain exists, that same application's production instance takes over (see "Later: custom domain"). |
| Production DB | **New free Supabase project.** The org's 2 free slots are used (`goreto.store`, `pureaid`), so you pause or delete `pureaid` first. |
| Unfinished features | **Hidden** in production by a code-level switch. |
| Bulk product add (PR #20) | **Included.** |

Assumptions:
- The production catalog starts **empty**: no demo products, orders, profiles or reviews. The client adds real products, couriers, zones and rates in the admin panel.
- Region `ap-south-1` (Mumbai) for the production project: closer to Nepal than dev's Singapore.

## Non-goals

- Custom domain, Clerk production instance and DNS (later).
- Building any pending feature (AR try-on page, offers, legal/help pages, reviews UI, guest-order claiming, Playwright).
- Moving dev data or dev users to production.
- Paid plans, backups, monitoring/alerting.

## Inspected

- `worklog.md` §4–§5, `.env.example`, `.gitignore` (`.env*` ignored), `package.json`, `next.config.ts`.
- `src/config/site.ts` (`mainNav`, `footerNav`, `legalNav`), `src/components/store/home/hero.tsx` (`/try-on` CTA + phone mockup link), `src/components/store/product/try-on-card.tsx` and `src/app/(store)/products/[slug]/page.tsx` (AR card), `src/features/catalog/mappers.ts` (`productBadge`: AR READY is **not** a card badge).
- `src/features/admin/nav.ts`, `src/features/account/nav.ts`: every linked admin/account page exists, nothing to hide there.
- `supabase/migrations/*`: Nepal geography (all 753 local levels) and storage buckets come from migrations. **`store_settings` has no row except from the seed**, and `place_order`, checkout store info and admin settings read that row.
- `scripts/db/supabase.ts` targets `SUPABASE_DB_URL`/`NEXT_PUBLIC_SUPABASE_URL` from the loaded env file. Seed scripts refuse unless `GORETO_DATA_ENV=development`.
- Tooling on this machine: Vercel CLI 59 (logged in as `projectshamro-2560`), Clerk CLI (linked to the dev app), Supabase CLI (logged in; projects `goreto.store` and `pureaid`), `gh` (logged in).
- Branches: `origin/feat/design-system-homepage` is the integration/default branch and includes PR #18. `feat/bulk-product-add` (PR #20) is based on PR #17 and has 6 uncommitted files.

Docs to read during execution: `node_modules/next/dist/docs/` on environment variables (`NEXT_PUBLIC_` inlining) and deploying; skills `clerk-setup`, `clerk-webhooks`, `clerk-cli`, `supabase`.

## Plan

### Step 1 — Finish bulk add (PR #20)

1. Review the 6 uncommitted files on `feat/bulk-product-add`. Leave `CLAUDE.md` alone; it belongs to PR #19.
2. Merge `origin/feat/design-system-homepage` into the branch to pick up PR #18. Resolve conflicts, especially `src/components/store/product-card-actions.tsx` and the migration order: `20261004090000_product_media_videos` comes after the PR #18 migrations.
3. Run typecheck, lint, `npm test`, `npm run test:db` and a build. Commit, push, merge PR #20.
4. `npm run db:push` to the **dev** DB. The worklog said it was blocked until PR #18 was merged.

### Step 2 — Production switch and DB bootstrap (`feat/production-release`, from the updated integration branch)

**Feature switch, new `src/config/features.ts`:**

```ts
/** Unfinished features show in `next dev` and Vercel previews only; every production build hides them. */
const showUnfinished =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";

export const features = {
  arTryOn: showUnfinished,   // /try-on doesn't exist yet
  offers: showUnfinished,    // /offers doesn't exist yet
  infoPages: showUnfinished, // /help, /about, /privacy, /terms, /cookies don't exist yet
} as const;
```

- **Fail-safe:** with no env var set, a production build hides unfinished features. That covers a forgotten Vercel variable and local `next build`. Vercel exposes `NEXT_PUBLIC_VERCEL_ENV` automatically.
- When a feature ships, delete its flag. Don't flip it to `true`.

**Where the flags apply:**
- `src/config/site.ts`: filter `mainNav` (AR Try-On, Offers), `footerNav` (AR Try-On, Help, About) and `legalNav` (all three) with a `feature` key on each link and a small `visibleLinks()` helper. Every consumer of these arrays goes through the helper. The footer's legal row hides cleanly when it's empty.
- `hero.tsx`: hide the "Try in AR" button when `!features.arTryOn`. The phone mockup stays as decoration but stops being a link.
- `products/[slug]/page.tsx`: skip the `TryOnCard` section when `!features.arTryOn`.
- The admin AR pages stay, so the client can prepare assets before launch.

**Migration `supabase/migrations/<ts>_store_settings_singleton.sql`:**
- `insert into public.store_settings (store_name, tagline) values ('Goreto.store', 'Style it. See it. Love it.') on conflict (singleton) do nothing;`
- Dev already has the row, so this is a no-op there.
- No new table, function or grant.
- Verify with `npm run test:db`. The harness loads the seed, so add a DB test that applies the migrations **without** the seed and asserts that exactly one settings row exists.

**Other changes in this step:**
- Tests: unit tests for `visibleLinks()`/`features` (production hides, development shows, preview shows), plus a hero/product-page render check if the existing tests make that cheap.
- `.env.example`: comment that production values live in an untracked `.env.production.local` and that Vercel holds the deployed copy.
- `docs/releasing.md` (short): branch model, how to release, rollback, migration-first rule, feature-flag rule, and which env file targets which DB.
- `worklog.md`: record the release and update §4.8/§5.
- Then the usual checks, a PR, and a merge.

### Step 3 — Release branch

- `git checkout -b production origin/feat/design-system-homepage` and push.
- From now on, only a merge into `production` updates the live site.

### Step 4 — Production Supabase (needs you first)

**You:**
1. Pause or delete `pureaid`.
2. Create project `goreto-prod` in org `xeconiambdpvventenza`, region Mumbai. Store the DB password in a password manager.

**Me:**
- Create an untracked `.env.production.local` template with names only. You paste in the prod `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL`, plus `GORETO_DATA_ENV=production`, so seed scripts refuse to run against prod.
- `node --env-file=.env.production.local scripts/db/supabase.ts push` applies all migrations to prod.
- Check through the CLI or Management API with names/counts only: tables exist, 753 municipalities, 1 `store_settings` row, 0 products/orders/profiles, storage buckets present.
- I never print the key values.

### Step 5 — Production Clerk (needs you)

**You, in the Clerk Dashboard:**
1. Create application **"Goreto Live"** with the same sign-in methods as the dev app.
2. Integrations → **Supabase** → enable, so session tokens carry `role: authenticated`.
3. Copy its Clerk domain.
4. Supabase `goreto-prod` → Authentication → Third-party auth → **Clerk**, with that domain.
5. Paste `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into `.env.production.local`.

If `clerk` CLI or the Platform API can do any of these steps without a browser, I do them and tell you which.

**Webhook:** after the first deploy, add endpoint `https://<vercel-url>/api/webhooks/clerk` for `user.created`, `user.updated` and `user.deleted`, and paste the signing secret as `CLERK_WEBHOOK_SIGNING_SECRET`.

### Step 6 — Vercel project

1. Create the project with `vercel link`/`vercel project add` under account `projectshamro-2560` and connect GitHub `himavolt3569-design/goreto`.
   - **Confirm that this is the right Vercel account/team before creating it.**
2. Settings:
   - Production Branch = `production`.
   - Previews stay on behind Vercel Authentication.
   - Framework Next.js, `npm`.
   - If the CLI can't set these, I give exact dashboard clicks.
3. Production env vars: a small script reads `.env.production.local` and runs `vercel env add <NAME> production` for each app variable without echoing values.
   - Variables: Clerk ×3, Supabase URL/anon/service role, `NEXT_PUBLIC_SITE_URL=https://<vercel-url>`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`.
   - **Not sent:** `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN`, `GORETO_DATA_ENV`.
4. Preview env vars point at the **dev** Supabase and dev Clerk app, so previews never write to production data. They come from `.env.local` through the same no-echo script.
5. Push `production` → first deploy.

### Step 7 — Go-live checks

1. Open the live URL:
   - Homepage renders with an empty-catalog state.
   - No AR Try-On/Offers/Help/About/legal links.
   - No 404 links in the header or footer.
   - No `/design-system`.
2. The client (or you) signs up on the live site. `owner:bootstrap` runs with `--env-file=.env.production.local`, and `/admin` opens for that user.
3. Webhook test: a new sign-up creates a `profiles` row on prod and none on dev.
4. Smoke order:
   - Admin adds 1 product, 1 courier + service, 1 zone + rate, and support email/phone + dispatch municipality in Settings.
   - Place a COD order as a guest → confirmation → tracking → it appears in admin as pending → accept → cancel it.
   - Then archive/delete the test product, or keep it if the client wants.
5. A preview deployment of a feature branch shows the hidden links again and reads dev data.

## Auth / RLS / security

- No policy or grant changes. The only migration is a data insert.
- Secrets live only in `.env.local` (dev), `.env.production.local` (prod, untracked) and Vercel env. Nothing `NEXT_PUBLIC_` is secret.
- Production seed loading is impossible: `GORETO_DATA_ENV=production`, and the prod env file isn't the default `.env.local` the npm scripts load.
- The dev and prod Clerk apps have separate user pools. A dev Clerk token can't authenticate against prod Supabase, because third-party auth trusts only the Live app's domain.

## Acceptance criteria

- `production` branch exists. Vercel Production tracks it. Pushes elsewhere create previews only.
- The live site uses prod Supabase + "Goreto Live" Clerk. Previews use dev Supabase + dev Clerk.
- Production hides AR try-on entry points, Offers, Help/About and legal links. `next dev` and previews still show them.
- The prod DB has all migrations, one settings row and no demo data. The client's account is the owner.
- PR #20 is merged and its migration applied on dev and prod.
- typecheck, lint, `npm test`, `npm run test:db` and a production build pass.

## Commands

```bash
npm run typecheck && npm run lint && npm test && npm run test:db
npm run build      # if EPERM returns, use the temporary distDir workaround (memory note)
node --env-file=.env.production.local scripts/db/supabase.ts push
node --env-file=.env.production.local --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/auth/bootstrap-owner.ts
vercel link / vercel env add / vercel --prod (only if Git integration doesn't trigger)
```

## Rollback

- **Bad deploy:** Vercel → Deployments → previous production deployment → Instant Rollback. Or `git revert` on `production`.
- **Migration:** the settings insert is idempotent and safe to leave. Future prod migrations go through `db:push` with the prod env file **before** merging into `production`.
- **Free tier:** the prod project pauses after 7 days without traffic. Unpause in the dashboard. Moving to Pro later keeps the same project.

## Later: custom domain

Add the domain in Vercel, then enable the **production instance** of "Goreto Live" in Clerk with its DNS records. Swap the Clerk keys in Vercel and the Supabase third-party auth domain. Users from the dev instance don't carry over: the owner re-signs up and is re-bootstrapped. Tell the client before then.

## Outcome (2026-10-04)

Executed and live at https://goreto-kappa.vercel.app. Differences from the plan:

- PR #20 was merged before its last fixes reached the branch, so those fixes shipped as PR #21. The feature switch and settings migration shipped as PR #22.
- The CLI did the Clerk steps. `clerk apps create "Goreto Live"` created the app, and `clerk config patch` copied the dev app's sign-in settings and the `role: authenticated` session claim, which replaces the dashboard's Supabase integration toggle. `clerk env pull --file .env.production.local` wrote the keys.
- The Vercel API (PATCH `/v9/projects/goreto/branch`) set the production branch. Vercel Authentication defaulted to "all except custom domains", which would have locked the client out of `*.vercel.app`, so it was changed to previews only.
- The CLI created `goreto-prod` with a generated password that exists only in `.env.production.local`. The first `db push` hit a deadlock against the new project's background work, and a rerun applied everything.
- The owner opened the live site, signed up and was bootstrapped. The webhook secret is in Vercel.

Still open: the client's store setup (couriers, zones, rates, products), the AR wording on the homepage, a custom domain with a Clerk production instance, and Supabase Pro.
