-- Daraz Express: the customer's "Track on …" link, and automatic booking
-- (prompts/goreto-daraz-courier.md). Booking is split into a private core
-- with two callers: staff (orders.write, their own session) and the courier
-- sync (service role), which books accepted orders when the store turned
-- auto-book on, including orders accepted automatically with no one signed in.

/* ---------- Customer tracking link ---------- */

create or replace function public.get_order_tracking(p_order_number text, p_secret text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_profile_id uuid := public.current_profile_id();
  v_shipment public.shipments%rowtype;
  v_courier public.couriers%rowtype;
begin
  if coalesce(p_order_number, '') !~ '^[A-Z]{2,4}[0-9]{6,14}$' then
    return null;
  end if;

  select * into v_order from public.orders o where o.order_number = p_order_number;
  if v_order.id is null then
    return null;
  end if;

  if not (
    (v_profile_id is not null and v_order.user_id = v_profile_id)
    or (
      v_order.guest_tracking_hash is not null
      and char_length(coalesce(p_secret, '')) between 16 and 128
      and encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') = v_order.guest_tracking_hash
    )
  ) then
    return null;
  end if;

  select * into v_shipment from public.shipments s where s.order_id = v_order.id order by s.created_at limit 1;
  if v_shipment.courier_id is not null then
    select * into v_courier from public.couriers c where c.id = v_shipment.courier_id;
  end if;

  return jsonb_build_object(
    'order_number', v_order.order_number,
    'created_at', v_order.created_at,
    'status', v_order.status,
    'payment_method', v_order.payment_method,
    'payment_status', v_order.payment_status,
    'contact_name', v_order.contact_name,
    'contact_phone_e164', v_order.contact_phone_e164,
    'shipping_address', v_order.shipping_address,
    'delivery_snapshot', v_order.delivery_snapshot,
    'subtotal_paisa', v_order.subtotal_paisa,
    'discount_paisa', v_order.discount_paisa,
    'delivery_fee_paisa', v_order.delivery_fee_paisa,
    'total_paisa', v_order.total_paisa,
    'coupon_code', v_order.coupon_code,
    'customer_note', v_order.customer_note,
    'confirmed_at', v_order.confirmed_at,
    'packed_at', v_order.packed_at,
    'shipped_at', v_order.shipped_at,
    'delivered_at', v_order.delivered_at,
    'canceled_at', v_order.canceled_at,
    'cancellation_reason', v_order.cancellation_reason,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_title', i.product_title,
        'variant_title', i.variant_title,
        'sku', i.sku,
        'image_path', i.image_path,
        'unit_price_paisa', i.unit_price_paisa,
        'quantity', i.quantity,
        'line_total_paisa', i.line_total_paisa
      ) order by i.created_at, i.id)
      from public.order_items i where i.order_id = v_order.id
    ), '[]'::jsonb),
    'shipment', case when v_shipment.id is null then null else jsonb_build_object(
      'status', v_shipment.status,
      'tracking_number', v_shipment.tracking_number,
      'estimated_delivery_from', v_shipment.estimated_delivery_from,
      'estimated_delivery_to', v_shipment.estimated_delivery_to,
      'assigned_at', v_shipment.assigned_at,
      'courier_name', v_courier.name,
      'courier_phone', v_courier.support_phone,
      'courier_website', v_courier.website_url,
      'courier_tracking_url', case
        when v_courier.tracking_url_template is not null and v_shipment.tracking_number is not null
        then replace(v_courier.tracking_url_template, '{tracking}', v_shipment.tracking_number)
      end
    ) end,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', e.status,
        'message', e.message,
        'location_label', e.location_label,
        'occurred_at', e.occurred_at
      ) order by e.occurred_at desc, e.created_at desc)
      from public.shipment_events e where e.shipment_id = v_shipment.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_order_tracking(text, text) from public;
grant execute on function public.get_order_tracking(text, text) to anon, authenticated;

/* ---------- Booking core (private) and its two callers ---------- */

alter table public.shipments
  add column provider_auto_book_failed_at timestamptz;

create or replace function public.provider_booking_reference_core(p_order_id uuid, p_provider text)
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
  v_shipment := public.provider_bookable_shipment(p_order_id, p_provider);
  if v_shipment.provider_package_code is not null then
    return v_shipment.provider_reference;
  end if;
  select order_number into v_order_number from public.orders where id = p_order_id;
  return case when v_shipment.provider_booking_attempts = 0 then v_order_number
              else v_order_number || '-R' || (v_shipment.provider_booking_attempts + 1) end;
end;
$$;

revoke execute on function public.provider_booking_reference_core(uuid, text) from public, anon, authenticated;

create or replace function public.admin_provider_booking_reference(p_order_id uuid, p_provider text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  return public.provider_booking_reference_core(p_order_id, p_provider);
end;
$$;

revoke execute on function public.admin_provider_booking_reference(uuid, text) from public, anon;
grant execute on function public.admin_provider_booking_reference(uuid, text) to authenticated;

create or replace function public.courier_provider_booking_reference(p_order_id uuid, p_provider text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select public.provider_booking_reference_core(p_order_id, p_provider)
$$;

revoke execute on function public.courier_provider_booking_reference(uuid, text) from public, anon, authenticated;
grant execute on function public.courier_provider_booking_reference(uuid, text) to service_role;

-- Saves a successful Daraz booking (keys documented on admin_record_provider_booking).
-- p_actor is the staff member, or null for an automatic booking.
create or replace function public.provider_record_booking_core(p_order_id uuid, p_provider text, p_booking jsonb, p_actor uuid)
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
begin
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
      provider_auto_book_failed_at = null,
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
      last_sent_by = p_actor
  where order_id = p_order_id and status <> 'superseded';
  if not found then
    insert into public.courier_handoffs (order_id, shipment_id, courier_id, channel, status, attempts, first_sent_at, last_sent_at, last_sent_by)
    values (p_order_id, v_shipment.id, v_shipment.courier_id, 'daraz_api', 'sent', 1, now(), now(), p_actor);
  end if;

  update public.notifications
  set read_at = now()
  where order_id = p_order_id and kind in ('order_auto_accepted', 'courier_attention') and read_at is null;
end;
$$;

revoke execute on function public.provider_record_booking_core(uuid, text, jsonb, uuid) from public, anon, authenticated;

create or replace function public.admin_record_provider_booking(p_order_id uuid, p_provider text, p_booking jsonb)
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
  perform public.provider_record_booking_core(p_order_id, p_provider, p_booking, public.current_profile_id());
end;
$$;

revoke execute on function public.admin_record_provider_booking(uuid, text, jsonb) from public, anon;
grant execute on function public.admin_record_provider_booking(uuid, text, jsonb) to authenticated;

create or replace function public.courier_record_provider_booking(p_order_id uuid, p_provider text, p_booking jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select public.provider_record_booking_core(p_order_id, p_provider, p_booking, null)
$$;

revoke execute on function public.courier_record_provider_booking(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.courier_record_provider_booking(uuid, text, jsonb) to service_role;

/* ---------- Automatic booking (service role) ---------- */

-- Accepted orders waiting for their first automatic booking: courier booked
-- through p_provider, auto-book on, never booked or attempted, recent.
create or replace function public.courier_auto_book_candidates(p_provider text, p_limit integer default 10)
returns table (order_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.order_id
  from public.shipments s
  join public.orders o on o.id = s.order_id
  join public.couriers c on c.id = s.courier_id and c.api_provider = p_provider
  join public.courier_provider_accounts a on a.provider = p_provider and a.auto_book
  where o.status in ('confirmed', 'processing', 'packed')
    and s.provider_package_code is null
    and s.provider_booking_attempts = 0
    and s.provider_auto_book_failed_at is null
    and o.accepted_at >= now() - interval '7 days'
  order by o.accepted_at
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

revoke execute on function public.courier_auto_book_candidates(text, integer) from public, anon, authenticated;
grant execute on function public.courier_auto_book_candidates(text, integer) to service_role;

-- An automatic booking didn't go through: stop retrying it and tell order staff.
create or replace function public.courier_auto_book_failed(p_order_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;
  update public.shipments set provider_auto_book_failed_at = now() where order_id = p_order_id and provider_package_code is null;

  insert into public.notifications (recipient_id, kind, order_id, title, body, href)
  select p.id, 'courier_attention', v_order.id,
         'Daraz: order #' || v_order.order_number || ' wasn''t booked automatically',
         left(coalesce(nullif(btrim(p_reason), ''), 'Book it from the order page.'), 500),
         '/admin/orders/' || v_order.order_number
  from public.profiles p
  where p.deleted_at is null
    and (
      p.role = 'owner'
      or (p.role = 'staff' and exists (
        select 1 from public.staff_permissions sp where sp.profile_id = p.id and sp.permission_key = 'orders.read'
      ))
    );
end;
$$;

revoke execute on function public.courier_auto_book_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.courier_auto_book_failed(uuid, text) to service_role;
