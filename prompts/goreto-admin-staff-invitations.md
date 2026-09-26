# Admin phase 4: staff invitations (Clerk Backend API) and role changes

Phase 4 of the admin follow-ups (`worklog.md` §4.5). Today `/admin/staff` only toggles permissions for staff who were created by setup scripts. This phase lets the owner invite a new staff member by email, see and revoke pending invitations, promote an existing customer, and remove someone from staff.

## Goal

1. **Invite staff**: the owner enters an email and picks the starting permissions. The server creates a Clerk invitation through the Backend API (`CLERK_SECRET_KEY`) and stores a pending invitation in Postgres.
2. **Accept**: when the invited person signs up and Clerk verifies that email, the profile sync makes them `staff` and grants the chosen permissions in the same transaction.
3. **Pending invitations**: a list with the email, starting permissions, sent date, expiry, and a **Revoke** action.
4. **Role changes**: **Remove from staff** (staff → customer, permissions deleted). If the invited email already belongs to a customer, that customer is promoted straight away.

## Non-goals

- **AR asset upload**, the other half of phase 4 in the worklog. It's split out as phase 4b with its own prompt, because it's a separate subsystem (storage bucket, `product_ar_assets` editor).
- Ownership transfer. It stays in `npm run owner:bootstrap -- --replace-existing`.
- Letting staff with `staff.manage` invite people. AGENTS §9.2 and §16 say staff management is owner-only, and the current RLS matches. `staff.manage` stays unused.
- Mirroring `role` into Clerk `publicMetadata` (the optional item in §4.5).
- Resending an invitation. The owner revokes it and invites again.
- Clerk Organizations. Roles stay in Postgres (AGENTS §6).

## Inspected

- `AGENTS.md` §6, §9.2–9.4, §11.1, §16, §18.6, §26.5.
- Migrations: `foundation` (`profiles`, `staff_permissions`, `is_owner()`, `has_permission()`, owner-only policies on `staff_permissions`), `harden_grants` (`guard_profile_identity` blocks role changes by `anon`/`authenticated`), `clerk_profile_sync` (`sync_clerk_profile`, `mark_clerk_profile_deleted`, `bootstrap_owner`, single-active-owner index).
- `src/app/(admin)/admin/staff/page.tsx`, `src/features/admin/{auth,nav,schemas}.ts`, `actions/{system,helpers}.ts`, `queries/system.ts` (`fetchStaff`).
- `src/lib/auth/{profile,profile-sync,clerk-user,permissions}.ts`, `src/app/api/webhooks/clerk/route.ts`, `scripts/auth/bootstrap-owner.ts`.
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`. `<SignUp />` accepts the `__clerk_ticket` from an invitation link without any changes.
- `@clerk/backend` 3.19.0: `InvitationAPI.createInvitation({ emailAddress, redirectUrl, expiresInDays, notify, ignoreExisting })` and `revokeInvitation(id)`. It errors when the email already has an invitation or an account.
- Skills: `clerk-backend-api` (`clerkClient` from `@clerk/nextjs/server`, 100 single invitations per hour), `supabase-postgres-best-practices`.
- `tests/db/{harness,profile-sync.test,admin.test}.ts`.
- Next docs: `02-guides/forms.md`, `04-functions/{refresh,headers}.md`.

## Decisions

### Data model (new migration `admin_staff_invitations`)

- Enum `staff_invitation_status`: `pending | accepted | revoked`. Expiry isn't a stored state. An invitation counts as expired when `status = 'pending'` and `expires_at <= now()`.
- Table `staff_invitations`:
  - `id` uuid
  - `email` text, lowercase check
  - `permissions` `staff_permission[]`, default `{}`
  - `status`
  - `clerk_invitation_id` text, unique, nullable until Clerk answers
  - `invited_by` → profiles, `on delete set null`
  - `accepted_profile_id` → profiles, `on delete set null`
  - `expires_at`, `accepted_at`, `revoked_at`, `created_at`, `updated_at`
- One pending invitation per email: a partial unique index on `email` where `status = 'pending'`.
- RLS:
  - owner can select and insert;
  - owner can update `status`, `clerk_invitation_id` and `revoked_at` only;
  - owner can delete only rows whose Clerk call never succeeded (`clerk_invitation_id is null`);
  - explicit grants, following `harden_grants`.
- Trigger: the `authenticated` role can move a row only from `pending` to `revoked`, and can set `clerk_invitation_id` once. `accepted` can be set only by the trusted sync path.

### Acceptance happens in the database

- New `apply_staff_invitation(p_profile_id, p_email)`, executable by `service_role` only. It runs if the profile is an active `customer` and a pending, unexpired invitation exists for that exact verified email. It then sets `role = 'staff'`, inserts the permissions (`granted_by` = inviter), and marks the invitation `accepted`.
- `sync_clerk_profile` calls it after every applied snapshot that has an email. It already receives **only verified** primary emails (`clerk-user.ts`), so the verified-email rule from AGENTS §9.1 holds. That means the webhook and the lazy upsert both accept invitations, and a late webhook never blocks the new staff member.
- An existing owner or staff member is never changed by an invitation.
- Because the match is by verified email, the invitee is also accepted if they sign up normally instead of using the link. Clerk's revoke only disables the link, so the database status is what grants access. A revoked or expired invitation grants nothing.

### Role changes

- New `admin_set_staff_role(p_profile_id, p_role, p_permissions)`. It's `security definer` with `search_path = ''`, executable by `authenticated`, and re-checks `is_owner()` itself.
  - Allowed only between `customer` and `staff`.
  - Refuses the owner, the caller, and deleted profiles with readable `22023` messages.
  - Promoting inserts the permissions. Demoting deletes all permissions.
  - Runs as the function owner, so `guard_profile_identity` still blocks direct role updates by users.

### Server actions (`src/features/admin/actions/staff.ts`, owner only)

- `inviteStaffAction(email, permissions[])`:
  1. Authorize the owner, then validate with Zod (email lowercased and trimmed, ≤ 254 characters, permissions de-duplicated).
  2. Look up an active profile with that email (verified emails only).
     - Owner or staff → inline error "Already on the team."
     - Customer → `admin_set_staff_role(..., 'staff', permissions)`. The message says they already had an account and now have staff access.
  3. Otherwise insert the pending row. A duplicate shows "An invitation is already pending for this email."
  4. Then call `clerkClient().invitations.createInvitation`:
     - `redirectUrl`: `<origin>/sign-up`, where origin is `NEXT_PUBLIC_SITE_URL` if set, else the request's `Origin` header;
     - `expiresInDays: 7`, `notify: true`.
  5. Store the Clerk id. If Clerk fails, delete the row and map the error. "Identifier exists" becomes "This email already has an account that isn't verified yet. Ask them to sign in and verify it, then try again." Anything else is a generic message, logged without the email.
- `revokeInvitationAction(id)`: marks the row `revoked` first, because the database is the authority, then calls Clerk `revokeInvitation`. If Clerk fails, the row stays revoked and the message says the email link may still open but won't grant access.
- `removeStaffAction(profileId)`: `admin_set_staff_role(id, 'customer', '{}')`, behind a confirm dialog.
- The existing `setStaffPermissionAction` is unchanged.
- `clerkClient` is imported only in this server file. `CLERK_SECRET_KEY` stays server-only.

### UI (`/admin/staff`, owner only, same page)

- The info card ("Inviting new staff … will arrive in a follow-up") is replaced by an **Invite staff** panel:
  - email field;
  - permission checkboxes grouped like the table, with nothing ticked by default and a hint that permissions can be changed later;
  - an **Send invitation** primary button.
  - `useActionState` shows inline errors and a success notice.
- **Pending invitations** panel:
  - a table with email, starting permissions (as short labels), sent date, and expiry ("Expires 3 Oct" or an "Expired" warning pill);
  - a Revoke button with a confirm dialog;
  - an empty state.
  - Expired rows show "Expired". Revoking them is still allowed, which clears the pending slot so the email can be invited again.
- Staff table: a **Remove from staff** row action (confirm dialog: "They keep their customer account and order history").
- `PERMISSION_GROUPS` moves from the page to `src/features/admin/staff-permissions.ts` so the table and the invite form share it.
- Tokens, `Panel`, `TableScroll`, `Pill`, confirm-dialog and form patterns are reused from the existing admin components. No new icon library.

## Files expected to change

- `supabase/migrations/<ts>_admin_staff_invitations.sql` (new): the enum, table, indexes, RLS, grants and trigger; `apply_staff_invitation`; `admin_set_staff_role`; `sync_clerk_profile` replaced to call `apply_staff_invitation`.
- `src/types/database.ts`: regenerated.
- `src/features/admin/staff-permissions.ts` (new): permission groups, labels, and the invitation display status helper.
- `src/features/admin/staff-forms.ts` (new): Zod schemas for invite, revoke and remove, and the mapping from Clerk errors to messages.
- `src/features/admin/actions/staff.ts` (new): the three actions.
- `src/features/admin/queries/system.ts`: `fetchStaffInvitations()`.
- `src/components/admin/staff-invite-form.tsx`, `staff-invitations.tsx`, `staff-remove-button.tsx` (new).
- `src/app/(admin)/admin/staff/page.tsx`: new panels and row action.
- `.env.example`: `NEXT_PUBLIC_SITE_URL`, commented as the invitation link origin.
- Tests: `src/features/admin/staff-forms.test.ts`, `src/components/admin/__tests__/staff-invite-form.test.tsx`, `tests/db/admin-staff.test.ts`.
- `worklog.md`: tick phase 4 (staff) and add phase 4b (AR upload).

## Auth / RLS

- Page: `requireAdminAccess("owner")`. Actions: `authorizeAndParse("owner", …)`, then RLS, then the function's own `is_owner()` check.
- Customers, staff (even with `staff.manage`) and anon can't read or write invitations and can't call `admin_set_staff_role`. `apply_staff_invitation` is `service_role` only.
- No service-role key in the actions. The Clerk secret is used only in the server action module.

## Acceptance criteria

- The owner invites `new.staff+clerk_test@example.com` with *View orders* and *Fulfil orders*. It appears under Pending invitations with those two permissions, and a Clerk invitation exists (`clerk api /invitations`).
- Opening the invitation link and signing up with that email (test code `424242`) produces a staff profile with exactly those two permissions. The invitation shows as accepted and moves out of Pending. The new staff member sees only Orders in the admin nav.
- Inviting the same email again while it's pending shows the duplicate error. Inviting the owner's or a staff member's email shows "Already on the team."
- Inviting a seeded customer's verified email promotes them immediately with the chosen permissions, and no Clerk invitation is created.
- Revoke removes the row from Pending, and the Clerk invitation is revoked. If that person signs up afterwards, they stay a customer.
- An expired invitation grants nothing, and shows "Expired" in the list.
- Remove from staff turns the member back into a customer and deletes their permissions. They get a 404 on `/admin`. The owner can't remove themselves, and the owner doesn't appear with that action.
- Invalid input shows inline errors: an empty or invalid email, or an email over 254 characters.
- Keyboard: every control is reachable and the dialogs trap and return focus. There is no horizontal overflow at 375 px.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`.
- `npm run db:push`, then `npm run db:types` against the hosted **dev** DB.
- DB tests (PGlite, per role):
  - invitation RLS: owner, staff with `staff.manage`, customer, anon;
  - pending uniqueness;
  - the trigger blocks `authenticated` from setting `accepted`;
  - the sync accepts a pending invitation and ignores expired, revoked or wrong-email ones;
  - the sync leaves owner and staff untouched;
  - the sync is idempotent on replay;
  - `admin_set_staff_role`: promote and demote, refusals for owner, self and deleted profiles, denied for staff, customer and anon.
- Browser check with a Playwright scratch script as the owner (Clerk sign-in token, like phase 3): invite a `+clerk_test` email, accept it through the invitation URL in a second context, check the nav, remove from staff, and revoke a second invitation. Then clean up the test users with `clerk api`.

## Manual test steps

1. Open `/admin/staff` as the owner. In **Invite staff**, enter `new.staff+clerk_test@example.com` and tick *View orders* and *Fulfil orders*. Click **Send invitation**. It appears under Pending invitations.
2. Send the same email again. You get "An invitation is already pending for this email."
3. In a private window, open the invitation link from `clerk api /invitations` (the `url` field). Sign up using code `424242`, then open `/admin`. Only Orders is visible.
4. Back as the owner, reload. The new member is in the Staff table with the two permissions, and the invitation has left Pending.
5. Invite `second+clerk_test@example.com`, then **Revoke** it. It leaves the list.
6. Use **Remove from staff** on the new member and confirm. In their window, `/admin` returns a 404.
7. Invite a seeded customer's email. The message says they already had an account and are now staff. Remove them again.
8. Clean up: delete the two test Clerk users (`clerk api -X DELETE /users/<id>`).

## Rollback

- The migration adds one enum, one table, two functions, and a new body for `sync_clerk_profile`. It changes no existing data.
- To roll back, restore the previous `sync_clerk_profile` body from `clerk_profile_sync` and drop the new objects. Staff accepted through invitations stay staff, because they're ordinary profile and permission rows.
- Pending Clerk invitations should be revoked in Clerk when rolling back.

## Implementation notes (after execution)

- **Files as built:**
  - the row actions live in one file, `staff-actions.tsx` (`RevokeInvitationButton`, `RemoveStaffButton`), rather than two;
  - `FormDialog` gained an optional `triggerContext`, screen-reader text that names the record ("Revoke invitation for …");
  - `UserMinusIcon` and `ProhibitIcon` were added to the Phosphor re-exports.
- **Insert grants:** `authenticated` may insert only `email`, `permissions` and `invited_by`. RLS requires `invited_by` to be the caller and `status = 'pending'`. `expires_at` defaults to now + 7 days, so the browser never sets it. The guard trigger stamps `revoked_at`.
- **Acceptance** lives in `apply_staff_invitation(profile_id)`. It reads the profile's stored (verified) email instead of taking one as an argument, so a stale snapshot can't smuggle in an old email.
- **Clerk behaviour seen in dev:**
  - The invitation link lands on `/sign-up` with the ticket.
  - Clerk's bot protection (Turnstile) blocks a headless browser at that point, so the browser check created the invited user through the Backend API instead. That path gives the same verified email and runs the same lazy sync.
  - Clerk then marks the invitation `accepted` by itself.
- **Fixed a pre-existing bug found during the check:** a brand-new user's first protected page returned 500 with "Profile synced but not visible to the signed-in session".
  - The cause: Next memoizes identical GET `fetch` calls during one render pass, so the read after the lazy sync replayed the empty first read.
  - The fix: `readOwnProfile` passes a fresh `AbortController` signal, which is the documented opt-out in `04-functions/fetch.md`. `getCurrentProfile` is still deduplicated by React `cache()`.
  - This affected every new customer, not just staff.
- **Browser check** (Playwright scratch script, owner signed in with a Clerk sign-in token, against the running dev server and the hosted dev DB):
  - invalid email, owner email, duplicate pending and successful invites;
  - Clerk invitations created, then revoked;
  - the accepted staff member got exactly the invited permissions, and their first `/admin/orders` load returned 200 with nav limited to their access;
  - `/admin/staff` returned 404 for them;
  - Remove from staff, then their `/admin` returned 404;
  - 0 px overflow at 375 px.
- **Cleanup:** the Clerk test users were deleted and their profiles tombstoned (`mark_clerk_profile_deleted`). The test invitation rows were removed.
