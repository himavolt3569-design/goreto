-- Clerk -> profiles sync and owner bootstrap (AGENTS §9.2, §9.4, §11.1).
--
-- Profiles are written only by trusted server code with the service role:
-- the verified Clerk webhook, the lazy upsert on a user's first
-- authenticated request, and the owner bootstrap script. These functions are
-- the only write paths they use, so the rules live here once:
--
-- * Snapshots are applied in Clerk `updated_at` order, so a retried or
--   out-of-order webhook can never overwrite newer data.
-- * A deleted user stays deleted: later snapshots are ignored, and a delete
--   that arrives before the create leaves a tombstone.
-- * Syncing never touches `role`. Only bootstrap_owner() does, and it keeps a
--   single active owner.
--
-- All three are security invoker and executable by service_role only.

alter table public.profiles add column clerk_updated_at timestamptz;

comment on column public.profiles.clerk_updated_at is
  'Clerk updated_at of the last applied user snapshot; older snapshots are ignored.';

-- One store, one owner (AGENTS §29.5). Transfer with bootstrap_owner(..., true).
create unique index profiles_single_active_owner
  on public.profiles (role)
  where role = 'owner' and deleted_at is null;

/* ---------- Sync a Clerk user snapshot ---------- */

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

  return v_id;
end;
$$;

/* ---------- Anonymize a deleted Clerk user ----------
 * The row stays so orders keep their accounting link; order contact and
 * address snapshots are untouched. Personal data the store holds only for
 * the account (addresses, wishlist) and any staff access go.
 */

create or replace function public.mark_clerk_profile_deleted(p_clerk_user_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.profiles as p (clerk_user_id, deleted_at)
  values (p_clerk_user_id, now())
  on conflict (clerk_user_id) do update
    set deleted_at = now(),
        email = null,
        full_name = null,
        phone_e164 = null,
        role = 'customer'
    where p.deleted_at is null
  returning p.id into v_id;

  -- Already deleted (a retried event): nothing more to do.
  if v_id is null then
    return;
  end if;

  delete from public.staff_permissions where profile_id = v_id;
  delete from public.customer_addresses where user_id = v_id;
  delete from public.wishlist_items where user_id = v_id;
end;
$$;

/* ---------- Owner bootstrap ---------- */

create or replace function public.bootstrap_owner(
  p_clerk_user_id text,
  p_replace_existing boolean default false
)
returns table (owner_id uuid, demoted_owner_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target uuid;
  v_current uuid;
begin
  select p.id into v_target
  from public.profiles p
  where p.clerk_user_id = p_clerk_user_id
    and p.deleted_at is null
  for update;

  if v_target is null then
    raise exception 'no active profile for Clerk user %', p_clerk_user_id
      using errcode = 'P0002';
  end if;

  select p.id into v_current
  from public.profiles p
  where p.role = 'owner'
    and p.deleted_at is null
    and p.id <> v_target
  for update;

  if v_current is not null then
    if not p_replace_existing then
      raise exception 'another active owner exists'
        using errcode = 'P0001',
              hint = 'Pass p_replace_existing => true to transfer ownership.';
    end if;
    update public.profiles set role = 'customer' where id = v_current;
  end if;

  update public.profiles set role = 'owner' where id = v_target and role <> 'owner';
  -- An owner has every permission; stale staff rows would only confuse.
  delete from public.staff_permissions where profile_id = v_target;

  return query select v_target, v_current;
end;
$$;

revoke execute on function public.sync_clerk_profile(text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.mark_clerk_profile_deleted(text)
  from public, anon, authenticated;
revoke execute on function public.bootstrap_owner(text, boolean)
  from public, anon, authenticated;

grant execute on function public.sync_clerk_profile(text, text, text, text, timestamptz) to service_role;
grant execute on function public.mark_clerk_profile_deleted(text) to service_role;
grant execute on function public.bootstrap_owner(text, boolean) to service_role;
