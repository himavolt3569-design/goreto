-- Daraz Express (DEX) bookings through the Daraz Logistics API (EPIS)
-- (prompts/goreto-daraz-courier.md). Additive: existing couriers, orders and
-- shipments are untouched. Secrets (app key/secret) stay in the environment;
-- these tables hold only the non-secret account values Daraz assigns.

/* ---------- Couriers booked through an API ---------- */

alter table public.couriers
  add column api_provider text check (api_provider is null or api_provider in ('daraz'));
alter table public.couriers
  add constraint couriers_api_provider_matches_mode
    check ((integration_mode = 'api') = (api_provider is not null));

/* ---------- Provider account settings (one row per provider) ---------- */

create table public.courier_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('daraz')),
  platform_name text check (platform_name is null or char_length(platform_name) between 1 and 100),
  external_seller_id text check (external_seller_id is null or char_length(external_seller_id) between 1 and 100),
  linked_at timestamptz,
  pickup_warehouse_code text check (pickup_warehouse_code is null or pickup_warehouse_code ~ '^[A-Za-z0-9_-]{1,64}$'),
  return_warehouse_code text check (return_warehouse_code is null or return_warehouse_code ~ '^[A-Za-z0-9_-]{1,64}$'),
  pickup_synced_at timestamptz,
  return_synced_at timestamptz,
  origin_name text check (origin_name is null or char_length(origin_name) between 1 and 120),
  origin_phone_e164 text check (origin_phone_e164 is null or origin_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  origin_email text check (origin_email is null or char_length(origin_email) <= 254),
  origin_address_details text check (origin_address_details is null or char_length(origin_address_details) between 1 and 300),
  origin_daraz_address_id text check (origin_daraz_address_id is null or origin_daraz_address_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  solution_codes text[] not null default '{}',
  default_delivery_option text not null default 'standard' check (default_delivery_option in ('standard', 'economy')),
  default_open_box boolean not null default false,
  undeliverable_option text not null default 'RETURN' check (undeliverable_option in ('RETURN', 'SCRAP')),
  default_length_cm numeric(6, 1) not null default 30 check (default_length_cm > 0 and default_length_cm <= 300),
  default_width_cm numeric(6, 1) not null default 20 check (default_width_cm > 0 and default_width_cm <= 300),
  default_height_cm numeric(6, 1) not null default 10 check (default_height_cm > 0 and default_height_cm <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(solution_codes) <= 20)
);

create trigger courier_provider_accounts_set_updated_at
  before update on public.courier_provider_accounts
  for each row execute function public.set_updated_at();

insert into public.courier_provider_accounts (provider) values ('daraz');

alter table public.courier_provider_accounts enable row level security;

create policy "courier_provider_accounts: staff read"
  on public.courier_provider_accounts for select to authenticated
  using ((select public.has_permission('delivery.manage')) or (select public.has_permission('orders.write')));

revoke all on public.courier_provider_accounts from anon, authenticated;
grant select on public.courier_provider_accounts to authenticated;
grant all on public.courier_provider_accounts to service_role;

/* ---------- Shipments booked with a provider ---------- */

alter table public.shipments
  add column provider text check (provider is null or provider in ('daraz')),
  add column provider_package_code text,
  add column provider_status text,
  add column provider_synced_at timestamptz,
  add column provider_needs_action boolean not null default false,
  add column provider_fee_paisa bigint check (provider_fee_paisa is null or provider_fee_paisa >= 0),
  add column last_mile_provider text,
  add column delivery_option text check (delivery_option is null or delivery_option in ('standard', 'economy')),
  add column package_weight_grams integer check (package_weight_grams is null or package_weight_grams between 1 and 100000),
  add column package_length_cm numeric(6, 1) check (package_length_cm is null or package_length_cm > 0),
  add column package_width_cm numeric(6, 1) check (package_width_cm is null or package_width_cm > 0),
  add column package_height_cm numeric(6, 1) check (package_height_cm is null or package_height_cm > 0),
  add column booked_at timestamptz,
  add column ready_to_ship_at timestamptz,
  add column provider_canceled_at timestamptz,
  add constraint shipments_provider_booking_complete
    check (provider_package_code is null or (provider is not null and booked_at is not null));

create unique index shipments_provider_package_code_idx on public.shipments (provider, provider_package_code)
  where provider_package_code is not null;
-- The sync job's queue: booked, not finished, least recently synced first.
create index shipments_provider_sync_idx on public.shipments (provider_synced_at nulls first)
  where provider_package_code is not null and status not in ('delivered', 'returned');

-- A live booking pins the courier: cancel it with Daraz before reassigning.
create or replace function public.shipments_guard_provider_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.provider_package_code is not null
     and new.provider_package_code is not distinct from old.provider_package_code
     and new.courier_id is distinct from old.courier_id then
    raise exception 'This order is booked with Daraz Express. Cancel the booking before changing the courier.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.shipments_guard_provider_booking() from public, anon, authenticated;

create trigger shipments_guard_provider_booking
  before update of courier_id on public.shipments
  for each row execute function public.shipments_guard_provider_booking();

-- Provider history is re-read many times; this key makes each event land once.
alter table public.shipment_events
  add column provider_event_key text check (provider_event_key is null or char_length(provider_event_key) <= 200);

create unique index shipment_events_provider_event_key_idx on public.shipment_events (shipment_id, provider_event_key)
  where provider_event_key is not null;

/* ---------- Canceling an order with a live booking ---------- */

-- Before pickup the parcel is still here: cancel the Daraz booking first, or
-- Daraz would still come to collect it. After pickup canceling is a return.
create or replace function public.orders_guard_provider_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'canceled' and old.status in ('confirmed', 'processing', 'packed') and exists (
    select 1 from public.shipments s
    where s.order_id = new.id and s.provider_package_code is not null and s.status = 'assigned'
  ) then
    raise exception 'Cancel the Daraz Express booking before canceling this order.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.orders_guard_provider_booking() from public, anon, authenticated;

create trigger orders_guard_provider_booking
  before update of status on public.orders
  for each row execute function public.orders_guard_provider_booking();

/* ---------- API call log (no payloads, no personal data) ---------- */

create table public.courier_api_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('daraz')),
  action text not null check (action ~ '^[a-z_]{1,40}$'),
  order_id uuid references public.orders (id) on delete set null,
  success boolean not null,
  error_code text check (error_code is null or char_length(error_code) <= 100),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  trace_id text check (trace_id is null or char_length(trace_id) <= 100),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index courier_api_log_order_idx on public.courier_api_log (order_id, created_at desc) where order_id is not null;
create index courier_api_log_created_idx on public.courier_api_log (created_at desc);
create index courier_api_log_actor_idx on public.courier_api_log (actor_id) where actor_id is not null;

alter table public.courier_api_log enable row level security;

create policy "courier_api_log: staff read"
  on public.courier_api_log for select to authenticated
  using ((select public.has_permission('orders.read')) or (select public.has_permission('delivery.manage')));

revoke all on public.courier_api_log from anon, authenticated;
grant select on public.courier_api_log to authenticated;
grant all on public.courier_api_log to service_role;

/* ---------- Webhook inbox (service role only) ---------- */

create table public.courier_webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('daraz')),
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  error text check (error is null or char_length(error) <= 500),
  unique (provider, body_sha256)
);

create index courier_webhook_inbox_pending_idx on public.courier_webhook_inbox (received_at)
  where processed_at is null;

alter table public.courier_webhook_inbox enable row level security;

revoke all on public.courier_webhook_inbox from anon, authenticated;
grant all on public.courier_webhook_inbox to service_role;

/* ---------- Daraz location ids for Nepal municipalities ---------- */

create table public.daraz_locations (
  municipality_code text primary key references public.nepal_municipalities (code) on delete cascade,
  daraz_address_id text not null check (daraz_address_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  daraz_city text check (daraz_city is null or char_length(daraz_city) <= 120),
  updated_at timestamptz not null default now()
);

alter table public.daraz_locations enable row level security;

create policy "daraz_locations: staff read"
  on public.daraz_locations for select to authenticated
  using ((select public.has_permission('orders.write')) or (select public.has_permission('delivery.manage')));

revoke all on public.daraz_locations from anon, authenticated;
grant select on public.daraz_locations to authenticated;
grant all on public.daraz_locations to service_role;

/* ---------- Notifications ---------- */

alter type public.notification_kind add value if not exists 'courier_attention';

/* ---------- Settings (delivery.manage) ---------- */

-- Only the listed keys change; absent keys keep their value. `mark_linked`,
-- `mark_pickup_synced` and `mark_return_synced` stamp the time after the
-- server action's Daraz call succeeded.
create or replace function public.admin_update_provider_account(p_provider text, p_patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unknown text;
begin
  if not public.has_permission('delivery.manage') then
    raise exception 'delivery.manage required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Invalid settings' using errcode = '22023';
  end if;

  select key into v_unknown
  from jsonb_object_keys(p_patch) as key
  where key not in (
    'platform_name', 'external_seller_id', 'pickup_warehouse_code', 'return_warehouse_code',
    'origin_name', 'origin_phone_e164', 'origin_email', 'origin_address_details', 'origin_daraz_address_id',
    'solution_codes', 'default_delivery_option', 'default_open_box', 'undeliverable_option',
    'default_length_cm', 'default_width_cm', 'default_height_cm',
    'mark_linked', 'mark_pickup_synced', 'mark_return_synced'
  )
  limit 1;
  if v_unknown is not null then
    raise exception 'Unknown setting %', v_unknown using errcode = '22023';
  end if;

  update public.courier_provider_accounts a
  set platform_name = case when p_patch ? 'platform_name' then nullif(btrim(p_patch ->> 'platform_name'), '') else a.platform_name end,
      external_seller_id = case when p_patch ? 'external_seller_id' then nullif(btrim(p_patch ->> 'external_seller_id'), '') else a.external_seller_id end,
      pickup_warehouse_code = case when p_patch ? 'pickup_warehouse_code' then nullif(btrim(p_patch ->> 'pickup_warehouse_code'), '') else a.pickup_warehouse_code end,
      return_warehouse_code = case when p_patch ? 'return_warehouse_code' then nullif(btrim(p_patch ->> 'return_warehouse_code'), '') else a.return_warehouse_code end,
      origin_name = case when p_patch ? 'origin_name' then nullif(btrim(p_patch ->> 'origin_name'), '') else a.origin_name end,
      origin_phone_e164 = case when p_patch ? 'origin_phone_e164' then nullif(btrim(p_patch ->> 'origin_phone_e164'), '') else a.origin_phone_e164 end,
      origin_email = case when p_patch ? 'origin_email' then nullif(btrim(p_patch ->> 'origin_email'), '') else a.origin_email end,
      origin_address_details = case when p_patch ? 'origin_address_details' then nullif(btrim(p_patch ->> 'origin_address_details'), '') else a.origin_address_details end,
      origin_daraz_address_id = case when p_patch ? 'origin_daraz_address_id' then nullif(btrim(p_patch ->> 'origin_daraz_address_id'), '') else a.origin_daraz_address_id end,
      solution_codes = case when p_patch ? 'solution_codes'
        then coalesce((select array_agg(btrim(code)) from jsonb_array_elements_text(p_patch -> 'solution_codes') code where btrim(code) <> ''), '{}')
        else a.solution_codes end,
      default_delivery_option = coalesce(p_patch ->> 'default_delivery_option', a.default_delivery_option),
      default_open_box = coalesce((p_patch ->> 'default_open_box')::boolean, a.default_open_box),
      undeliverable_option = coalesce(p_patch ->> 'undeliverable_option', a.undeliverable_option),
      default_length_cm = coalesce((p_patch ->> 'default_length_cm')::numeric, a.default_length_cm),
      default_width_cm = coalesce((p_patch ->> 'default_width_cm')::numeric, a.default_width_cm),
      default_height_cm = coalesce((p_patch ->> 'default_height_cm')::numeric, a.default_height_cm),
      linked_at = case when (p_patch ->> 'mark_linked')::boolean then now() else a.linked_at end,
      pickup_synced_at = case when (p_patch ->> 'mark_pickup_synced')::boolean then now() else a.pickup_synced_at end,
      return_synced_at = case when (p_patch ->> 'mark_return_synced')::boolean then now() else a.return_synced_at end
  where a.provider = p_provider;

  if not found then
    raise exception 'Unknown provider %', p_provider using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_provider_account(text, jsonb) from public, anon;
grant execute on function public.admin_update_provider_account(text, jsonb) to authenticated;

/* ---------- API log from staff actions ---------- */

create or replace function public.admin_log_courier_call(
  p_provider text,
  p_action text,
  p_order_id uuid,
  p_success boolean,
  p_error_code text,
  p_error_message text,
  p_trace_id text,
  p_duration_ms integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (public.has_permission('orders.write') or public.has_permission('delivery.manage')) then
    raise exception 'orders.write or delivery.manage required' using errcode = '42501';
  end if;
  insert into public.courier_api_log (provider, action, order_id, success, error_code, error_message, trace_id, duration_ms, actor_id)
  values (
    p_provider, p_action, p_order_id, p_success,
    left(p_error_code, 100), left(p_error_message, 500), left(p_trace_id, 100), p_duration_ms,
    public.current_profile_id()
  );
end;
$$;

revoke execute on function public.admin_log_courier_call(text, text, uuid, boolean, text, text, text, integer) from public, anon;
grant execute on function public.admin_log_courier_call(text, text, uuid, boolean, text, text, text, integer) to authenticated;

/* ---------- Booking (orders.write) ---------- */

-- The order's shipment when it can be booked with p_provider: accepted, not
-- shipped, assigned to a courier booked through that provider's API.
create or replace function public.provider_bookable_shipment(p_order_id uuid, p_provider text)
returns public.shipments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_api_provider text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmed', 'processing', 'packed') then
    raise exception 'Only accepted orders that haven''t shipped can be booked with the courier.' using errcode = '22023';
  end if;

  select * into v_shipment from public.shipments where order_id = p_order_id order by created_at limit 1 for update;
  if not found or v_shipment.courier_id is null then
    raise exception 'Assign a courier before booking.' using errcode = '22023';
  end if;

  select c.api_provider into v_api_provider from public.couriers c where c.id = v_shipment.courier_id;
  if v_api_provider is distinct from p_provider then
    raise exception 'This order''s courier isn''t booked through the % API.', p_provider using errcode = '22023';
  end if;
  return v_shipment;
end;
$$;

revoke execute on function public.provider_bookable_shipment(uuid, text) from public, anon, authenticated;

-- Saves a successful Daraz consignment. p_booking: package_code,
-- tracking_number, delivery_option, weight_grams, length_cm, width_cm,
-- height_cm, last_mile_provider, min_eta_ms, max_eta_ms.
create or replace function public.admin_record_provider_booking(p_order_id uuid, p_provider text, p_booking jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_package text := nullif(btrim(p_booking ->> 'package_code'), '');
  v_tracking text := nullif(upper(btrim(p_booking ->> 'tracking_number')), '');
  v_from date;
  v_to date;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  if v_package is null or v_tracking is null or char_length(v_package) > 100 or char_length(v_tracking) > 100 then
    raise exception 'The courier didn''t return a package code and tracking number.' using errcode = '22023';
  end if;

  v_shipment := public.provider_bookable_shipment(p_order_id, p_provider);

  if v_shipment.provider_package_code is not null then
    if v_shipment.provider_package_code = v_package then
      return; -- The same booking again (Daraz dedupes by order number).
    end if;
    raise exception 'This order already has a courier booking. Cancel it before booking again.' using errcode = '22023';
  end if;

  if (p_booking ->> 'min_eta_ms') ~ '^[0-9]{10,15}$' then
    v_from := (to_timestamp((p_booking ->> 'min_eta_ms')::bigint / 1000.0) at time zone 'Asia/Kathmandu')::date;
  end if;
  if (p_booking ->> 'max_eta_ms') ~ '^[0-9]{10,15}$' then
    v_to := (to_timestamp((p_booking ->> 'max_eta_ms')::bigint / 1000.0) at time zone 'Asia/Kathmandu')::date;
  end if;
  if v_from is not null and v_to is not null and v_to < v_from then
    v_to := v_from;
  end if;

  update public.shipments
  set provider = p_provider,
      provider_package_code = v_package,
      tracking_number = v_tracking,
      provider_status = null,
      provider_needs_action = false,
      provider_canceled_at = null,
      ready_to_ship_at = null,
      provider_synced_at = now(),
      booked_at = now(),
      delivery_option = p_booking ->> 'delivery_option',
      package_weight_grams = (p_booking ->> 'weight_grams')::integer,
      package_length_cm = (p_booking ->> 'length_cm')::numeric,
      package_width_cm = (p_booking ->> 'width_cm')::numeric,
      package_height_cm = (p_booking ->> 'height_cm')::numeric,
      last_mile_provider = left(nullif(btrim(p_booking ->> 'last_mile_provider'), ''), 100),
      estimated_delivery_from = coalesce(v_from, estimated_delivery_from),
      estimated_delivery_to = coalesce(v_to, estimated_delivery_to)
  where id = v_shipment.id;

  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (
    v_shipment.id, v_shipment.status,
    'Booked with Daraz Express. Tracking number ' || v_tracking || '.',
    'courier_api', now()
  );
end;
$$;

revoke execute on function public.admin_record_provider_booking(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_record_provider_booking(uuid, text, jsonb) to authenticated;

create or replace function public.admin_mark_provider_ready(p_order_id uuid, p_provider text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  v_shipment := public.provider_bookable_shipment(p_order_id, p_provider);
  if v_shipment.provider_package_code is null then
    raise exception 'Book the order with the courier first.' using errcode = '22023';
  end if;
  update public.shipments set ready_to_ship_at = coalesce(ready_to_ship_at, now()) where id = v_shipment.id;
end;
$$;

revoke execute on function public.admin_mark_provider_ready(uuid, text) from public, anon;
grant execute on function public.admin_mark_provider_ready(uuid, text) to authenticated;

-- After Daraz accepted the cancellation: the shipment can be rebooked or
-- given another courier. The customer sees that the booking was canceled.
create or replace function public.admin_clear_provider_booking(p_order_id uuid, p_provider text, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) > 300 then
    raise exception 'A cancellation reason (up to 300 characters) is required' using errcode = '22023';
  end if;
  v_shipment := public.provider_bookable_shipment(p_order_id, p_provider);
  if v_shipment.provider_package_code is null then
    return;
  end if;
  if v_shipment.status <> 'assigned' then
    raise exception 'The courier already has this parcel; it can''t be unbooked.' using errcode = '22023';
  end if;

  update public.shipments
  set provider_package_code = null,
      tracking_number = null,
      provider_status = null,
      provider_needs_action = false,
      ready_to_ship_at = null,
      provider_canceled_at = now()
  where id = v_shipment.id;

  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (v_shipment.id, v_shipment.status, 'Courier booking canceled. The store will arrange delivery again.', 'staff', now());
end;
$$;

revoke execute on function public.admin_clear_provider_booking(uuid, text, text) from public, anon;
grant execute on function public.admin_clear_provider_booking(uuid, text, text) to authenticated;

/* ---------- Applying provider history ---------- */

-- p_history (built by src/lib/courier/daraz/status-map.ts):
--   provider_status text, status shipment_status|null, fee_paisa int|null,
--   needs_action bool, last_mile_provider text|null,
--   events: [{ key, status (shipment_status|null), message, location, occurred_at }]
-- New events only (by key). The order only moves forward along legal steps;
-- failures and returns notify staff and never cancel anything.
create or replace function public.provider_history_core(p_shipment_id uuid, p_history jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_order public.orders%rowtype;
  v_event jsonb;
  v_status public.shipment_status;
  v_latest public.shipment_status := nullif(p_history ->> 'status', '')::public.shipment_status;
  v_latest_at timestamptz;
  v_running public.shipment_status;
  v_picked_up_at timestamptz;
  v_inserted integer := 0;
  v_rows integer;
  v_alert text;
begin
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found or v_shipment.provider_package_code is null then
    raise exception 'shipment not booked' using errcode = 'P0002';
  end if;
  select * into v_order from public.orders where id = v_shipment.order_id for update;
  v_running := v_shipment.status;

  for v_event in
    select value from jsonb_array_elements(coalesce(p_history -> 'events', '[]'::jsonb))
    order by (value ->> 'occurred_at')::timestamptz
  loop
    -- An unrecognised status keeps the status the parcel had at that point.
    v_status := coalesce(nullif(v_event ->> 'status', '')::public.shipment_status, v_running);
    v_running := v_status;
    if v_status in ('picked_up', 'in_transit', 'out_for_delivery', 'delivered') and v_picked_up_at is null then
      v_picked_up_at := (v_event ->> 'occurred_at')::timestamptz;
    end if;
    insert into public.shipment_events (shipment_id, status, message, location_label, source, occurred_at, provider_event_key)
    values (
      v_shipment.id,
      v_status,
      left(coalesce(nullif(btrim(v_event ->> 'message'), ''), 'Courier update'), 300),
      left(nullif(btrim(v_event ->> 'location'), ''), 120),
      'courier_api',
      (v_event ->> 'occurred_at')::timestamptz,
      left(v_event ->> 'key', 200)
    )
    on conflict (shipment_id, provider_event_key) where provider_event_key is not null do nothing;
    get diagnostics v_rows = row_count;
    v_inserted := v_inserted + v_rows;

    if v_rows > 0 and v_status in ('exception', 'returned') then
      v_alert := v_event ->> 'message';
    end if;
    if nullif(v_event ->> 'status', '') is not null then
      v_latest_at := (v_event ->> 'occurred_at')::timestamptz;
    end if;
  end loop;

  -- A delivered or returned parcel never goes back to an earlier state.
  if v_latest is not null and v_shipment.status in ('delivered', 'returned') then
    v_latest := v_shipment.status;
  end if;

  update public.shipments
  set status = coalesce(v_latest, status),
      delivered_at = case when v_latest = 'delivered' then coalesce(delivered_at, v_latest_at, now()) else delivered_at end,
      provider_status = left(coalesce(nullif(p_history ->> 'provider_status', ''), provider_status), 100),
      provider_fee_paisa = coalesce((p_history ->> 'fee_paisa')::bigint, provider_fee_paisa),
      provider_needs_action = coalesce((p_history ->> 'needs_action')::boolean, false),
      last_mile_provider = coalesce(left(nullif(btrim(p_history ->> 'last_mile_provider'), ''), 100), last_mile_provider),
      provider_synced_at = now()
  where id = v_shipment.id;

  if v_latest = 'delivered' and v_order.status in ('confirmed', 'processing', 'packed', 'shipped') then
    update public.orders
    set status = 'delivered',
        shipped_at = coalesce(shipped_at, v_picked_up_at, v_latest_at, now()),
        delivered_at = coalesce(v_latest_at, now()),
        payment_status = case when payment_status = 'pending' then 'collected' else payment_status end,
        payment_collected_at = case when payment_status = 'pending' then coalesce(v_latest_at, now()) else payment_collected_at end
    where id = v_order.id;
  elsif v_picked_up_at is not null and v_order.status in ('confirmed', 'processing', 'packed') then
    -- Once the courier has the parcel the order has shipped, whatever happened since.
    update public.orders set status = 'shipped', shipped_at = v_picked_up_at where id = v_order.id;
  end if;

  if v_alert is not null or ((p_history ->> 'needs_action')::boolean and not v_shipment.provider_needs_action) then
    insert into public.notifications (recipient_id, kind, order_id, title, body, href)
    select p.id, 'courier_attention', v_order.id,
           'Daraz: order #' || v_order.order_number || ' needs attention',
           left(coalesce(v_alert, 'Delivery attempt failed. Choose re-attempt or return.'), 500),
           '/admin/orders/' || v_order.order_number
    from public.profiles p
    where p.deleted_at is null
      and (
        p.role = 'owner'
        or (p.role = 'staff' and exists (
          select 1 from public.staff_permissions sp where sp.profile_id = p.id and sp.permission_key = 'orders.read'
        ))
      );
  end if;

  return jsonb_build_object('inserted', v_inserted, 'status', coalesce(v_latest, v_shipment.status));
end;
$$;

revoke execute on function public.provider_history_core(uuid, jsonb) from public, anon, authenticated;

-- Webhook and polling (no user session): service role only.
create or replace function public.courier_apply_provider_history(p_shipment_id uuid, p_history jsonb)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.provider_history_core(p_shipment_id, p_history)
$$;

revoke execute on function public.courier_apply_provider_history(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.courier_apply_provider_history(uuid, jsonb) to service_role;

-- Staff "Refresh tracking": the server action fetched the history from Daraz.
create or replace function public.admin_apply_provider_history(p_order_id uuid, p_history jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment_id uuid;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  select id into v_shipment_id
  from public.shipments
  where order_id = p_order_id and provider_package_code is not null
  order by created_at limit 1;
  if v_shipment_id is null then
    raise exception 'This order isn''t booked with a courier API.' using errcode = '22023';
  end if;
  return public.provider_history_core(v_shipment_id, p_history);
end;
$$;

revoke execute on function public.admin_apply_provider_history(uuid, jsonb) from public, anon;
grant execute on function public.admin_apply_provider_history(uuid, jsonb) to authenticated;

-- Courier-attention notifications are done once the parcel is delivered or
-- back with the store, or the order is canceled.
create or replace function public.resolve_courier_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('delivered', 'canceled') and new.status <> old.status then
    update public.notifications
    set read_at = now()
    where order_id = new.id and kind = 'courier_attention' and read_at is null;
  end if;
  return null;
end;
$$;

revoke execute on function public.resolve_courier_notifications() from public, anon, authenticated;

create trigger orders_resolve_courier_notifications
  after update of status on public.orders
  for each row execute function public.resolve_courier_notifications();
