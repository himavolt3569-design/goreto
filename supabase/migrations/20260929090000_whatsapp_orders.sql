-- WhatsApp orders, acceptance, auto-accept, admin notifications and the
-- courier handoff log (prompts/goreto-whatsapp-orders-courier-handoff.md,
-- worklog §4.0).
--
-- * Both channels create orders through one private core, create_order_core:
--   place_order (storefront) and admin_create_order (staff keying in a
--   WhatsApp order). Prices, stock, delivery and coupons stay in
--   checkout_price; the browser never sends money.
-- * Every order waits in pending_confirmation until someone with
--   orders.write accepts it (admin_accept_order), or the store's auto-accept
--   switch for that channel accepts it inside the same transaction. Accepting
--   assigns the courier. admin_transition_order no longer confirms pending
--   orders, so no order skips acceptance.
-- * A courier hears about an order only after acceptance: the courier handoff
--   (a wa.me link for now) is recorded by admin_record_courier_handoff, which
--   refuses unaccepted orders. The app records that staff opened the link, not
--   that WhatsApp delivered it.
-- * Notifications are one row per recipient (owner and orders.read staff),
--   written only by trusted functions and readable only by their recipient.
--
-- Nothing is granted implicitly (harden_grants).

/* ---------- Types ---------- */

create type public.order_channel as enum ('website', 'whatsapp');
create type public.order_acceptance as enum ('staff', 'auto');
create type public.courier_assignment_mode as enum ('auto', 'manual');
create type public.notification_kind as enum ('order_pending', 'order_auto_accepted');
create type public.courier_handoff_status as enum ('pending', 'sent', 'superseded');
create type public.courier_handoff_channel as enum ('whatsapp_link');

/* ---------- Orders ---------- */

alter table public.orders
  add column channel public.order_channel not null default 'website',
  add column whatsapp_e164 text
    check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  add column created_by uuid references public.profiles (id) on delete set null,
  add column accepted_at timestamptz,
  add column accepted_by uuid references public.profiles (id) on delete set null,
  add column accepted_via public.order_acceptance,
  add column canceled_by uuid references public.profiles (id) on delete set null;

-- WhatsApp customers often have no email; the storefront still requires one.
alter table public.orders alter column contact_email drop not null;
alter table public.orders
  add constraint orders_website_contact_email check (channel <> 'website' or contact_email is not null),
  add constraint orders_acceptance_recorded check ((accepted_at is null) = (accepted_via is null)),
  add constraint orders_auto_acceptance_has_no_person check (accepted_via is distinct from 'auto' or accepted_by is null);

-- Orders confirmed before acceptance was tracked: accepted then, by someone unrecorded.
update public.orders
set accepted_at = confirmed_at, accepted_via = 'staff'
where confirmed_at is not null and accepted_at is null;

create index orders_channel_created_idx on public.orders (channel, created_at desc);
create index orders_created_by_idx on public.orders (created_by) where created_by is not null;
create index orders_accepted_by_idx on public.orders (accepted_by) where accepted_by is not null;
create index orders_canceled_by_idx on public.orders (canceled_by) where canceled_by is not null;

/* ---------- Store settings and couriers ---------- */

alter table public.store_settings
  -- What happens when a person accepts: auto picks the courier by rule, manual asks.
  add column courier_assignment_mode public.courier_assignment_mode not null default 'manual',
  -- Fallback for the automatic rule when the purchased service's courier is inactive.
  add column default_courier_id uuid references public.couriers (id) on delete set null,
  add column auto_accept_website_orders boolean not null default false,
  add column auto_accept_whatsapp_orders boolean not null default false;

create index store_settings_default_courier_id_idx on public.store_settings (default_courier_id);

-- The courier's dispatch contact for order handoffs. A business contact, not a secret.
alter table public.couriers
  add column dispatch_whatsapp_e164 text
    check (dispatch_whatsapp_e164 is null or dispatch_whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$');

/* ---------- Notifications (one row per recipient) ---------- */

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  order_id uuid references public.orders (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 500),
  href text not null check (href ~ '^/admin(/|$)'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_order_id_idx on public.notifications (order_id);

alter table public.notifications enable row level security;

-- Losing orders.read hides old notifications too.
create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (
    recipient_id = (select public.current_profile_id())
    and (select public.has_permission('orders.read'))
  );
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (
    recipient_id = (select public.current_profile_id())
    and (select public.has_permission('orders.read'))
  )
  with check (
    recipient_id = (select public.current_profile_id())
    and (select public.has_permission('orders.read'))
  );

-- Written only by trusted functions; users may only change read_at.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Live bell (Supabase Realtime applies the same RLS). Absent outside Supabase.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

/* ---------- Courier handoff log ---------- */

create table public.courier_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  courier_id uuid references public.couriers (id) on delete set null,
  channel public.courier_handoff_channel not null default 'whatsapp_link',
  status public.courier_handoff_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  first_sent_at timestamptz,
  last_sent_at timestamptz,
  last_sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'sent' or (attempts > 0 and first_sent_at is not null and last_sent_at is not null)),
  check (status <> 'pending' or attempts = 0)
);

-- One live handoff per order; changing the courier supersedes it.
create unique index courier_handoffs_one_active_idx on public.courier_handoffs (order_id)
  where status <> 'superseded';
create index courier_handoffs_order_id_idx on public.courier_handoffs (order_id, created_at desc);
create index courier_handoffs_shipment_id_idx on public.courier_handoffs (shipment_id);
create index courier_handoffs_courier_id_idx on public.courier_handoffs (courier_id);
create index courier_handoffs_last_sent_by_idx on public.courier_handoffs (last_sent_by) where last_sent_by is not null;

create trigger courier_handoffs_set_updated_at
  before update on public.courier_handoffs
  for each row execute function public.set_updated_at();

alter table public.courier_handoffs enable row level security;

create policy "courier_handoffs: staff read"
  on public.courier_handoffs for select to authenticated
  using ((select public.has_permission('orders.read')));

grant select on public.courier_handoffs to authenticated;
grant all on public.courier_handoffs to service_role;

/* ---------- Automatic courier rule (private) ---------- */

-- The purchased service's courier when it is active, otherwise the store's
-- default courier when that is active, otherwise nothing.
create or replace function public.auto_courier_for_order(p_order_id uuid)
returns table (courier_id uuid, courier_name text, source text)
language sql
stable
security definer
set search_path = ''
as $$
  select choice.id, choice.name, choice.source
  from (
    select c.id, c.name, 'service'::text as source, 1 as rank
    from public.orders o
    join public.courier_services cs on cs.id = o.courier_service_id
    join public.couriers c on c.id = cs.courier_id and c.is_active
    where o.id = p_order_id
    union all
    select c.id, c.name, 'default'::text, 2
    from public.store_settings s
    join public.couriers c on c.id = s.default_courier_id and c.is_active
  ) choice
  order by choice.rank
  limit 1
$$;

revoke execute on function public.auto_courier_for_order(uuid) from public, anon, authenticated;

/* ---------- Accept (private core) ---------- */

-- Confirms a pending order and assigns its courier. Idempotent: an order that
-- was already accepted is returned unchanged. Callers check permissions.
create or replace function public.accept_order_core(
  p_order_id uuid,
  p_courier_id uuid,
  p_via public.order_acceptance,
  p_actor uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_courier public.couriers%rowtype;
  v_service_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status = 'canceled' then
    raise exception 'This order was rejected or canceled, so it can''t be accepted' using errcode = '22023';
  end if;
  if v_order.status <> 'pending_confirmation' then
    return jsonb_build_object('order_number', v_order.order_number, 'status', v_order.status, 'already_accepted', true);
  end if;

  select * into v_courier from public.couriers where id = p_courier_id and is_active;
  if not found then
    raise exception 'Choose an active courier' using errcode = '22023', detail = 'courierId';
  end if;

  -- Keep the purchased service when the chosen courier provides it (as admin_assign_courier does).
  select cs.id into v_service_id
  from public.courier_services cs
  where cs.id = v_order.courier_service_id and cs.courier_id = p_courier_id;

  update public.orders
  set status = 'confirmed',
      confirmed_at = now(),
      accepted_at = now(),
      accepted_by = case when p_via = 'staff' then p_actor end,
      accepted_via = p_via
  where id = p_order_id;

  select * into v_shipment
  from public.shipments where order_id = p_order_id order by created_at limit 1 for update;

  if not found then
    insert into public.shipments (order_id, courier_id, courier_service_id, status, assigned_at)
    values (p_order_id, p_courier_id, v_service_id, 'assigned', now())
    returning * into v_shipment;
  else
    update public.shipments
    set courier_id = p_courier_id,
        courier_service_id = v_service_id,
        status = 'assigned',
        assigned_at = now()
    where id = v_shipment.id;
  end if;

  -- Auto-accept runs in the same transaction as "Order placed" (stamped now()),
  -- so it takes clock_timestamp() to sort strictly after it.
  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (
    v_shipment.id,
    'assigned',
    'Order confirmed. Assigned to ' || v_courier.name || '.',
    case when p_via = 'auto' then 'system' else 'staff' end::public.shipment_event_source,
    case when p_via = 'auto' then clock_timestamp() else now() end
  );

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'status', 'confirmed',
    'already_accepted', false,
    'courier_id', v_courier.id,
    'courier_name', v_courier.name
  );
end;
$$;

revoke execute on function public.accept_order_core(uuid, uuid, public.order_acceptance, uuid) from public, anon, authenticated;

/* ---------- New-order notifications (private) ---------- */

-- One row for the owner and each active staff member with orders.read.
-- Called by create_order_core after any auto-accept, so the text matches the
-- order's real state. Direct inserts (seed loads) notify nobody.
create or replace function public.notify_new_order(p_order_id uuid, p_auto_accept text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_courier_name text;
  v_channel text;
  v_kind public.notification_kind;
  v_title text;
  v_body text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;

  v_channel := case v_order.channel when 'whatsapp' then 'WhatsApp' else 'website' end;

  if v_order.status = 'pending_confirmation' then
    v_kind := 'order_pending';
    v_title := 'New ' || v_channel || ' order #' || v_order.order_number;
    v_body := v_order.contact_name
      || case when p_auto_accept = 'no_courier'
           then '. Couldn''t auto-accept: no active courier matches. Accept it by hand.'
           else ''
         end;
  else
    select c.name into v_courier_name
    from public.shipments s join public.couriers c on c.id = s.courier_id
    where s.order_id = p_order_id order by s.created_at limit 1;

    v_kind := 'order_auto_accepted';
    v_title := 'Auto-accepted ' || v_channel || ' order #' || v_order.order_number;
    v_body := v_order.contact_name || '. Ready to send to ' || coalesce(v_courier_name, 'the courier') || '.';
  end if;

  insert into public.notifications (recipient_id, kind, order_id, title, body, href)
  select p.id, v_kind, v_order.id, v_title, v_body, '/admin/orders/' || v_order.order_number
  from public.profiles p
  where p.deleted_at is null
    and (
      p.role = 'owner'
      or (
        p.role = 'staff'
        and exists (
          select 1 from public.staff_permissions sp
          where sp.profile_id = p.id and sp.permission_key = 'orders.read'
        )
      )
    );
end;
$$;

revoke execute on function public.notify_new_order(uuid, text) from public, anon, authenticated;

-- Pending notifications are done once someone accepts or rejects the order;
-- "auto-accepted, ready to send" ones are done once it's canceled (or sent,
-- in admin_record_courier_handoff).
create or replace function public.resolve_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending_confirmation' and new.status <> old.status then
    update public.notifications
    set read_at = now()
    where order_id = new.id and kind = 'order_pending' and read_at is null;
  end if;
  if new.status = 'canceled' and old.status <> 'canceled' then
    update public.notifications
    set read_at = now()
    where order_id = new.id and kind = 'order_auto_accepted' and read_at is null;
  end if;
  return null;
end;
$$;

revoke execute on function public.resolve_order_notifications() from public, anon, authenticated;

create trigger orders_resolve_notifications
  after update of status on public.orders
  for each row execute function public.resolve_order_notifications();

/* ---------- Handoff follows the courier ---------- */

-- A courier assigned (or changed) on an accepted order needs to be told:
-- supersede the live handoff and open a pending one for the new courier.
create or replace function public.open_courier_handoff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.courier_id is null
     or (tg_op = 'UPDATE' and new.courier_id is not distinct from old.courier_id) then
    return null;
  end if;
  if not exists (
    select 1 from public.orders o
    where o.id = new.order_id and o.status in ('confirmed', 'processing', 'packed')
  ) then
    return null;
  end if;

  update public.courier_handoffs
  set status = 'superseded'
  where order_id = new.order_id and status <> 'superseded';

  insert into public.courier_handoffs (order_id, shipment_id, courier_id)
  values (new.order_id, new.id, new.courier_id);
  return null;
end;
$$;

revoke execute on function public.open_courier_handoff() from public, anon, authenticated;

create trigger shipments_open_courier_handoff
  after insert or update of courier_id on public.shipments
  for each row execute function public.open_courier_handoff();

/* ---------- Order core (private): both channels ---------- */

-- The former place_order body, plus the channel, the customer the order
-- belongs to (never inferred here), who keyed it in, and auto-accept.
create or replace function public.create_order_core(
  p_items jsonb,
  p_contact jsonb,
  p_address jsonb,
  p_courier_service_id uuid,
  p_coupon_code text,
  p_customer_note text,
  p_tracking_hash text,
  p_require_tracking_hash boolean,
  p_user_id uuid,
  p_channel public.order_channel,
  p_whatsapp_e164 text,
  p_created_by uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_contact ->> 'name', ''));
  v_email text := nullif(lower(btrim(coalesce(p_contact ->> 'email', ''))), '');
  v_phone text := btrim(coalesce(p_contact ->> 'phone_e164', ''));
  v_whatsapp text := nullif(btrim(coalesce(p_whatsapp_e164, '')), '');
  v_note text := nullif(btrim(coalesce(p_customer_note, '')), '');
  v_ward integer;
  v_street text := btrim(coalesce(p_address ->> 'street_landmark', ''));
  v_postal text := nullif(btrim(coalesce(p_address ->> 'postal_code', '')), '');
  v_lat numeric;
  v_lng numeric;
  v_municipality record;
  v_quote jsonb;
  v_problems jsonb;
  v_selected jsonb;
  v_coupon_id uuid;
  v_settings public.store_settings%rowtype;
  v_today date := (now() at time zone 'Asia/Kathmandu')::date;
  v_order_id uuid;
  v_order_number text;
  v_shipment_id uuid;
  v_attempt integer := 0;
  v_auto_accept boolean;
  v_auto_courier uuid;
  v_auto_result text;
  v_status public.order_status;
begin
  /* Contact. The server action already normalised phones with libphonenumber. */
  if char_length(v_name) not between 2 and 100
     or (v_email is null and p_channel = 'website')
     or (v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
     or v_phone !~ '^\+977[0-9]{8,10}$' then
    raise exception 'checkout:invalid_contact' using errcode = '22023';
  end if;
  if v_whatsapp is not null and v_whatsapp !~ '^\+977[0-9]{8,10}$' then
    raise exception 'checkout:invalid_contact' using errcode = '22023', detail = 'whatsapp';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'checkout:invalid_contact' using errcode = '22023', detail = 'note';
  end if;

  /* Address: the hierarchy must agree and the ward must exist. */
  begin
    v_ward := (p_address ->> 'ward')::integer;
    v_lat := (p_address ->> 'latitude')::numeric;
    v_lng := (p_address ->> 'longitude')::numeric;
  exception when others then
    raise exception 'checkout:invalid_address' using errcode = '22023';
  end;

  select m.code, m.name, m.ward_count, d.code as district_code, d.name as district_name,
         pr.code as province_code, pr.name as province_name
  into v_municipality
  from public.nepal_municipalities m
  join public.nepal_districts d on d.code = m.district_code
  join public.nepal_provinces pr on pr.code = d.province_code
  where m.code = p_address ->> 'municipality_code'
    and d.code = p_address ->> 'district_code'
    and pr.code = p_address ->> 'province_code';

  if not found
     or v_ward is null or v_ward not between 1 and v_municipality.ward_count
     or char_length(v_street) not between 2 and 200
     or (v_postal is not null and v_postal !~ '^[0-9]{5}$')
     or ((v_lat is null) <> (v_lng is null))
     or (v_lat is not null and (v_lat not between 26 and 31 or v_lng not between 80 and 89)) then
    raise exception 'checkout:invalid_address' using errcode = '22023';
  end if;

  if p_require_tracking_hash and coalesce(p_tracking_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'checkout:invalid_tracking' using errcode = '22023';
  end if;
  if p_tracking_hash is not null and p_tracking_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'checkout:invalid_tracking' using errcode = '22023';
  end if;

  select * into v_settings from public.store_settings limit 1;
  if not coalesce(v_settings.cod_enabled, false) then
    raise exception 'checkout:cod_disabled' using errcode = 'P0001';
  end if;

  /* Lock the variants (id order: no deadlocks) and the coupon, then price. */
  if jsonb_typeof(p_items) = 'array' then
    perform 1
    from public.product_variants v
    where v.id in (
      select (item ->> 'variant_id')::uuid
      from jsonb_array_elements(p_items) as t(item)
      where coalesce(item ->> 'variant_id', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    order by v.id
    for update;
  end if;

  if nullif(btrim(coalesce(p_coupon_code, '')), '') is not null then
    perform 1 from public.coupons c where c.code = upper(btrim(p_coupon_code)) for update;
  end if;

  v_quote := public.checkout_price(
    p_items, v_municipality.code, p_courier_service_id, p_coupon_code, v_email, p_user_id
  );

  select jsonb_agg(jsonb_build_object(
           'variant_id', line ->> 'variant_id',
           'status', line ->> 'status',
           'available_quantity', (line ->> 'available_quantity')::integer
         ))
  into v_problems
  from jsonb_array_elements(v_quote -> 'lines') as t(line)
  where line ->> 'status' <> 'ok';

  if v_problems is not null then
    raise exception 'checkout:stock_changed' using errcode = 'P0001', detail = v_problems::text;
  end if;

  v_selected := v_quote -> 'selected_delivery';
  if v_selected is null or jsonb_typeof(v_selected) <> 'object' then
    raise exception 'checkout:delivery_unavailable' using errcode = 'P0001';
  end if;

  if v_quote -> 'coupon' is not null and jsonb_typeof(v_quote -> 'coupon') = 'object' then
    if v_quote -> 'coupon' ? 'error' then
      raise exception 'checkout:coupon_invalid' using errcode = 'P0001',
        detail = (v_quote -> 'coupon')::text;
    end if;
    v_coupon_id := (v_quote -> 'coupon' ->> 'coupon_id')::uuid;
  end if;

  if v_settings.cod_max_order_paisa is not null
     and (v_quote ->> 'total_paisa')::bigint > v_settings.cod_max_order_paisa then
    raise exception 'checkout:cod_limit' using errcode = 'P0001',
      detail = jsonb_build_object('cod_max_order_paisa', v_settings.cod_max_order_paisa)::text;
  end if;

  /* Order number: prefix + Nepal date + 6 random digits, retried on collision. */
  loop
    v_attempt := v_attempt + 1;
    v_order_number := v_settings.order_number_prefix
      || to_char(now() at time zone 'Asia/Kathmandu', 'YYMMDD')
      || lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (select 1 from public.orders o where o.order_number = v_order_number);
    if v_attempt >= 10 then
      raise exception 'checkout:order_number' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.orders (
    order_number, user_id, contact_name, contact_email, contact_phone_e164,
    shipping_address, subtotal_paisa, discount_paisa, delivery_fee_paisa, total_paisa,
    courier_service_id, delivery_snapshot, coupon_id, coupon_code, customer_note,
    guest_tracking_hash, channel, whatsapp_e164, created_by
  )
  values (
    v_order_number,
    p_user_id,
    v_name,
    v_email,
    v_phone,
    jsonb_build_object(
      'recipient_name', v_name,
      'phone_e164', v_phone,
      'province_code', v_municipality.province_code,
      'province_name', v_municipality.province_name,
      'district_code', v_municipality.district_code,
      'district_name', v_municipality.district_name,
      'municipality_code', v_municipality.code,
      'municipality_name', v_municipality.name,
      'ward', v_ward,
      'street_landmark', v_street,
      'postal_code', v_postal,
      'latitude', v_lat,
      'longitude', v_lng
    ),
    (v_quote ->> 'subtotal_paisa')::bigint,
    (v_quote ->> 'discount_paisa')::bigint,
    (v_quote ->> 'delivery_fee_paisa')::bigint,
    (v_quote ->> 'total_paisa')::bigint,
    (v_selected ->> 'courier_service_id')::uuid,
    jsonb_build_object(
      'zone_id', v_quote -> 'zone' -> 'id',
      'zone_name', v_quote -> 'zone' -> 'name',
      'courier_id', v_selected -> 'courier_id',
      'courier_name', v_selected -> 'courier_name',
      'courier_service_id', v_selected -> 'courier_service_id',
      'service_name', v_selected -> 'service_name',
      'service_level', v_selected -> 'service_level',
      'price_paisa', v_selected -> 'price_paisa',
      'estimated_min_days', v_selected -> 'estimated_min_days',
      'estimated_max_days', v_selected -> 'estimated_max_days'
    ),
    v_coupon_id,
    case when v_coupon_id is null then null else v_quote -> 'coupon' ->> 'code' end,
    v_note,
    p_tracking_hash,
    p_channel,
    v_whatsapp,
    p_created_by
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, product_title, variant_title, sku, image_path,
    unit_price_paisa, quantity, line_total_paisa
  )
  select
    v_order_id,
    (line ->> 'product_id')::uuid,
    (line ->> 'variant_id')::uuid,
    line ->> 'product_title',
    line ->> 'variant_title',
    line ->> 'sku',
    line ->> 'image_path',
    (line ->> 'unit_price_paisa')::bigint,
    (line ->> 'quantity')::integer,
    (line ->> 'line_total_paisa')::bigint
  from jsonb_array_elements(v_quote -> 'lines') with ordinality as l(line, position)
  order by position;

  update public.product_variants v
  set stock_quantity = v.stock_quantity - (line ->> 'quantity')::integer
  from jsonb_array_elements(v_quote -> 'lines') as t(line)
  where v.id = (line ->> 'variant_id')::uuid;

  if v_coupon_id is not null then
    update public.coupons set times_used = times_used + 1 where id = v_coupon_id;
  end if;

  insert into public.shipments (
    order_id, courier_service_id, estimated_delivery_from, estimated_delivery_to
  )
  values (
    v_order_id,
    (v_selected ->> 'courier_service_id')::uuid,
    v_today + (v_selected ->> 'estimated_min_days')::integer,
    v_today + (v_selected ->> 'estimated_max_days')::integer
  )
  returning id into v_shipment_id;

  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (v_shipment_id, 'awaiting_assignment', 'Order placed. Cash on delivery.', 'system', now());

  /* Auto-accept: never fails the order; without a courier it waits for a person. */
  v_auto_accept := case p_channel
    when 'website' then v_settings.auto_accept_website_orders
    when 'whatsapp' then v_settings.auto_accept_whatsapp_orders
    else false
  end;
  if coalesce(v_auto_accept, false) then
    select a.courier_id into v_auto_courier from public.auto_courier_for_order(v_order_id) a;
    if v_auto_courier is not null then
      perform public.accept_order_core(v_order_id, v_auto_courier, 'auto', null);
      v_auto_result := 'accepted';
    else
      v_auto_result := 'no_courier';
    end if;
  end if;

  perform public.notify_new_order(v_order_id, v_auto_result);

  select o.status into v_status from public.orders o where o.id = v_order_id;
  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', v_status,
    'auto_accept', v_auto_result
  );
end;
$$;

revoke execute on function public.create_order_core(
  jsonb, jsonb, jsonb, uuid, text, text, text, boolean, uuid, public.order_channel, text, uuid
) from public, anon, authenticated;

/* ---------- Storefront checkout (same signature as before) ---------- */

create or replace function public.place_order(
  p_items jsonb,
  p_contact jsonb,
  p_address jsonb,
  p_courier_service_id uuid,
  p_coupon_code text,
  p_customer_note text,
  p_tracking_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_profile_id();
begin
  -- Guests reach their order only with the tracking secret, so they must send its hash.
  return public.create_order_core(
    p_items, p_contact, p_address, p_courier_service_id, p_coupon_code, p_customer_note,
    p_tracking_hash, v_profile_id is null,
    v_profile_id, 'website', null, null
  );
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text) to anon, authenticated;

/* ---------- Staff: WhatsApp order entry ---------- */

-- The order belongs to the linked customer (or nobody), never to the staff
-- member keying it in. Linking a customer needs customers.read.
create or replace function public.admin_assert_linkable_customer(p_customer_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_customer_id is null then
    return;
  end if;
  if not public.has_permission('customers.read') then
    raise exception 'customers.read required to link a customer' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_customer_id and p.role = 'customer' and p.deleted_at is null
  ) then
    raise exception 'That customer account isn''t available. Search again or leave it unlinked.'
      using errcode = '22023', detail = 'customerId';
  end if;
end;
$$;

revoke execute on function public.admin_assert_linkable_customer(uuid) from public, anon, authenticated;

create or replace function public.admin_order_quote(
  p_items jsonb,
  p_municipality_code text default null,
  p_courier_service_id uuid default null,
  p_coupon_code text default null,
  p_contact_email text default null,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  perform public.admin_assert_linkable_customer(p_customer_id);
  return public.checkout_price(
    p_items, p_municipality_code, p_courier_service_id, p_coupon_code, p_contact_email, p_customer_id
  );
end;
$$;

revoke execute on function public.admin_order_quote(jsonb, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.admin_order_quote(jsonb, text, uuid, text, text, uuid) to authenticated;

create or replace function public.admin_create_order(
  p_items jsonb,
  p_contact jsonb,
  p_address jsonb,
  p_courier_service_id uuid,
  p_coupon_code text,
  p_customer_note text,
  p_customer_id uuid,
  p_whatsapp_e164 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  perform public.admin_assert_linkable_customer(p_customer_id);
  return public.create_order_core(
    p_items, p_contact, p_address, p_courier_service_id, p_coupon_code, p_customer_note,
    null, false,
    p_customer_id, 'whatsapp', p_whatsapp_e164, public.current_profile_id()
  );
end;
$$;

revoke execute on function public.admin_create_order(jsonb, jsonb, jsonb, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.admin_create_order(jsonb, jsonb, jsonb, uuid, text, text, uuid, text) to authenticated;

/* ---------- Staff: accept ---------- */

-- What Accept would do right now: the store's mode and the courier the
-- automatic rule picks (null when nothing matches).
create or replace function public.admin_accept_preview(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mode public.courier_assignment_mode;
  v_courier_id uuid;
  v_courier_name text;
  v_source text;
begin
  if not public.has_permission('orders.read') then
    raise exception 'orders.read required' using errcode = '42501';
  end if;
  select s.courier_assignment_mode into v_mode from public.store_settings s limit 1;
  select a.courier_id, a.courier_name, a.source into v_courier_id, v_courier_name, v_source
  from public.auto_courier_for_order(p_order_id) a;
  return jsonb_build_object(
    'mode', coalesce(v_mode, 'manual'),
    'courier_id', v_courier_id,
    'courier_name', v_courier_name,
    'source', v_source
  );
end;
$$;

revoke execute on function public.admin_accept_preview(uuid) from public, anon;
grant execute on function public.admin_accept_preview(uuid) to authenticated;

create or replace function public.admin_accept_order(p_order_id uuid, p_courier_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_mode public.courier_assignment_mode;
  v_courier_id uuid := p_courier_id;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  -- Already accepted or canceled: the core returns or refuses without changes.
  if v_order.status = 'pending_confirmation' and v_courier_id is null then
    select s.courier_assignment_mode into v_mode from public.store_settings s limit 1;
    if coalesce(v_mode, 'manual') = 'auto' then
      select a.courier_id into v_courier_id from public.auto_courier_for_order(p_order_id) a;
    end if;
    if v_courier_id is null then
      raise exception 'Choose a courier to accept this order' using errcode = '22023', detail = 'courierId';
    end if;
  end if;

  return public.accept_order_core(p_order_id, v_courier_id, 'staff', public.current_profile_id());
end;
$$;

revoke execute on function public.admin_accept_order(uuid, uuid) from public, anon;
grant execute on function public.admin_accept_order(uuid, uuid) to authenticated;

/* ---------- Staff: courier handoff ---------- */

-- Records that staff opened the courier's WhatsApp link. Only accepted orders
-- that haven't shipped, with a courier. The first send adds one tracking
-- event; resends only count attempts, so retrying is always safe.
create or replace function public.admin_record_courier_handoff(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_courier public.couriers%rowtype;
  v_handoff public.courier_handoffs%rowtype;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmed', 'processing', 'packed') then
    raise exception 'Orders go to the courier only after they are accepted, and before they ship'
      using errcode = '22023';
  end if;

  select * into v_shipment
  from public.shipments where order_id = p_order_id order by created_at limit 1;
  if v_shipment.courier_id is null then
    raise exception 'Assign a courier first' using errcode = '22023';
  end if;
  select * into v_courier from public.couriers where id = v_shipment.courier_id;

  select * into v_handoff
  from public.courier_handoffs
  where order_id = p_order_id and status <> 'superseded'
  for update;

  if v_handoff.id is null or v_handoff.courier_id is distinct from v_shipment.courier_id then
    update public.courier_handoffs set status = 'superseded'
    where order_id = p_order_id and status <> 'superseded';
    insert into public.courier_handoffs (order_id, shipment_id, courier_id)
    values (p_order_id, v_shipment.id, v_shipment.courier_id)
    returning * into v_handoff;
  end if;

  update public.courier_handoffs
  set status = 'sent',
      attempts = attempts + 1,
      first_sent_at = coalesce(first_sent_at, now()),
      last_sent_at = now(),
      last_sent_by = public.current_profile_id()
  where id = v_handoff.id
  returning * into v_handoff;

  if v_handoff.attempts = 1 then
    insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
    values (v_shipment.id, 'assigned', 'Order details sent to ' || v_courier.name || '.', 'staff', now());

    update public.notifications
    set read_at = now()
    where order_id = p_order_id and kind = 'order_auto_accepted' and read_at is null;
  end if;

  return jsonb_build_object(
    'attempts', v_handoff.attempts,
    'first_sent_at', v_handoff.first_sent_at,
    'last_sent_at', v_handoff.last_sent_at
  );
end;
$$;

revoke execute on function public.admin_record_courier_handoff(uuid) from public, anon;
grant execute on function public.admin_record_courier_handoff(uuid) to authenticated;

/* ---------- Staff names for audit fields ---------- */

-- "Accepted by", "Entered by", "Sent by": staff without customers.read can't
-- read profiles, so names of owner/staff profiles come from here. Customers'
-- names are never returned.
create or replace function public.admin_staff_names(p_ids uuid[])
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.clerk_user_id = (select auth.jwt() ->> 'sub')
      and p.deleted_at is null
      and p.role in ('owner', 'staff')
  ) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) > 100 then
    raise exception 'too many ids' using errcode = '22023';
  end if;

  return query
  select p.id, coalesce(nullif(p.full_name, ''), p.email, 'Staff member')
  from public.profiles p
  where p.id = any (p_ids) and p.role in ('owner', 'staff');
end;
$$;

revoke execute on function public.admin_staff_names(uuid[]) from public, anon;
grant execute on function public.admin_staff_names(uuid[]) to authenticated;

/* ---------- Order status transitions (recreated) ---------- */

-- pending_confirmation -> canceled (reject); confirming goes through Accept
-- confirmed            -> processing | canceled
-- processing           -> packed | canceled
-- packed               -> shipped (courier assigned) | canceled
-- shipped              -> delivered | canceled (returned to store)
-- delivered, canceled  -> terminal
--
-- Delivering records COD collection (cash is taken at the door). Canceling
-- marks payment failed, records who canceled, and restocks the variants.
create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_status public.order_status,
  p_reason text
)
returns public.order_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_courier_name text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_allowed boolean;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  if v_order.status = 'pending_confirmation' and p_status = 'confirmed' then
    raise exception 'Use Accept to confirm a pending order: accepting assigns its courier'
      using errcode = '22023';
  end if;

  v_allowed := case v_order.status
    when 'pending_confirmation' then p_status = 'canceled'
    when 'confirmed' then p_status in ('processing', 'canceled')
    when 'processing' then p_status in ('packed', 'canceled')
    when 'packed' then p_status in ('shipped', 'canceled')
    when 'shipped' then p_status in ('delivered', 'canceled')
    else false
  end;
  if not v_allowed then
    raise exception 'An order that is % cannot be moved to %', v_order.status, p_status
      using errcode = '22023';
  end if;

  if p_status = 'canceled' and (v_reason is null or char_length(v_reason) > 300) then
    raise exception 'A cancellation reason (up to 300 characters) is required' using errcode = '22023';
  end if;

  select * into v_shipment
  from public.shipments
  where order_id = p_order_id
  order by created_at
  limit 1
  for update;

  if not found then
    insert into public.shipments (order_id, courier_service_id)
    values (p_order_id, v_order.courier_service_id)
    returning * into v_shipment;
  end if;

  select c.name into v_courier_name from public.couriers c where c.id = v_shipment.courier_id;

  case p_status
    when 'processing' then
      update public.orders set status = p_status where id = p_order_id;

    when 'packed' then
      update public.orders set status = p_status, packed_at = now() where id = p_order_id;

    when 'shipped' then
      if v_shipment.courier_id is null then
        raise exception 'Assign a courier before marking the order shipped' using errcode = '22023';
      end if;
      update public.orders set status = p_status, shipped_at = now() where id = p_order_id;
      update public.shipments set status = 'picked_up' where id = v_shipment.id;
      insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
      values (v_shipment.id, 'picked_up', 'Picked up by ' || v_courier_name || '.', 'staff', now());

    when 'delivered' then
      update public.orders
      set status = p_status,
          delivered_at = now(),
          payment_status = 'collected',
          payment_collected_at = now()
      where id = p_order_id;
      update public.shipments set status = 'delivered', delivered_at = now() where id = v_shipment.id;
      insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
      values (v_shipment.id, 'delivered', 'Delivered. Cash on delivery collected.', 'staff', now());

    when 'canceled' then
      update public.orders
      set status = p_status,
          canceled_at = now(),
          canceled_by = public.current_profile_id(),
          cancellation_reason = v_reason,
          payment_status = case when payment_status = 'pending' then 'failed' else payment_status end
      where id = p_order_id;

      if v_order.status = 'shipped' then
        update public.shipments set status = 'returned' where id = v_shipment.id;
        insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
        values (v_shipment.id, 'returned', 'Returned to the store: ' || v_reason, 'staff', now());
      end if;

      -- The goods never left, or have come back: put them back on sale.
      update public.product_variants v
      set stock_quantity = v.stock_quantity + i.quantity
      from (
        select oi.variant_id, sum(oi.quantity)::integer as quantity
        from public.order_items oi
        where oi.order_id = p_order_id and oi.variant_id is not null
        group by oi.variant_id
      ) i
      where v.id = i.variant_id;

    else
      raise exception 'Unsupported status %', p_status using errcode = '22023';
  end case;

  return p_status;
end;
$$;

revoke execute on function public.admin_transition_order(uuid, public.order_status, text) from public, anon;
grant execute on function public.admin_transition_order(uuid, public.order_status, text) to authenticated;
