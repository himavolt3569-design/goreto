-- Daraz Express operations (prompts/goreto-daraz-courier.md, docs/couriers/daraz.md):
-- rebooking references, guards, delivery options and fees, receiver updates,
-- failed-delivery decisions, COD settlements, support cases, the dashboard
-- overview, and the WhatsApp handoff marked sent when Daraz is booked.
-- Additive on top of 20261007090000_daraz_courier.

/* ---------- Guard: a live booking pins the courier and its tracking number ---------- */

-- admin_assign_courier rewrites tracking_number even for the same courier;
-- the booking path changes both together with provider_package_code.
create or replace function public.shipments_guard_provider_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.provider_package_code is not null
     and new.provider_package_code is not distinct from old.provider_package_code
     and (new.courier_id is distinct from old.courier_id or new.tracking_number is distinct from old.tracking_number) then
    raise exception 'This order is booked with Daraz Express. Cancel the booking before changing the courier or tracking number.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.shipments_guard_provider_booking() from public, anon, authenticated;

drop trigger if exists shipments_guard_provider_booking on public.shipments;
create trigger shipments_guard_provider_booking
  before update of courier_id, tracking_number on public.shipments
  for each row execute function public.shipments_guard_provider_booking();

/* ---------- Shipments: booking details customers may see ---------- */

alter table public.shipments
  add column provider_reference text check (provider_reference is null or provider_reference ~ '^[A-Za-z0-9_-]{1,64}$'),
  add column provider_booking_attempts integer not null default 0 check (provider_booking_attempts >= 0),
  add column first_mile_type text check (first_mile_type is null or char_length(first_mile_type) <= 40),
  add column pickup_cutoff_at timestamptz,
  add column awb_printed_at timestamptz,
  add column provider_receiver jsonb check (provider_receiver is null or jsonb_typeof(provider_receiver) = 'object');

/* ---------- Courier money is staff-only (customers can read their shipment rows) ---------- */

create table public.courier_remittances (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('daraz')),
  reference text not null check (char_length(reference) between 1 and 100),
  statement_date date not null,
  gross_paisa bigint not null check (gross_paisa >= 0),
  deductions_paisa bigint not null default 0 check (deductions_paisa >= 0),
  net_paisa bigint generated always as (gross_paisa - deductions_paisa) stored,
  expected_paisa bigint not null check (expected_paisa >= 0),
  parcel_count integer not null check (parcel_count > 0),
  note text check (note is null or char_length(note) <= 500),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (provider, reference)
);

create index courier_remittances_statement_idx on public.courier_remittances (provider, statement_date desc);
create index courier_remittances_recorded_by_idx on public.courier_remittances (recorded_by) where recorded_by is not null;

create table public.shipment_courier_finance (
  shipment_id uuid primary key references public.shipments (id) on delete cascade,
  estimated_fee_paisa bigint check (estimated_fee_paisa is null or estimated_fee_paisa >= 0),
  actual_fee_paisa bigint check (actual_fee_paisa is null or actual_fee_paisa >= 0),
  cod_remittance_id uuid references public.courier_remittances (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index shipment_courier_finance_remittance_idx on public.shipment_courier_finance (cod_remittance_id)
  where cod_remittance_id is not null;

create trigger shipment_courier_finance_set_updated_at
  before update on public.shipment_courier_finance
  for each row execute function public.set_updated_at();

-- The fee column from the first Daraz migration moves here.
insert into public.shipment_courier_finance (shipment_id, actual_fee_paisa)
select id, provider_fee_paisa from public.shipments where provider_fee_paisa is not null;
alter table public.shipments drop column provider_fee_paisa;

alter table public.courier_remittances enable row level security;
alter table public.shipment_courier_finance enable row level security;

create policy "courier_remittances: staff read"
  on public.courier_remittances for select to authenticated
  using ((select public.has_permission('orders.read')));
create policy "shipment_courier_finance: staff read"
  on public.shipment_courier_finance for select to authenticated
  using ((select public.has_permission('orders.read')));

revoke all on public.courier_remittances, public.shipment_courier_finance from anon, authenticated;
grant select on public.courier_remittances, public.shipment_courier_finance to authenticated;
grant all on public.courier_remittances, public.shipment_courier_finance to service_role;

/* ---------- Couriers and services ---------- */

alter table public.couriers
  add column tracking_url_template text check (
    tracking_url_template is null
    or (tracking_url_template ~ '^https://[^\s]+$' and position('{tracking}' in tracking_url_template) > 0 and char_length(tracking_url_template) <= 300)
  );

alter table public.courier_services
  add column provider_option text check (provider_option is null or provider_option in ('standard', 'economy'));

/* ---------- Provider settings ---------- */

alter table public.courier_provider_accounts
  add column booking_endpoint text not null default 'create' check (booking_endpoint in ('create', 'consign')),
  add column phone_format text not null default 'national' check (phone_format in ('national', 'e164')),
  add column declare_insurance boolean not null default false,
  add column default_item_category text check (default_item_category is null or char_length(default_item_category) between 1 and 60),
  add column origin_latitude numeric(9, 6) check (origin_latitude is null or origin_latitude between -90 and 90),
  add column origin_longitude numeric(9, 6) check (origin_longitude is null or origin_longitude between -180 and 180),
  add column box_presets jsonb not null default
    '[{"name":"Small","length_cm":20,"width_cm":15,"height_cm":5},{"name":"Medium","length_cm":30,"width_cm":20,"height_cm":10},{"name":"Large","length_cm":40,"width_cm":30,"height_cm":15}]'::jsonb
    check (jsonb_typeof(box_presets) = 'array' and jsonb_array_length(box_presets) <= 10),
  add column auto_book boolean not null default false,
  add column xspace_case_template_id bigint check (xspace_case_template_id is null or xspace_case_template_id > 0),
  add column xspace_category_id text check (xspace_category_id is null or char_length(xspace_category_id) <= 60),
  add constraint courier_provider_accounts_origin_point check ((origin_latitude is null) = (origin_longitude is null));

-- Only the listed keys change; absent keys keep their value. `mark_*` stamp
-- the time after the server action's Daraz call succeeded.
create or replace function public.admin_update_provider_account(p_provider text, p_patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unknown text;
  v_box jsonb;
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
    'origin_latitude', 'origin_longitude',
    'solution_codes', 'default_delivery_option', 'default_open_box', 'undeliverable_option',
    'default_length_cm', 'default_width_cm', 'default_height_cm',
    'booking_endpoint', 'phone_format', 'declare_insurance', 'default_item_category',
    'box_presets', 'auto_book', 'xspace_case_template_id', 'xspace_category_id',
    'mark_linked', 'mark_pickup_synced', 'mark_return_synced'
  )
  limit 1;
  if v_unknown is not null then
    raise exception 'Unknown setting %', v_unknown using errcode = '22023';
  end if;

  if p_patch ? 'box_presets' then
    if jsonb_typeof(p_patch -> 'box_presets') <> 'array' then
      raise exception 'Box sizes must be a list' using errcode = '22023', detail = 'box_presets';
    end if;
    for v_box in select value from jsonb_array_elements(p_patch -> 'box_presets') loop
      if jsonb_typeof(v_box) <> 'object'
         or char_length(coalesce(v_box ->> 'name', '')) not between 1 and 40
         or coalesce((v_box ->> 'length_cm')::numeric, 0) not between 1 and 300
         or coalesce((v_box ->> 'width_cm')::numeric, 0) not between 1 and 300
         or coalesce((v_box ->> 'height_cm')::numeric, 0) not between 1 and 300 then
        raise exception 'Each box needs a name and sizes from 1 to 300 cm' using errcode = '22023', detail = 'box_presets';
      end if;
    end loop;
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
      origin_latitude = case when p_patch ? 'origin_latitude' then (p_patch ->> 'origin_latitude')::numeric else a.origin_latitude end,
      origin_longitude = case when p_patch ? 'origin_longitude' then (p_patch ->> 'origin_longitude')::numeric else a.origin_longitude end,
      solution_codes = case when p_patch ? 'solution_codes'
        then coalesce((select array_agg(btrim(code)) from jsonb_array_elements_text(p_patch -> 'solution_codes') code where btrim(code) <> ''), '{}')
        else a.solution_codes end,
      default_delivery_option = coalesce(p_patch ->> 'default_delivery_option', a.default_delivery_option),
      default_open_box = coalesce((p_patch ->> 'default_open_box')::boolean, a.default_open_box),
      undeliverable_option = coalesce(p_patch ->> 'undeliverable_option', a.undeliverable_option),
      default_length_cm = coalesce((p_patch ->> 'default_length_cm')::numeric, a.default_length_cm),
      default_width_cm = coalesce((p_patch ->> 'default_width_cm')::numeric, a.default_width_cm),
      default_height_cm = coalesce((p_patch ->> 'default_height_cm')::numeric, a.default_height_cm),
      booking_endpoint = coalesce(p_patch ->> 'booking_endpoint', a.booking_endpoint),
      phone_format = coalesce(p_patch ->> 'phone_format', a.phone_format),
      declare_insurance = coalesce((p_patch ->> 'declare_insurance')::boolean, a.declare_insurance),
      default_item_category = case when p_patch ? 'default_item_category' then nullif(btrim(p_patch ->> 'default_item_category'), '') else a.default_item_category end,
      box_presets = coalesce(p_patch -> 'box_presets', a.box_presets),
      auto_book = coalesce((p_patch ->> 'auto_book')::boolean, a.auto_book),
      xspace_case_template_id = case when p_patch ? 'xspace_case_template_id' then (p_patch ->> 'xspace_case_template_id')::bigint else a.xspace_case_template_id end,
      xspace_category_id = case when p_patch ? 'xspace_category_id' then nullif(btrim(p_patch ->> 'xspace_category_id'), '') else a.xspace_category_id end,
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

/* ---------- Booking: references, fees, and the courier handoff ---------- */

alter type public.courier_handoff_channel add value if not exists 'daraz_api';

-- The reference Daraz dedupes on (externalOrderId): the order number for the
-- first booking, "<order>-R<n>" after a cancellation.
create or replace function public.admin_provider_booking_reference(p_order_id uuid, p_provider text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_order_number text;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  v_shipment := public.provider_bookable_shipment(p_order_id, p_provider);
  if v_shipment.provider_package_code is not null then
    return v_shipment.provider_reference;
  end if;
  select order_number into v_order_number from public.orders where id = p_order_id;
  return case when v_shipment.provider_booking_attempts = 0 then v_order_number
              else v_order_number || '-R' || (v_shipment.provider_booking_attempts + 1) end;
end;
$$;

revoke execute on function public.admin_provider_booking_reference(uuid, text) from public, anon;
grant execute on function public.admin_provider_booking_reference(uuid, text) to authenticated;

-- Saves a successful Daraz booking. p_booking: package_code, tracking_number,
-- reference, delivery_option, weight_grams, length_cm, width_cm, height_cm,
-- last_mile_provider, min_eta_ms, max_eta_ms, estimated_fee_paisa,
-- first_mile_type, pickup_cutoff_ms.
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
  v_reference text := nullif(btrim(p_booking ->> 'reference'), '');
  v_from date;
  v_to date;
  v_cutoff timestamptz;
  v_profile uuid := public.current_profile_id();
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
      return; -- The same booking again (Daraz dedupes by reference).
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
  if (p_booking ->> 'pickup_cutoff_ms') ~ '^[0-9]{10,15}$' then
    v_cutoff := to_timestamp((p_booking ->> 'pickup_cutoff_ms')::bigint / 1000.0);
  end if;

  update public.shipments
  set provider = p_provider,
      provider_package_code = v_package,
      tracking_number = v_tracking,
      provider_reference = v_reference,
      provider_booking_attempts = provider_booking_attempts + 1,
      provider_status = null,
      provider_needs_action = false,
      provider_canceled_at = null,
      ready_to_ship_at = null,
      awb_printed_at = null,
      provider_receiver = null,
      provider_synced_at = now(),
      booked_at = now(),
      delivery_option = p_booking ->> 'delivery_option',
      package_weight_grams = (p_booking ->> 'weight_grams')::integer,
      package_length_cm = (p_booking ->> 'length_cm')::numeric,
      package_width_cm = (p_booking ->> 'width_cm')::numeric,
      package_height_cm = (p_booking ->> 'height_cm')::numeric,
      last_mile_provider = left(nullif(btrim(p_booking ->> 'last_mile_provider'), ''), 100),
      first_mile_type = left(nullif(btrim(p_booking ->> 'first_mile_type'), ''), 40),
      pickup_cutoff_at = v_cutoff,
      estimated_delivery_from = coalesce(v_from, estimated_delivery_from),
      estimated_delivery_to = coalesce(v_to, estimated_delivery_to)
  where id = v_shipment.id;

  insert into public.shipment_courier_finance (shipment_id, estimated_fee_paisa)
  values (v_shipment.id, (p_booking ->> 'estimated_fee_paisa')::bigint)
  on conflict (shipment_id) do update
    set estimated_fee_paisa = excluded.estimated_fee_paisa, actual_fee_paisa = null;

  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (
    v_shipment.id, v_shipment.status,
    'Booked with Daraz Express. Tracking number ' || v_tracking || '.',
    'courier_api', now()
  );

  -- The courier has the order now: the WhatsApp handoff is done, through the API.
  update public.courier_handoffs
  set status = 'sent',
      channel = 'daraz_api',
      attempts = attempts + 1,
      first_sent_at = coalesce(first_sent_at, now()),
      last_sent_at = now(),
      last_sent_by = v_profile
  where order_id = p_order_id and status <> 'superseded';
  if not found then
    insert into public.courier_handoffs (order_id, shipment_id, courier_id, channel, status, attempts, first_sent_at, last_sent_at, last_sent_by)
    values (p_order_id, v_shipment.id, v_shipment.courier_id, 'daraz_api', 'sent', 1, now(), now(), v_profile);
  end if;

  update public.notifications
  set read_at = now()
  where order_id = p_order_id and kind = 'order_auto_accepted' and read_at is null;
end;
$$;

revoke execute on function public.admin_record_provider_booking(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_record_provider_booking(uuid, text, jsonb) to authenticated;

-- The booked shipment of an order with p_provider, locked; any order state.
create or replace function public.provider_booked_shipment(p_order_id uuid, p_provider text)
returns public.shipments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  select * into v_shipment
  from public.shipments
  where order_id = p_order_id and provider = p_provider and provider_package_code is not null
  order by created_at limit 1
  for update;
  if not found then
    raise exception 'This order isn''t booked with the courier.' using errcode = '22023';
  end if;
  return v_shipment;
end;
$$;

revoke execute on function public.provider_booked_shipment(uuid, text) from public, anon, authenticated;

create or replace function public.admin_mark_awb_printed(p_order_id uuid, p_provider text)
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
  v_shipment := public.provider_booked_shipment(p_order_id, p_provider);
  update public.shipments set awb_printed_at = now() where id = v_shipment.id;
end;
$$;

revoke execute on function public.admin_mark_awb_printed(uuid, text) from public, anon;
grant execute on function public.admin_mark_awb_printed(uuid, text) to authenticated;

-- After Daraz accepted a packages/update: who and where the rider now goes.
-- p_receiver: name, phone_e164, details. The order's own snapshot stays as purchased.
create or replace function public.admin_record_provider_receiver_update(p_order_id uuid, p_provider text, p_receiver jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_name text := nullif(btrim(p_receiver ->> 'name'), '');
  v_phone text := nullif(btrim(p_receiver ->> 'phone_e164'), '');
  v_details text := nullif(btrim(p_receiver ->> 'details'), '');
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) > 120 or v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$'
     or (v_details is not null and char_length(v_details) > 300) then
    raise exception 'Enter the receiver''s name, a valid phone and an address up to 300 characters' using errcode = '22023';
  end if;
  v_shipment := public.provider_booked_shipment(p_order_id, p_provider);
  if v_shipment.status in ('delivered', 'returned') then
    raise exception 'This parcel is already delivered or returned.' using errcode = '22023';
  end if;

  update public.shipments
  set provider_receiver = jsonb_build_object('name', v_name, 'phone_e164', v_phone, 'details', v_details, 'updated_at', now())
  where id = v_shipment.id;

  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (v_shipment.id, v_shipment.status, 'Delivery details updated with the courier.', 'staff', now());
end;
$$;

revoke execute on function public.admin_record_provider_receiver_update(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_record_provider_receiver_update(uuid, text, jsonb) to authenticated;

-- After Daraz accepted a re-attempt or return request for a failed delivery.
create or replace function public.admin_record_provider_feedback(
  p_order_id uuid,
  p_provider text,
  p_feedback text,
  p_reattempt_on date
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shipment public.shipments%rowtype;
  v_message text;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  if p_feedback not in ('REATTEMPT', 'RETURN') then
    raise exception 'Choose re-attempt or return' using errcode = '22023';
  end if;
  v_shipment := public.provider_booked_shipment(p_order_id, p_provider);
  if v_shipment.status in ('delivered', 'returned') then
    raise exception 'This parcel is already delivered or returned.' using errcode = '22023';
  end if;

  v_message := case p_feedback
    when 'REATTEMPT' then 'Delivery will be attempted again'
      || coalesce(' on ' || to_char(p_reattempt_on, 'FMDD Mon YYYY'), '') || '.'
    else 'The parcel is being returned to the store.'
  end;

  update public.shipments set provider_needs_action = false where id = v_shipment.id;
  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (v_shipment.id, v_shipment.status, v_message, 'staff', now());
  update public.notifications
  set read_at = now()
  where order_id = p_order_id and kind = 'courier_attention' and read_at is null;
end;
$$;

revoke execute on function public.admin_record_provider_feedback(uuid, text, text, date) from public, anon;
grant execute on function public.admin_record_provider_feedback(uuid, text, text, date) to authenticated;

/* ---------- History: fees move to the staff-only finance table ---------- */

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
      provider_needs_action = coalesce((p_history ->> 'needs_action')::boolean, false),
      last_mile_provider = coalesce(left(nullif(btrim(p_history ->> 'last_mile_provider'), ''), 100), last_mile_provider),
      provider_synced_at = now()
  where id = v_shipment.id;

  if (p_history ->> 'fee_paisa') ~ '^[0-9]{1,12}$' then
    insert into public.shipment_courier_finance (shipment_id, actual_fee_paisa)
    values (v_shipment.id, (p_history ->> 'fee_paisa')::bigint)
    on conflict (shipment_id) do update set actual_fee_paisa = excluded.actual_fee_paisa;
  end if;

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

/* ---------- COD settlements ---------- */

-- Links a DEX payout to the delivered parcels it covered. Every tracking
-- number must be a delivered, collected, not-yet-settled parcel of p_provider.
create or replace function public.admin_record_remittance(
  p_provider text,
  p_reference text,
  p_statement_date date,
  p_gross_paisa bigint,
  p_deductions_paisa bigint,
  p_note text,
  p_tracking_numbers text[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_numbers text[];
  v_unknown text[];
  v_blocked text[];
  v_expected bigint;
  v_count integer;
  v_rows integer;
  v_id uuid;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  if v_reference is null or char_length(v_reference) > 100 then
    raise exception 'Enter the payout reference (up to 100 characters)' using errcode = '22023', detail = 'reference';
  end if;
  if p_statement_date is null or p_statement_date > (now() at time zone 'Asia/Kathmandu')::date then
    raise exception 'Enter the payout date (not in the future)' using errcode = '22023', detail = 'statementDate';
  end if;
  if p_gross_paisa is null or p_gross_paisa < 0 or coalesce(p_deductions_paisa, 0) < 0 or coalesce(p_deductions_paisa, 0) > p_gross_paisa then
    raise exception 'Amounts must be 0 or more, and deductions can''t exceed the COD amount' using errcode = '22023', detail = 'grossAmount';
  end if;

  select array_agg(distinct upper(btrim(n))) into v_numbers
  from unnest(coalesce(p_tracking_numbers, '{}')) n
  where btrim(n) <> '';
  if v_numbers is null or cardinality(v_numbers) = 0 then
    raise exception 'Add the tracking numbers this payout covers' using errcode = '22023', detail = 'trackingNumbers';
  end if;
  if cardinality(v_numbers) > 1000 then
    raise exception 'Record at most 1,000 parcels per payout' using errcode = '22023', detail = 'trackingNumbers';
  end if;

  select array_agg(n order by n) into v_unknown
  from unnest(v_numbers) n
  where not exists (
    select 1 from public.shipments s where s.provider = p_provider and upper(s.tracking_number) = n
  );
  if v_unknown is not null then
    raise exception 'Not Daraz parcels in Goreto: %', array_to_string(v_unknown[1:10], ', ')
      || case when cardinality(v_unknown) > 10 then ' …' else '' end
      using errcode = '22023', detail = 'trackingNumbers';
  end if;

  select array_agg(upper(s.tracking_number) order by s.tracking_number) into v_blocked
  from public.shipments s
  join public.orders o on o.id = s.order_id
  left join public.shipment_courier_finance f on f.shipment_id = s.id
  where s.provider = p_provider and upper(s.tracking_number) = any (v_numbers)
    and (s.status <> 'delivered' or o.payment_status <> 'collected' or f.cod_remittance_id is not null);
  if v_blocked is not null then
    raise exception 'Not delivered, not collected, or already settled: %', array_to_string(v_blocked[1:10], ', ')
      || case when cardinality(v_blocked) > 10 then ' …' else '' end
      using errcode = '22023', detail = 'trackingNumbers';
  end if;

  select coalesce(sum(o.total_paisa), 0), count(*) into v_expected, v_count
  from public.shipments s
  join public.orders o on o.id = s.order_id
  where s.provider = p_provider and upper(s.tracking_number) = any (v_numbers);

  insert into public.courier_remittances (provider, reference, statement_date, gross_paisa, deductions_paisa, expected_paisa, parcel_count, note, recorded_by)
  values (p_provider, v_reference, p_statement_date, p_gross_paisa, coalesce(p_deductions_paisa, 0), v_expected, v_count, v_note, public.current_profile_id())
  returning id into v_id;

  -- Only parcels still unsettled; a payout recorded at the same moment wins its parcels.
  insert into public.shipment_courier_finance (shipment_id, cod_remittance_id)
  select s.id, v_id
  from public.shipments s
  where s.provider = p_provider and upper(s.tracking_number) = any (v_numbers)
  on conflict (shipment_id) do update set cod_remittance_id = excluded.cod_remittance_id
    where public.shipment_courier_finance.cod_remittance_id is null;
  get diagnostics v_rows = row_count;
  if v_rows <> v_count then
    raise exception 'Some of these parcels were just settled in another payout. Reload and try again.' using errcode = '40001';
  end if;

  return jsonb_build_object('id', v_id, 'expected_paisa', v_expected, 'parcel_count', v_count);
end;
$$;

revoke execute on function public.admin_record_remittance(text, text, date, bigint, bigint, text, text[]) from public, anon;
grant execute on function public.admin_record_remittance(text, text, date, bigint, bigint, text, text[]) to authenticated;

-- A mistaken entry: only the owner may remove it; its parcels become unsettled again.
create or replace function public.admin_delete_remittance(p_remittance_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner can delete a recorded payout' using errcode = '42501';
  end if;
  update public.shipment_courier_finance set cod_remittance_id = null where cod_remittance_id = p_remittance_id;
  delete from public.courier_remittances where id = p_remittance_id;
  if not found then
    raise exception 'payout not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_delete_remittance(uuid) from public, anon;
grant execute on function public.admin_delete_remittance(uuid) to authenticated;

/* ---------- Support cases (Daraz XSpace) ---------- */

create table public.courier_support_cases (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('daraz')),
  case_id text not null check (char_length(case_id) between 1 and 60),
  order_id uuid references public.orders (id) on delete set null,
  tracking_number text check (tracking_number is null or char_length(tracking_number) <= 100),
  subject text not null check (char_length(subject) between 1 and 200),
  status text check (status is null or char_length(status) <= 60),
  rating smallint check (rating is null or rating between 1 and 5),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (provider, case_id)
);

create index courier_support_cases_order_idx on public.courier_support_cases (order_id) where order_id is not null;
create index courier_support_cases_created_idx on public.courier_support_cases (provider, created_at desc);
create index courier_support_cases_created_by_idx on public.courier_support_cases (created_by) where created_by is not null;

alter table public.courier_support_cases enable row level security;

create policy "courier_support_cases: staff read"
  on public.courier_support_cases for select to authenticated
  using ((select public.has_permission('orders.read')));

revoke all on public.courier_support_cases from anon, authenticated;
grant select on public.courier_support_cases to authenticated;
grant all on public.courier_support_cases to service_role;

create or replace function public.admin_record_support_case(
  p_provider text,
  p_case_id text,
  p_order_id uuid,
  p_tracking_number text,
  p_subject text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  insert into public.courier_support_cases (provider, case_id, order_id, tracking_number, subject, status, created_by, synced_at)
  values (
    p_provider, btrim(p_case_id), p_order_id, nullif(upper(btrim(coalesce(p_tracking_number, ''))), ''),
    left(btrim(p_subject), 200), 'open', public.current_profile_id(), now()
  )
  on conflict (provider, case_id) do update set synced_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.admin_record_support_case(text, text, uuid, text, text) from public, anon;
grant execute on function public.admin_record_support_case(text, text, uuid, text, text) to authenticated;

create or replace function public.admin_update_support_case(p_provider text, p_case_id text, p_status text, p_rating smallint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  update public.courier_support_cases
  set status = coalesce(left(nullif(btrim(p_status), ''), 60), status),
      rating = coalesce(p_rating, rating),
      synced_at = now()
  where provider = p_provider and case_id = btrim(p_case_id);
  if not found then
    raise exception 'support case not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_support_case(text, text, text, smallint) from public, anon;
grant execute on function public.admin_update_support_case(text, text, text, smallint) to authenticated;

/* ---------- Dashboard overview (orders.read) ---------- */

create or replace function public.admin_courier_overview(p_provider text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kathmandu') at time zone 'Asia/Kathmandu';
  v_result jsonb;
begin
  if not public.has_permission('orders.read') then
    raise exception 'orders.read required' using errcode = '42501';
  end if;

  with provider_shipments as (
    select s.*, o.status as order_status, o.payment_status, o.total_paisa, f.cod_remittance_id, f.actual_fee_paisa
    from public.shipments s
    join public.orders o on o.id = s.order_id
    join public.couriers c on c.id = s.courier_id and c.api_provider = p_provider
    left join public.shipment_courier_finance f on f.shipment_id = s.id
  )
  select jsonb_build_object(
    'to_book', count(*) filter (where provider_package_code is null and order_status in ('confirmed', 'processing', 'packed')),
    'booked_not_ready', count(*) filter (where provider_package_code is not null and ready_to_ship_at is null and status = 'assigned'),
    'awaiting_pickup', count(*) filter (where provider_package_code is not null and ready_to_ship_at is not null and status = 'assigned'),
    'in_transit', count(*) filter (where provider_package_code is not null and status in ('picked_up', 'in_transit')),
    'out_for_delivery', count(*) filter (where provider_package_code is not null and status = 'out_for_delivery'),
    'needs_action', count(*) filter (where provider_package_code is not null and (provider_needs_action or status = 'exception')),
    'delivered_7d', count(*) filter (where status = 'delivered' and delivered_at >= now() - interval '7 days'),
    'returned_30d', count(*) filter (where status = 'returned' and updated_at >= now() - interval '30 days'),
    'cod_unsettled_count', count(*) filter (where provider = p_provider and status = 'delivered' and payment_status = 'collected' and cod_remittance_id is null),
    'cod_unsettled_paisa', coalesce(sum(total_paisa) filter (where provider = p_provider and status = 'delivered' and payment_status = 'collected' and cod_remittance_id is null), 0),
    'fees_month_paisa', coalesce(sum(actual_fee_paisa) filter (where delivered_at >= v_month_start), 0),
    'last_synced_at', max(provider_synced_at)
  )
  into v_result
  from provider_shipments;

  return v_result || jsonb_build_object(
    'last_webhook_at', (select max(received_at) from public.courier_webhook_inbox where provider = p_provider),
    'webhook_errors_24h', (select count(*) from public.courier_webhook_inbox
                           where provider = p_provider and error is not null and received_at >= now() - interval '1 day'),
    'api_calls_24h', (select count(*) from public.courier_api_log where provider = p_provider and created_at >= now() - interval '1 day'),
    'api_failures_24h', (select count(*) from public.courier_api_log
                         where provider = p_provider and not success and created_at >= now() - interval '1 day'),
    'mapped_municipalities', (select count(*) from public.daraz_locations),
    'total_municipalities', (select count(*) from public.nepal_municipalities)
  );
end;
$$;

revoke execute on function public.admin_courier_overview(text) from public, anon;
grant execute on function public.admin_courier_overview(text) to authenticated;
