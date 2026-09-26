-- Admin phase 4 (prompts/goreto-admin-staff-invitations.md): staff
-- invitations and role changes (AGENTS §9.2).
--
-- * The owner invites an email with starting permissions. The server sends a
--   Clerk invitation; this table is the authority for what it grants.
-- * When a Clerk user with that *verified* email is synced (webhook or lazy
--   upsert), apply_staff_invitation() makes them staff in the same
--   transaction. Revoked or expired invitations grant nothing, even if the
--   Clerk link still opens.
-- * admin_set_staff_role() is the only way a signed-in user (the owner)
--   changes a role, and only between customer and staff. Ownership transfer
--   stays in the bootstrap script.

create type public.staff_invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null
    constraint staff_invitations_email_format
      check (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  permissions public.staff_permission[] not null default '{}',
  status public.staff_invitation_status not null default 'pending',
  clerk_invitation_id text unique,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_profile_id uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_invitations is
  'Owner-sent staff invitations. Accepted by the Clerk profile sync when a verified email matches (apply_staff_invitation).';

-- One open invitation per email; accepted/revoked rows stay as history.
create unique index staff_invitations_one_pending_per_email
  on public.staff_invitations (email)
  where status = 'pending';
create index staff_invitations_invited_by_idx on public.staff_invitations (invited_by);
create index staff_invitations_accepted_profile_idx on public.staff_invitations (accepted_profile_id);

create trigger staff_invitations_set_updated_at
  before update on public.staff_invitations
  for each row execute function public.set_updated_at();

/* ---------- Transitions signed-in users may make ----------
 * Column grants limit the owner to status and clerk_invitation_id; this adds
 * the rules grants can't express. Trusted server code (service_role) accepts.
 */

create or replace function public.staff_invitations_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status and not (old.status = 'pending' and new.status = 'revoked') then
      raise exception 'Only a pending invitation can be revoked.' using errcode = '22023';
    end if;
    if new.clerk_invitation_id is distinct from old.clerk_invitation_id and old.clerk_invitation_id is not null then
      raise exception 'The Clerk invitation id is already set.' using errcode = '22023';
    end if;
  end if;

  if new.status = 'revoked' and old.status <> 'revoked' then
    new.revoked_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.staff_invitations_guard() from public, anon, authenticated;

create trigger staff_invitations_guard
  before update on public.staff_invitations
  for each row execute function public.staff_invitations_guard();

/* ---------- RLS: owner only ---------- */

alter table public.staff_invitations enable row level security;

create policy "staff_invitations: owner read"
  on public.staff_invitations for select to authenticated
  using ((select public.is_owner()));

create policy "staff_invitations: owner insert"
  on public.staff_invitations for insert to authenticated
  with check (
    (select public.is_owner())
    and invited_by = (select public.current_profile_id())
    and status = 'pending'
  );

create policy "staff_invitations: owner update"
  on public.staff_invitations for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- Only rows whose Clerk invitation was never created (a failed send).
create policy "staff_invitations: owner delete unsent"
  on public.staff_invitations for delete to authenticated
  using ((select public.is_owner()) and clerk_invitation_id is null and status = 'pending');

grant select, delete on public.staff_invitations to authenticated;
grant insert (email, permissions, invited_by) on public.staff_invitations to authenticated;
grant update (status, clerk_invitation_id) on public.staff_invitations to authenticated;

/* ---------- Accept on profile sync (service_role only) ----------
 * Uses the profile's stored email, which the sync writes only when Clerk has
 * verified it (src/lib/auth/clerk-user.ts). Never changes an owner or staff
 * member. Returns true when an invitation was accepted.
 */

create or replace function public.apply_staff_invitation(p_profile_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text;
  v_invitation_id uuid;
  v_permissions public.staff_permission[];
  v_invited_by uuid;
begin
  select p.email into v_email
  from public.profiles p
  where p.id = p_profile_id
    and p.role = 'customer'
    and p.deleted_at is null
  for update;

  if v_email is null then
    return false;
  end if;

  select i.id, i.permissions, i.invited_by into v_invitation_id, v_permissions, v_invited_by
  from public.staff_invitations i
  where i.email = v_email
    and i.status = 'pending'
    and i.expires_at > now()
  for update;

  if v_invitation_id is null then
    return false;
  end if;

  update public.profiles set role = 'staff' where id = p_profile_id;

  insert into public.staff_permissions (profile_id, permission_key, granted_by)
  select p_profile_id, granted.key, v_invited_by
  from unnest(v_permissions) as granted(key)
  on conflict (profile_id, permission_key) do nothing;

  update public.staff_invitations
  set status = 'accepted', accepted_profile_id = p_profile_id, accepted_at = now()
  where id = v_invitation_id;

  return true;
end;
$$;

revoke execute on function public.apply_staff_invitation(uuid) from public, anon, authenticated;
grant execute on function public.apply_staff_invitation(uuid) to service_role;

/* ---------- sync_clerk_profile: now also accepts invitations ----------
 * Same body as in clerk_profile_sync, plus the apply_staff_invitation call.
 */

create or replace function public.sync_clerk_profile(
  p_clerk_user_id text,
  p_email text,
  p_full_name text,
  p_phone_e164 text,
  p_clerk_updated_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.profiles as p (clerk_user_id, email, full_name, phone_e164, clerk_updated_at)
  values (p_clerk_user_id, lower(p_email), p_full_name, p_phone_e164, p_clerk_updated_at)
  on conflict (clerk_user_id) do update
    set email = excluded.email,
        -- Keep a name/phone the customer set in-app when Clerk has none.
        full_name = coalesce(excluded.full_name, p.full_name),
        phone_e164 = coalesce(excluded.phone_e164, p.phone_e164),
        clerk_updated_at = excluded.clerk_updated_at
    where p.deleted_at is null
      and (p.clerk_updated_at is null or p.clerk_updated_at <= excluded.clerk_updated_at)
  returning p.id into v_id;

  -- Skipped as stale: still report the active profile. Null means deleted.
  if v_id is null then
    select p.id into v_id
    from public.profiles p
    where p.clerk_user_id = p_clerk_user_id
      and p.deleted_at is null;
  end if;

  if v_id is not null then
    perform public.apply_staff_invitation(v_id);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.sync_clerk_profile(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.sync_clerk_profile(text, text, text, text, timestamptz) to service_role;

/* ---------- Owner changes a role (customer <-> staff) ----------
 * security definer: users can't update profiles.role (column grants and
 * guard_profile_identity), so the owner goes through this checked path.
 */

create or replace function public.admin_set_staff_role(
  p_profile_id uuid,
  p_role public.profile_role,
  p_permissions public.staff_permission[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := public.current_profile_id();
  v_role public.profile_role;
  v_deleted_at timestamptz;
begin
  if not public.is_owner() then
    raise exception 'Only the store owner can change staff roles.' using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'Ownership can''t be transferred here.' using errcode = '22023';
  end if;

  select p.role, p.deleted_at into v_role, v_deleted_at
  from public.profiles p
  where p.id = p_profile_id
  for update;

  if not found or v_deleted_at is not null then
    raise exception 'That account no longer exists.' using errcode = '22023';
  end if;
  if p_profile_id = v_caller or v_role = 'owner' then
    raise exception 'The store owner''s role can''t be changed here.' using errcode = '22023';
  end if;
  if v_role = p_role then
    raise exception '%', case when p_role = 'staff' then 'Already on the team.' else 'That person isn''t on the staff.' end
      using errcode = '22023';
  end if;

  update public.profiles set role = p_role where id = p_profile_id;

  if p_role = 'customer' then
    delete from public.staff_permissions where profile_id = p_profile_id;
  else
    insert into public.staff_permissions (profile_id, permission_key, granted_by)
    select p_profile_id, granted.key, v_caller
    from unnest(coalesce(p_permissions, '{}')) as granted(key)
    on conflict (profile_id, permission_key) do nothing;
  end if;
end;
$$;

revoke execute on function public.admin_set_staff_role(uuid, public.profile_role, public.staff_permission[]) from public, anon;
grant execute on function public.admin_set_staff_role(uuid, public.profile_role, public.staff_permission[]) to authenticated;
