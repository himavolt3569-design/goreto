# Switch authentication to Clerk and wire storefront auth controls

## Goal

The auth decision changes: **Clerk** replaces Supabase Auth for every user type — customers, the owner, and future staff. Customers get accounts with a dedicated account area (orders, tracking history, wishlist, total billed to date, and more later).

This task does two things:

1. Install and link Clerk with the Clerk CLI, following the user-supplied Clerk setup instructions, and put sign-in / sign-up / user controls into the existing storefront header.
2. Rewrite `AGENTS.md` so every section that assumed Supabase Auth now describes Clerk + Supabase (Clerk as a Supabase third-party auth provider, RLS on the Clerk user id).

## Non-goals

- Supabase itself. There is no Supabase client, schema, or migration in the repo yet. Wiring the Supabase third-party-auth integration, `profiles` table, and Clerk webhook sync belongs to the first Supabase task; this task only documents the rules for it in `AGENTS.md`.
- Account pages (`/account`, orders, wishlist, billing summary). `/account/*` becomes sign-in-protected, but its pages are a later task. Until then a signed-in visit to `/account` 404s, same as today.
- Admin role enforcement. `/admin/*` is sign-in-protected at the proxy; owner/staff checks come with the admin + Supabase work.
- Clerk Organizations or Clerk Billing. This is a single store; staff roles live in our database (see decision 5).
- Custom Clerk flows built with `useSignIn` / `useSignUp`. Clerk's prebuilt components, themed with our tokens, are enough for now.

## What I inspected

- `AGENTS.md` (all sections touching auth: §1, §5, §5.1, §6, §7, §8, §9, §10.7, §11.1, §16, §17, §18.2, §19, §23, §26.5–26.6, §29, §30).
- `package.json`: Next 16.3.6, React 19.2.8, npm (`package-lock.json`). No Clerk or Supabase packages.
- `src/app/layout.tsx` (root layout, fonts, inline `js` script), `src/app/(store)/layout.tsx`, `src/components/store/store-header.tsx`, `src/components/store/mobile-nav.tsx`, `src/config/site.ts`, `src/components/ui/*` (`iconButtonClasses`, `buttonClasses`, icons), `src/app/globals.css` tokens.
- No `proxy.ts` / `middleware.ts`, no `components.json` (no shadcn step).
- Clerk CLI is installed globally: `clerk 3.3.0`.
- Local Next docs: `03-api-reference/03-file-conventions/proxy.md` — `middleware` is deprecated and renamed to `proxy`; the file lives in `src/` next to `app/`.
- Skills: `clerk-setup`, `clerk-nextjs-patterns` (`references/middleware-strategies.md`), `clerk` router; `supabase` (for the RLS/third-party-auth rules written into AGENTS.md).

## Decisions

1. **Setup via CLI, per the supplied instructions.** `clerk update --yes` → `clerk auth login` (pauses for you to finish the browser login) → `clerk init --app app_3JlaOtlkVRWQFVkTyCiMUfltr1G` (auto-detects Next.js + npm). I will not read or print `.env.local`; the CLI writes the keys there.
2. **`src/proxy.ts`, public-first.** Next 16 uses `proxy.ts`. Storefront, search, product, cart, checkout (guest checkout), tracking, and try-on stay public. `auth.protect()` on `/account(.*)` and `/admin(.*)`. Matcher includes `'/(api|trpc)(.*)'` followed once by `'/__clerk/:path*'`. If `clerk init` generates a proxy, I adapt it rather than write a second one.
3. **Dedicated auth routes.** `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` and `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` render Clerk's `<SignIn />` / `<SignUp />` centred on the `neutral-50` page surface with the logo. Env points Clerk at these paths (`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`) — added to `.env.example` by name/value (non-secret). This replaces the `login` / `sign-up` / `forgot-password` / `auth/callback` placeholders in AGENTS §7; Clerk handles reset and OAuth callbacks.
4. **Themed with our tokens, not restyled.** `ClerkProvider` goes inside `<body>` in the root layout, with `appearance.variables`: `colorPrimary #F97316`, `colorForeground #0F172A`, `colorMutedForeground #64748B`, `colorBackground #FFFFFF`, `colorInput #FFFFFF`, `colorBorder #E2E8F0`, `colorDanger #EF4444`, `fontFamily` = the Inter CSS variable, `borderRadius 12px`. Exact variable names verified against the installed `@clerk/nextjs` types before use.
5. **Roles stay in Postgres (documented, not built here).** Clerk is identity; `profiles.role` and `staff_permissions` in Supabase remain the authority for RLS. The server may mirror `role` into Clerk `publicMetadata` (server-only write) for fast proxy/UI gating, but the database check still runs on every sensitive action. Clerk Organizations is not used.
6. **Header controls.** In `store-header.tsx`:
   - signed out: a `SignInButton` wrapping a tertiary/ghost "Sign in" control and a `SignUpButton` wrapping a primary "Sign up" button (44px, 12px radius), shown from `sm` up; below `sm` the existing user icon links to `/sign-in`.
   - signed in: `UserButton` (with an "Account" / "My orders" menu link to `/account` and `/account/orders`) replaces the user icon link.
   - Uses Clerk's `<Show when="signed-in|signed-out">` (Core 3). If the installed SDK is Core 2, I use `<SignedIn>` / `<SignedOut>` instead.
   - Mobile nav: signed-out shows "Sign in" / "Create account" links; signed-in keeps "Account".
   - The wishlist heart stays; it lands on `/account/wishlist`, which is now protected, so a signed-out tap goes to sign-in.
7. **No Supabase Auth anywhere.** AGENTS.md forbids adding Supabase Auth alongside Clerk, mirroring the old rule in reverse.

## AGENTS.md changes

- §1 / new §4.9 **Customer account area**: overview (profile, total billed to date), orders + order detail, tracking history, wishlist, saved addresses, reviews; "total billed" = sum of `total_paisa` for orders with `payment_status = collected`, pending COD shown separately, computed server-side; extensible for later features.
- §5 stack table: Auth → Clerk (`@clerk/nextjs`); Row authorization → Supabase RLS using the Clerk session token via Supabase third-party auth.
- §5.1 skills: add the Clerk skills (`clerk`, `clerk-setup`, `clerk-nextjs-patterns`, `clerk-custom-ui`, `clerk-webhooks`, `clerk-testing`, `clerk-cli`).
- §6: remove the "No Clerk" ban; add "No Supabase Auth, Auth0, or custom auth alongside Clerk", "No Clerk Organizations for store staff", "No `@clerk/clerk-react` in the Next app".
- §7 routes: `(auth)/sign-in/[[...sign-in]]`, `(auth)/sign-up/[[...sign-up]]`; expanded `(account)` routes (orders, order detail/tracking, wishlist, addresses, reviews, billing); `api/webhooks/clerk/route.ts`; `src/proxy.ts`.
- §8 table: auth/session row → Clerk session (`await auth()` server, hooks client).
- §9 rewritten: Clerk identity; guest checkout still allowed; guest orders can be claimed on sign-up by verified email; owner bootstrap via trusted server script/migration by Clerk user id; staff invites via Clerk invitations from a server-only path; role/permission truth in Postgres; §9.3 becomes **Clerk + Next.js rules** (await `auth()`, `ClerkProvider` inside `<body>`, proxy matcher incl. `/__clerk/:path*`, `CLERK_SECRET_KEY` server-only, `auth.protect()` is not authorization).
- New §9.4 **Clerk ↔ Supabase**: Supabase third-party auth with Clerk; server/browser Supabase clients pass the Clerk session token via `accessToken`; RLS uses `auth.jwt()->>'sub'`; Clerk ids are text, not UUID; `profiles` synced by a verified, idempotent Clerk webhook (`user.created/updated/deleted`) plus a lazy upsert on first authenticated request.
- §11.1 `profiles`: `id` uuid PK + `clerk_user_id text unique not null`; all user-owned tables (`orders.user_id`, `wishlist_items`, `customer_addresses`, `reviews`, `try_on_jobs`) reference `profiles.id`; RLS resolves the current profile from `auth.jwt()->>'sub'` via a locked-down helper.
- §16: RLS wording from "authenticated user" to "profile matching the Clerk `sub`"; helper functions `security definer` with fixed `search_path`.
- §17 env: add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, sign-in/up URLs; keep the Supabase keys.
- §18.2 → Clerk session/proxy quirks; §18.6 webhooks includes Clerk.
- §19: `src/lib/auth/` for Clerk helpers (`requireProfile`, `requirePermission`), `src/lib/supabase/*` token-aware clients.
- §23: RLS tests use Clerk-shaped JWTs; E2E sign-in via `@clerk/testing`; add account-area journeys.
- §26.5 / §26.6: role escalation via Clerk `publicMetadata`/`unsafeMetadata`; `CLERK_SECRET_KEY` leakage.
- §29 decisions 3 and 5 updated; §30 non-negotiables "Supabase Auth + RLS" → "Clerk auth + Supabase RLS".

## Files expected to change

- `package.json`, `package-lock.json` (`@clerk/nextjs` via `clerk init`)
- `.env.local` (written by the CLI — not read, not committed)
- `.env.example` (new: variable names, no secrets)
- `src/proxy.ts` (new)
- `src/app/layout.tsx` (`ClerkProvider` inside `<body>`)
- `src/app/(auth)/layout.tsx`, `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` (new)
- `src/components/store/store-header.tsx`, `src/components/store/mobile-nav.tsx`
- `src/lib/auth/clerk-appearance.ts` (new, token-based appearance)
- `AGENTS.md`
- Any additional files `clerk init` generates are reviewed and kept only if they fit the above.

## Database / migration impact

None in this task. Future schema rules are written into AGENTS.md.

## Security

- `CLERK_SECRET_KEY` only in `.env.local` / deployment secrets; never `NEXT_PUBLIC_`.
- `.env.local` is already git-ignored (verify before finishing).
- Proxy protection is authentication only; authorization stays in DB/server code.

## Acceptance criteria

1. `clerk doctor` reports no errors.
2. Signed out: header shows Sign in + Sign up (desktop) and the links in the mobile menu.
3. Sign-up at `/sign-up` creates a user; afterward the header shows the Clerk user button.
4. Signed-out visit to `/account` or `/admin` redirects to `/sign-in`.
5. Homepage and `/design-system` stay public and render unchanged apart from the header controls.
6. Clerk components use the orange primary, Inter, and 12px radius.
7. `AGENTS.md` has no remaining instruction to use Supabase Auth, and no ban on Clerk.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `clerk doctor`, then manual browser pass on `npm run dev`.

## Manual test steps

1. `npm run dev`, open `http://localhost:3000`.
2. Confirm "Sign in" and "Sign up" in the header; resize below `sm` and open the menu to see the mobile links.
3. Click "Sign up", create a test account, confirm the user avatar appears.
4. Open the avatar menu → Account link present; sign out → controls revert.
5. While signed out, visit `/account` → redirected to `/sign-in`.

## Rollback

`git checkout` the changed files, `npm uninstall @clerk/nextjs`, delete `src/proxy.ts` and `src/app/(auth)`. The Clerk app in the dashboard is unaffected.

## Implementation notes (post-approval)

- The first CLI login (`praashon.dev@gmail.com`) could not see the app. The user chose to re-login as `himavolt3569@gmail.com`, and then `clerk init --app app_3JlaOtlkVRWQFVkTyCiMUfltr1G` linked **Goreto** and installed `@clerk/nextjs@7.9.5` (Core 3).
- `clerk init` scaffolded `src/app/sign-{in,up}` and a bare proxy. The pages were moved into `(auth)`, and the proxy was rewritten as public-first with `/__clerk/:path*`.
- The header buttons show from `xl` (not `sm`), because the `lg` nav, search, and two buttons don't fit at 1024px. Below `xl` an account icon links to `/sign-in`, and the mobile menu lists Sign in and Create account.
- `HeaderAuth` is a Client Component, so `<Show>` resolves on the client and `/` stays static (confirmed in the build output).
- Clerk draws `colorBorder` at about 11% alpha. The theme passes `#0F172A` so fields render at roughly neutral-200. This was checked with computed styles and screenshots.
- Added `PackageIcon` to the curated icon set for the user-menu "My orders" link.
- `.gitignore` ignored `.env*`, including `.env.example`, so `!.env.example` was added (AGENTS §17).
