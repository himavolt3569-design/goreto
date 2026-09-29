-- Customer account phase 2 (AGENTS §4.9, §11.4, §11.6): saved addresses with
-- one default, and per-profile caps on addresses and wishlist items.
--
-- The address functions are security invoker, so the existing own-row RLS on
-- customer_addresses still applies. They also filter on current_profile_id():
-- staff with customers.read can see other customers' addresses through RLS,
-- and these functions must only ever change the caller's own.

/* ---------- Caps ---------- */

-- Enforced by triggers, so a direct PostgREST insert can't go past them. The
-- advisory lock serialises concurrent inserts for one profile.
create or replace function public.enforce_customer_address_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('customer_addresses:' || new.user_id::text, 0));
  if (select count(*) from public.customer_addresses a where a.user_id = new.user_id) >= 10 then
    raise exception 'Address limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_customer_address_cap() from public, anon, authenticated;

create trigger customer_addresses_cap
  before insert on public.customer_addresses
  for each row execute function public.enforce_customer_address_cap();

create or replace function public.enforce_wishlist_cap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('wishlist_items:' || new.user_id::text, 0));
  if (select count(*) from public.wishlist_items w where w.user_id = new.user_id) >= 200 then
    raise exception 'Wishlist limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_wishlist_cap() from public, anon, authenticated;

create trigger wishlist_items_cap
  before insert on public.wishlist_items
  for each row execute function public.enforce_wishlist_cap();

/* ---------- Save (insert or update) ---------- */

-- Inserts when p_id is null, otherwise updates the caller's own address. The
-- address becomes the default when asked, or when the caller would otherwise
-- have no default (so the first address is always the default). The previous
-- default is cleared in the same transaction: the one-default unique index
-- makes a two-request swap fail. Hierarchy and ward are checked by the
-- existing validate trigger.
create or replace function public.account_save_address(
  p_id uuid,
  p_label text,
  p_recipient_name text,
  p_phone_e164 text,
  p_province_code text,
  p_district_code text,
  p_municipality_code text,
  p_ward integer,
  p_street_landmark text,
  p_postal_code text,
  p_make_default boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_label text := btrim(coalesce(p_label, ''));
  v_default boolean;
  v_id uuid;
begin
  if v_profile is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if char_length(v_label) not between 1 and 40 then
    raise exception 'Label must be 1-40 characters' using errcode = '22023';
  end if;
  if p_ward is null or p_ward not between 1 and 99 then
    raise exception 'Address hierarchy or ward is invalid' using errcode = '23514';
  end if;
  if p_id is not null and not exists (
    select 1 from public.customer_addresses a where a.id = p_id and a.user_id = v_profile
  ) then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;

  v_default := coalesce(p_make_default, false) or not exists (
    select 1 from public.customer_addresses a
    where a.user_id = v_profile and a.is_default and a.id is distinct from p_id
  );

  if v_default then
    update public.customer_addresses
    set is_default = false
    where user_id = v_profile and is_default and id is distinct from p_id;
  end if;

  if p_id is null then
    insert into public.customer_addresses (
      user_id, label, recipient_name, phone_e164, province_code, district_code,
      municipality_code, ward, street_landmark, postal_code, is_default
    ) values (
      v_profile, v_label, btrim(p_recipient_name), p_phone_e164, p_province_code, p_district_code,
      p_municipality_code, p_ward::smallint, btrim(p_street_landmark), nullif(btrim(coalesce(p_postal_code, '')), ''), v_default
    )
    returning id into v_id;
  else
    -- Coordinates stay as they were only while the municipality is unchanged.
    update public.customer_addresses a
    set label = v_label,
        recipient_name = btrim(p_recipient_name),
        phone_e164 = p_phone_e164,
        province_code = p_province_code,
        district_code = p_district_code,
        municipality_code = p_municipality_code,
        ward = p_ward::smallint,
        street_landmark = btrim(p_street_landmark),
        postal_code = nullif(btrim(coalesce(p_postal_code, '')), ''),
        latitude = case when a.municipality_code = p_municipality_code then a.latitude end,
        longitude = case when a.municipality_code = p_municipality_code then a.longitude end,
        is_default = v_default
    where a.id = p_id and a.user_id = v_profile
    returning a.id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.account_save_address(uuid, text, text, text, text, text, text, integer, text, text, boolean)
  from public, anon;
grant execute on function public.account_save_address(uuid, text, text, text, text, text, text, integer, text, text, boolean)
  to authenticated;

/* ---------- Default and delete ---------- */

create or replace function public.account_set_default_address(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
begin
  if v_profile is null or p_id is null or not exists (
    select 1 from public.customer_addresses a where a.id = p_id and a.user_id = v_profile
  ) then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;

  update public.customer_addresses
  set is_default = false
  where user_id = v_profile and is_default and id <> p_id;

  update public.customer_addresses
  set is_default = true
  where id = p_id and user_id = v_profile and not is_default;
end;
$$;

revoke execute on function public.account_set_default_address(uuid) from public, anon;
grant execute on function public.account_set_default_address(uuid) to authenticated;

-- Deleting the default promotes the most recently added remaining address,
-- so checkout keeps a prefill while any address is left.
create or replace function public.account_delete_address(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_was_default boolean;
begin
  delete from public.customer_addresses a
  where a.id = p_id and a.user_id = v_profile
  returning a.is_default into v_was_default;

  if v_was_default is null then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;

  if v_was_default then
    update public.customer_addresses
    set is_default = true
    where id = (
      select a.id from public.customer_addresses a
      where a.user_id = v_profile
      order by a.created_at desc, a.id desc
      limit 1
    );
  end if;
end;
$$;

revoke execute on function public.account_delete_address(uuid) from public, anon;
grant execute on function public.account_delete_address(uuid) to authenticated;
