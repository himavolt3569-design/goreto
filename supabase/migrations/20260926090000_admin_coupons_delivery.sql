-- Admin phase 3 (prompts/goreto-admin-coupons-delivery.md): create, edit and
-- delete coupons, couriers and their services, delivery zones and rates.
--
-- The existing RLS policies stay the enforcement for writes (coupons:
-- promotions.manage; delivery tables: delivery.manage). These triggers add
-- the rules no policy can express:
--
-- * A district belongs to at most one delivery zone, and every code is a
--   real district, so checkout always finds exactly one zone per address.
-- * A coupon's code and type are fixed once it has been used; past orders
--   show that code.
-- * Coupons, courier services and couriers that are part of order history
--   can't be deleted. Orders and shipments reference them ON DELETE SET NULL,
--   so without this a delete would silently cut the link.
--
-- The triggers are security definer so they see every order and shipment,
-- even when the caller (e.g. promotions.manage without orders.read) can't.
-- Validation errors are 22023 with DETAIL naming the form field.

/* ---------- One zone per district ---------- */

create or replace function public.delivery_zones_check_districts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unknown text;
  v_taken text;
begin
  -- Sorted and without duplicates, so the stored list is canonical.
  new.district_codes := coalesce(
    (select array_agg(distinct given.code order by given.code) from unnest(new.district_codes) as given(code)),
    '{}'
  );

  select string_agg(given.code, ', ' order by given.code) into v_unknown
  from unnest(new.district_codes) as given(code)
  where not exists (select 1 from public.nepal_districts d where d.code = given.code);
  if v_unknown is not null then
    raise exception 'Unknown district: %', v_unknown using errcode = '22023', detail = 'districtCodes';
  end if;

  -- Serialize zone district edits so two saves can't claim the same district.
  perform pg_advisory_xact_lock(hashtext('public.delivery_zones.district_codes'));

  select string_agg(d.name || ' (in ' || z.name || ')', ', ' order by d.name) into v_taken
  from public.delivery_zones z
  cross join lateral unnest(z.district_codes) as taken(code)
  join public.nepal_districts d on d.code = taken.code
  where z.id is distinct from new.id
    and taken.code = any (new.district_codes);
  if v_taken is not null then
    raise exception 'Already in another zone: %. Remove them from that zone first.', v_taken
      using errcode = '22023', detail = 'districtCodes';
  end if;

  return new;
end;
$$;

revoke execute on function public.delivery_zones_check_districts() from public, anon, authenticated;

create trigger delivery_zones_check_districts
  before insert or update of district_codes on public.delivery_zones
  for each row execute function public.delivery_zones_check_districts();

/* ---------- Coupons: fixed code once used, no delete once used ---------- */

-- "Used" means an order references the coupon. times_used is only a counter
-- (and the seed purge deletes orders before coupons).
create or replace function public.coupons_protect_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used boolean := exists (select 1 from public.orders o where o.coupon_id = old.id);
begin
  if tg_op = 'DELETE' then
    if v_used then
      raise exception 'Orders already used this coupon, so it can''t be deleted. Turn it off instead.'
        using errcode = '22023';
    end if;
    return old;
  end if;

  if (new.code is distinct from old.code or new.type is distinct from old.type) and v_used then
    raise exception 'Orders already used this coupon, so its code and discount type can''t change.'
      using errcode = '22023', detail = case when new.code is distinct from old.code then 'code' else 'type' end;
  end if;
  return new;
end;
$$;

revoke execute on function public.coupons_protect_history() from public, anon, authenticated;

create trigger coupons_protect_history
  before update of code, type or delete on public.coupons
  for each row execute function public.coupons_protect_history();

/* ---------- Courier services and couriers: no delete once in history ---------- */

create or replace function public.courier_services_protect_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.orders o where o.courier_service_id = old.id)
     or exists (select 1 from public.shipments s where s.courier_service_id = old.id) then
    raise exception 'Orders already used this service, so it can''t be deleted. Turn it off instead.'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

revoke execute on function public.courier_services_protect_history() from public, anon, authenticated;

create trigger courier_services_protect_history
  before delete on public.courier_services
  for each row execute function public.courier_services_protect_history();

create or replace function public.couriers_protect_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.courier_services cs where cs.courier_id = old.id) then
    raise exception 'This courier still has services. Delete them first, or turn the courier off.'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.shipments s where s.courier_id = old.id) then
    raise exception 'Shipments were assigned to this courier, so it can''t be deleted. Turn it off instead.'
      using errcode = '22023';
  end if;
  return old;
end;
$$;

revoke execute on function public.couriers_protect_history() from public, anon, authenticated;

create trigger couriers_protect_history
  before delete on public.couriers
  for each row execute function public.couriers_protect_history();

/* ---------- Order history counts for the editors ---------- */

-- The editors disable what the triggers above would refuse. Staff who manage
-- coupons or delivery may not have orders.read, so the counts come from
-- definer functions gated by the matching permission.

create or replace function public.admin_coupon_order_counts()
returns table (coupon_id uuid, order_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('promotions.manage') then
    raise exception 'promotions.manage required' using errcode = '42501';
  end if;
  return query
    select o.coupon_id, count(*) from public.orders o where o.coupon_id is not null group by o.coupon_id;
end;
$$;

revoke execute on function public.admin_coupon_order_counts() from public, anon;
grant execute on function public.admin_coupon_order_counts() to authenticated;

-- record_type 'courier_service': orders + shipments using the service;
-- 'courier': shipments assigned to the courier.
create or replace function public.admin_delivery_history_counts()
returns table (record_type text, record_id uuid, use_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('delivery.manage') then
    raise exception 'delivery.manage required' using errcode = '42501';
  end if;
  return query
    select 'courier_service'::text, used.id, count(*)
    from (
      select o.courier_service_id as id from public.orders o where o.courier_service_id is not null
      union all
      select s.courier_service_id from public.shipments s where s.courier_service_id is not null
    ) used
    group by used.id
    union all
    select 'courier'::text, s.courier_id, count(*)
    from public.shipments s
    where s.courier_id is not null
    group by s.courier_id;
end;
$$;

revoke execute on function public.admin_delivery_history_counts() from public, anon;
grant execute on function public.admin_delivery_history_counts() to authenticated;
