# Connect Clerk users to Supabase

## Goal

Make a signed-in Clerk user a real, RLS-visible identity in Supabase:

1. Supabase trusts the Clerk session token (third-party auth), and the token carries `role: authenticated`.
2. The app has a **user-context Supabase client** that sends the Clerk token, so `current_profile_id()`, `is_owner()` and `has_permission()` resolve to the caller.
3. Every Clerk user gets a `profiles` row, kept in sync by a **verified, idempotent Clerk webhook**, with a **lazy upsert on first authenticated request** so a delayed webhook never blocks anyone.
4. Server helpers `getCurrentProfile()`, `requireProfile()`, `requirePermission()` / `authorize()` for pages, Server Actions and route handlers.
5. A trusted **owner bootstrap** script that promotes a specific Clerk user to `owner`.
6. A minimal `/account` page (currently a dead header link) that exercises the whole chain.

## Non-goals

- No account area features (orders, wishlist, addresses, billing, `<UserProfile />`). `/account` is a stub: greeting, email, role, "more coming soon".
- No admin UI, staff invitations, or staff-permission management UI.
- No browser-side Supabase client (nothing client-side reads user data yet).
- No mirroring of `role` into Clerk `publicMetadata` (optional per AGENTS §9.2; not needed until admin UI).
- No guest-order claiming (needs checkout). The profile stores only a **verified** primary email so that later flow can rely on it.
- No production Clerk instance or production webhook endpoint (production isn't configured in Clerk yet).

## What I inspected

- `AGENTS.md` §5.1, §7, §9, §10.8, §11.1, §16, §18.2, §18.6, §23.3, §26.5–26.6.
- Skills: `clerk-nextjs-patterns` (server vs client, caching), `clerk-webhooks` (`verifyWebhook`, retries, public route), `clerk-cli` (`doctor`, `config`, `webhooks listen`), `supabase` (security checklist: `security definer`, grants), `supabase-postgres-best-practices`.
- Next.js 16.3.6 local docs: `01-getting-started/15-route-handlers.md`, `16-proxy.md`, `04-functions/forbidden.md` (`forbidden()` is still **experimental** → not used).
- Migrations: `foundation.sql` (profiles, `staff_permissions`, helpers, column grant `update (full_name, phone_e164)`), `harden_grants.sql` (no implicit grants; `guard_profile_identity` trigger blocks anon/authenticated from changing role/clerk_user_id/email/deleted_at, service_role unaffected).
- `src/lib/supabase/public.ts` (anon only), `src/lib/supabase/boundaries.test.ts` (forbids `SERVICE_ROLE` anywhere in `src/`, requires `import "server-only"` in `lib/supabase/*`), `src/proxy.ts` (public-first; `/account(.*)`, `/admin(.*)` protected; `/api/webhooks/clerk` already public), `src/components/store/header-auth.tsx` (links to `/account`, `/account/orders`), `(store)/layout.tsx`.
- `tests/db/harness.ts` (PGlite, `runAs` with Clerk-shaped claims, always rolled back), `scripts/seed/lib/env.ts` (service client for scripts), `scripts/db/supabase.ts`.
- Seed: 604 profiles, including one fake owner `user_seed_owner` and 3 fake staff.
- `@clerk/nextjs` 7.9.5 (Core 3): `verifyWebhook` from `@clerk/nextjs/webhooks`; backend `User.raw` exposes the same `UserJSON` shape the webhook sends.
- Environment state (names only, values never printed): `CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set; **`CLERK_WEBHOOK_SIGNING_SECRET` not set**; `SUPABASE_ACCESS_TOKEN` not set.
- `clerk doctor`: linked to app "Goreto", development instance only. `clerk config pull`: `session` is `null`, so **no `role` claim** in session tokens yet.

## Decisions

1. **Supabase trusts Clerk (config, not code).**
   - Clerk side (I do this with the CLI): `clerk config patch --json '{"session":{"claims":{"role":"authenticated"}}}'` on the **development** instance, after a `--dry-run`. This is exactly what Clerk's "Connect with Supabase" integration sets.
   - Supabase side (**you**): Dashboard → Authentication → Sign In / Providers → Third-party Auth → Add **Clerk** with the development Frontend API domain (I'll print it; it's the public domain inside the publishable key). No JWT template, no shared secret.
   - `supabase/config.toml` `[auth.third_party.clerk]` stays disabled (it only affects `supabase start`, which this machine can't run).

2. **User-context client** `src/lib/supabase/server.ts` (`server-only`):
   `getUserSupabase()` = `createClient(url, anonKey, { accessToken: async () => (await auth()).getToken() })`, wrapped in React `cache()` (one client per request, fresh token per call, never stored). No `@supabase/ssr`, no cookies.

3. **Privileged client** `src/lib/supabase/admin.ts` (`server-only`, service-role key). The webhook has no user token and the lazy upsert must write identity columns users can't, so `src/` now needs the service role in exactly one place.
   - Boundary test changes: `SERVICE_ROLE` may appear **only** in `lib/supabase/admin.ts`, and `admin.ts` may be imported **only** by `lib/auth/profile-sync.ts`. Everything else still fails the test.
   - Deployments now need `SUPABASE_SERVICE_ROLE_KEY` in the app's server env (still never `NEXT_PUBLIC_`).

4. **Migration** `supabase/migrations/<timestamp>_clerk_profile_sync.sql`:
   - `profiles.clerk_updated_at timestamptz` — the Clerk `updated_at` of the last applied snapshot, so **out-of-order or retried webhooks can't overwrite newer data**.
   - `sync_clerk_profile(p_clerk_user_id, p_email, p_full_name, p_phone_e164, p_clerk_updated_at) returns uuid` — `security invoker`, `search_path = ''`, executable by **`service_role` only**. Upserts on `clerk_user_id`; on conflict updates only if the stored row isn't deleted and the snapshot isn't older. Never touches `role`. `full_name`/`phone_e164` use `coalesce(new, existing)` so a value the user set in-app isn't wiped when Clerk has none. Email is lowercased.
   - `mark_clerk_profile_deleted(p_clerk_user_id)` — `service_role` only. Anonymizes: `deleted_at = now()`, `email/full_name/phone_e164 = null`, `role = 'customer'`; deletes the user's `staff_permissions`, `customer_addresses`, `wishlist_items`. Orders keep their snapshots (FK is `on delete set null` and the profile row stays). If no row exists yet (delete arrived before create), inserts a tombstone so a late `user.created` can't resurrect it.
   - `bootstrap_owner(p_clerk_user_id, p_replace_existing boolean)` — `service_role` only, one transaction. Refuses if another active owner exists unless `p_replace_existing`, in which case that owner is demoted to `customer`. Clears the new owner's `staff_permissions` (owner implies all).
   - Unique partial index `profiles_single_active_owner` on `(role) where role = 'owner' and deleted_at is null` — enforces AGENTS §29.5 "one owner initially" in the database. (Transfer = `--replace-existing`.)
   - Explicit `revoke … from public, anon, authenticated` + `grant execute … to service_role` on each function (per the harden_grants rule).

5. **Mapping Clerk → profile** `src/lib/auth/clerk-user.ts` (pure, no `server-only`, so the script can import it by relative path):
   - Zod-validates the `UserJSON` fields we read (`id`, `email_addresses[]`, `primary_email_address_id`, `phone_numbers[]`, `primary_phone_number_id`, `first_name`, `last_name`, `updated_at`).
   - `email` = primary address **only if its verification status is `verified`**, lowercased; else `null`.
   - `full_name` = trimmed first + last, `null` if empty. `phone_e164` = primary phone if it matches the DB's E.164 check, else `null`.
   - Used by the webhook (`evt.data`), the lazy upsert (`currentUser().raw`) and the owner script (Backend API user JSON) — one mapper, one shape.

6. **Sync functions** `src/lib/auth/profile-sync.ts` (`server-only`): `syncClerkProfile(input)` and `markClerkProfileDeleted(clerkUserId)` call the RPCs through `admin.ts`. Errors throw (the webhook turns them into 500 so Svix retries).

7. **Webhook** `src/app/api/webhooks/clerk/route.ts` (`POST`, Node runtime):
   - `verifyWebhook(req)`; failure → `400`.
   - `user.created` / `user.updated` → map + `syncClerkProfile`; invalid payload shape → `400` (logged without PII); `user.deleted` → `markClerkProfileDeleted(data.id)`; other events → `200` ignored.
   - DB failure → `500` (retry). Success → `200`. Idempotent by construction (monotonic `clerk_updated_at`, tombstones), so no `svix-id` table is needed.
   - Proxy already leaves it public; no proxy change.

8. **Current profile helpers** `src/lib/auth/profile.ts` (`server-only`) + pure `src/lib/auth/permissions.ts`:
   - `getCurrentProfile()` (React `cache`): `await auth()`; signed out → `null`. Reads own profile + `staff_permissions` via the **user-context client** (RLS proves the Clerk ↔ Supabase link). If missing → `currentUser()` → `syncClerkProfile` → re-read. Returns a small view model `{ id, clerkUserId, fullName, email, role, permissions }`, not the row type.
   - `requireProfile()` — signed out → `redirectToSignIn()`; returns profile.
   - `authorize(permission?)` → `{ ok: true, profile } | { ok: false, reason: "unauthenticated" | "forbidden" }` for Server Actions / route handlers (401 vs 403).
   - `requirePermission(permission)` / `requireOwner()` for pages → `notFound()` when forbidden (`forbidden()` is experimental).
   - `profileHasPermission(profile, key)`: owner → all; staff → listed keys; customer → none. Mirrors `has_permission()`; RLS remains the real enforcement.

9. **Owner bootstrap** `scripts/auth/bootstrap-owner.ts`, `npm run owner:bootstrap -- --email you@example.com` (or `--user-id user_…`), flags `--dry-run`, `--replace-existing`:
   - Looks the user up via Clerk Backend API (`CLERK_SECRET_KEY`, `fetch`, no SDK import), requires exactly one match with a **verified** email.
   - Calls `sync_clerk_profile` then `bootstrap_owner` with the service client. Prints target Supabase host and Clerk user id, never keys.
   - Not gated on `GORETO_DATA_ENV` (production needs it too), but refuses to silently replace an owner.
   - In dev, the seeded fake owner `user_seed_owner` exists, so the first run needs `--replace-existing`.

10. **`/account` stub** `src/app/(account)/layout.tsx` (same header/footer as the store layout) + `src/app/(account)/account/page.tsx`: `requireProfile()`, shows "Namaste, {first name}", email, role badge (owner/staff/customer), and an empty-state card "Orders, wishlist and addresses are coming soon." Uses existing `Badge`/card/typography tokens; no new design. `/account/orders` stays unbuilt (next task).

## Implementation notes (after execution)

- Generated RPC types mark every SQL argument as a required `string`, but `sync_clerk_profile` accepts nulls for email/name/phone. `profile-sync.ts` builds the args with a mapped type that allows `null` for those three keys. I tried re-ordering the parameters with `default null` instead, but the migration was already applied to the hosted dev DB, and rewriting that was declined. The applied SQL is unchanged.
- Signed-in lookups embed permissions with `staff_permissions!staff_permissions_profile_id_fkey`, because `staff_permissions` has two FKs to `profiles` (`profile_id`, `granted_by`).
- `npm run owner:bootstrap` passes `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`: the script imports `src/lib/auth/clerk-user.ts`, and the root `package.json` has no `"type"`.
- `db:types` regenerated with the current CLI. Besides the new column/RPCs, it now emits `Json` instead of `NonNullable<Json>` and `Args: never` for no-arg functions. Typecheck is unaffected.
- The Clerk dev instance now has `session.claims = {"role":"authenticated"}` (applied with `clerk config patch`). The Frontend API domain for Supabase is `precise-bunny-2406.clerk.accounts.dev`.

## Files expected to change

New:
- `supabase/migrations/<timestamp>_clerk_profile_sync.sql`
- `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`
- `src/lib/auth/clerk-user.ts`, `clerk-user.test.ts`
- `src/lib/auth/permissions.ts`, `permissions.test.ts`
- `src/lib/auth/profile-sync.ts`, `src/lib/auth/profile.ts`
- `src/app/api/webhooks/clerk/route.ts`, `route.test.ts`
- `src/app/(account)/layout.tsx`, `src/app/(account)/account/page.tsx`
- `scripts/auth/bootstrap-owner.ts`, `scripts/auth/package.json` (`"type": "module"`, like `scripts/seed`)
- `tests/db/profile-sync.test.ts` (+ a small multi-statement helper in `tests/db/harness.ts`)

Changed:
- `src/lib/supabase/boundaries.test.ts` (narrow service-role allowlist)
- `src/lib/supabase/public.ts` (comment only: points to `server.ts`)
- `src/types/database.ts` (regenerated)
- `package.json` (`owner:bootstrap` script)
- `.env.example` (comment: service role now also used by the webhook/profile sync server code)

## Database / RLS impact

- Additive migration: one nullable column, three functions, one partial unique index. Seed has exactly one active owner, so the index applies cleanly.
- No policy changes. Existing policies already scope reads to `current_profile_id()`; this task makes them reachable.
- Rollback: `drop index profiles_single_active_owner; drop function sync_clerk_profile, mark_clerk_profile_deleted, bootstrap_owner; alter table profiles drop column clerk_updated_at;` — no data loss beyond the sync timestamp.

## Security requirements

- Service-role key: server-only, one module, one importer, enforced by test.
- RPCs callable only by `service_role`; `anon`/`authenticated` get `permission denied` (tested).
- A signed-in user still can't change `role`, `email`, `clerk_user_id`, `deleted_at` (existing column grants + trigger; re-tested).
- Webhook: signature verified before any parsing; payload Zod-validated; logs contain event type and Clerk id only.
- Email stored only when Clerk says it's verified.
- Roles never read from Clerk metadata; the database is the authority.

## Acceptance criteria

1. Signing in and opening `/account` creates a `profiles` row (without the webhook) and shows my name, email and role.
2. With the webhook endpoint configured, creating/updating a user in Clerk updates the row; deleting anonymizes it.
3. Replaying an older `user.updated` doesn't overwrite newer data; replaying `user.deleted` is a no-op.
4. `npm run owner:bootstrap -- --email <me> --replace-existing` makes me the owner and demotes `user_seed_owner`; running it again is a no-op; running without `--replace-existing` when another owner exists refuses.
5. `/account` when signed out redirects to sign-in.
6. Boundary test fails if any other `src/` file references the service role.

## Checks to run

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`
- `npm run db:push -- --dry-run`, then `npm run db:push` (hosted **dev** project), then `npm run db:types` (needs `SUPABASE_ACCESS_TOKEN` or `npx supabase login`; if unavailable I'll say so and stop before hand-editing types)
- `clerk config patch … --dry-run`, then apply
- Manual browser check of `/account` signed in/out

## Tests

- Unit: `clerk-user` mapper (verified vs unverified email, missing names, bad phone, invalid payload), `permissions` (owner/staff/customer).
- Route: webhook handler with `verifyWebhook` and sync functions mocked — 400 on bad signature, 400 on bad shape, 200 + correct call per event type, 500 on DB error, 200 on ignored events.
- DB (PGlite): `sync_clerk_profile` insert/update/stale-ignored/role-preserved/deleted-ignored; `mark_clerk_profile_deleted` anonymizes + removes addresses/wishlist/permissions + tombstone; `bootstrap_owner` refuse/replace/idempotent; single-owner index; all three RPCs denied to `anon` and `authenticated`; `current_profile_id()` null after deletion.

## Manual test steps

1. You add Clerk in Supabase Third-party Auth (domain I print).
2. `npm run dev`, sign in, open `/account` → greeting, email, role `customer`.
3. `npm run owner:bootstrap -- --email <your email> --replace-existing` → reload `/account` → role `owner`.
4. Sign out, open `/account` → redirected to sign-in.
5. Optional webhook: `clerk webhooks listen --forward-to http://localhost:3000/api/webhooks/clerk`, add the printed relay URL as an endpoint in the Clerk Dashboard (events `user.*`), put its signing secret in `.env.local` as `CLERK_WEBHOOK_SIGNING_SECRET`, restart dev, change your name in Clerk → row updates.
