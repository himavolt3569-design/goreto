-- Cart, checkout and order tracking (prompts/goreto-cart-checkout-confirmation.md,
-- AGENTS §4.4, §4.5, §12).
--
-- All checkout maths lives in one private function, checkout_price. Two entry
-- points call it:
--
-- * checkout_quote: read-only preview for the cart and checkout summary.
-- * place_order: the same maths inside one transaction, after locking the
--   variant and coupon rows, then the writes (order, item snapshots, stock,
--   coupon counter, shipment and first event).
--
-- The browser sends variant ids, quantities, address codes, a service id, a
-- coupon code and contact details. Prices, fees, discounts, totals and the
-- customer's profile always come from the database.
--
-- Guests reach their order only through get_order_tracking with the tracking
-- secret (only its sha256 is stored). anon still has no direct access to the
-- order tables.
--
-- Checkout errors are raised with message 'checkout:<reason>' and, where the
-- UI needs more, a JSON DETAIL. src/features/checkout/errors.ts maps them.

/* ---------- Pricing core (private) ---------- */

create or replace function public.checkout_price(
  p_items jsonb,
  p_municipality_code text,
  p_courier_service_id uuid,
  p_coupon_code text,
  p_contact_email text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_max_lines constant integer := 20;
  c_max_per_line constant integer := 10;
  v_lines jsonb;
  v_subtotal bigint;
  v_weight bigint;
  v_district text;
  v_zone public.delivery_zones%rowtype;
  v_options jsonb := '[]'::jsonb;
  v_selected jsonb;
  v_coupon public.coupons%rowtype;
  v_code text := nullif(upper(btrim(coalesce(p_coupon_code, ''))), '');
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_coupon_result jsonb;
  v_discount bigint := 0;
  v_delivery_fee bigint := 0;
  v_customer_uses integer;
  v_settings public.store_settings%rowtype;
begin
  /* Items: 1–20 distinct variants, whole quantities 1–10. Checked in steps so
     no cast runs on input that failed an earlier check. */
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'checkout:invalid_items' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and c_max_lines
     or exists (
       select 1 from jsonb_array_elements(p_items) as t(item)
       where jsonb_typeof(item) <> 'object'
          or coalesce(item ->> 'variant_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or coalesce(jsonb_typeof(item -> 'quantity'), '') <> 'number'
          or coalesce(item ->> 'quantity', '') !~ '^[0-9]{1,3}$'
     ) then
    raise exception 'checkout:invalid_items' using errcode = '22023';
  end if;
  if exists (
       select 1 from jsonb_array_elements(p_items) as t(item)
       where (item ->> 'quantity')::integer not between 1 and c_max_per_line
     )
     or (select count(distinct item ->> 'variant_id') from jsonb_array_elements(p_items) as t(item))
        <> jsonb_array_length(p_items) then
    raise exception 'checkout:invalid_items' using errcode = '22023';
  end if;

  /* Lines, priced and checked from the database. */
  with requested as (
    select (item ->> 'variant_id')::uuid as variant_id,
           (item ->> 'quantity')::integer as quantity,
           position
    from jsonb_array_elements(p_items) with ordinality as t(item, position)
  ),
  priced as (
    select
      r.position,
      r.variant_id,
      r.quantity,
      p.id as product_id,
      p.slug as product_slug,
      p.title as product_title,
      v.title as variant_title,
      v.sku,
      coalesce(v.price_paisa, p.base_price_paisa) as unit_price_paisa,
      coalesce(v.weight_grams, 0) as weight_grams,
      case
        when v.id is null or not v.is_active or p.status <> 'active' then 0
        else least(v.stock_quantity, c_max_per_line)
      end as available_quantity,
      (
        select m.storage_path
        from public.product_media m
        where m.product_id = p.id and m.kind = 'image'
          and (m.variant_id = v.id or m.variant_id is null)
        order by (m.variant_id is null), m.sort_order, m.id
        limit 1
      ) as image_path
    from requested r
    left join public.product_variants v on v.id = r.variant_id
    left join public.products p on p.id = v.product_id
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'variant_id', variant_id,
        'product_id', product_id,
        'product_slug', product_slug,
        'product_title', product_title,
        'variant_title', variant_title,
        'sku', sku,
        'image_path', image_path,
        'unit_price_paisa', unit_price_paisa,
        'quantity', quantity,
        'available_quantity', available_quantity,
        'line_total_paisa', coalesce(unit_price_paisa, 0) * quantity,
        'status', case
          when available_quantity = 0 then 'unavailable'
          when available_quantity < quantity then 'insufficient_stock'
          else 'ok'
        end
      )
      order by position
    ),
    coalesce(sum(case when available_quantity > 0 then unit_price_paisa * least(quantity, available_quantity) end), 0),
    coalesce(sum(case when available_quantity > 0 then weight_grams * least(quantity, available_quantity) end), 0)
  into v_lines, v_subtotal, v_weight
  from priced;

  /* Delivery options for the address's district (one zone per district). */
  if p_municipality_code is not null then
    select m.district_code into v_district
    from public.nepal_municipalities m where m.code = p_municipality_code;

    if v_district is not null then
      select * into v_zone
      from public.delivery_zones z
      where z.is_active and v_district = any (z.district_codes)
      limit 1;

      if v_zone.id is not null then
        select coalesce(jsonb_agg(opt order by (opt ->> 'price_paisa')::bigint, opt ->> 'service_name'), '[]'::jsonb)
        into v_options
        from (
          select jsonb_build_object(
            'courier_service_id', cs.id,
            'service_name', cs.name,
            'service_level', cs.service_level,
            'description', cs.description,
            'courier_id', c.id,
            'courier_name', c.name,
            'price_paisa', r.price_paisa,
            'estimated_min_days', coalesce(r.estimated_min_days, cs.estimated_min_days),
            'estimated_max_days', coalesce(r.estimated_max_days, cs.estimated_max_days)
          ) as opt
          from public.delivery_rates r
          join public.courier_services cs on cs.id = r.courier_service_id
          join public.couriers c on c.id = cs.courier_id
          where r.zone_id = v_zone.id
            and r.is_active and cs.is_active and c.is_active
            and (r.min_order_paisa is null or v_subtotal >= r.min_order_paisa)
            and (r.min_weight_grams is null or v_weight >= r.min_weight_grams)
            and (r.max_weight_grams is null or v_weight <= r.max_weight_grams)
        ) options;
      end if;
    end if;
  end if;

  if p_courier_service_id is not null then
    select opt into v_selected
    from jsonb_array_elements(v_options) as t(opt)
    where (opt ->> 'courier_service_id')::uuid = p_courier_service_id;
    v_delivery_fee := coalesce((v_selected ->> 'price_paisa')::bigint, 0);
  end if;

  /* Coupon. Unknown and inactive codes look the same to the shopper. */
  if v_code is not null then
    select * into v_coupon from public.coupons c where c.code = v_code and c.is_active;

    if v_coupon.id is null then
      v_coupon_result := jsonb_build_object('code', v_code, 'error', 'not_found');
    elsif v_coupon.starts_at > now() then
      v_coupon_result := jsonb_build_object('code', v_code, 'error', 'not_started');
    elsif v_coupon.ends_at is not null and v_coupon.ends_at <= now() then
      v_coupon_result := jsonb_build_object('code', v_code, 'error', 'expired');
    elsif v_coupon.usage_limit is not null and v_coupon.times_used >= v_coupon.usage_limit then
      v_coupon_result := jsonb_build_object('code', v_code, 'error', 'usage_limit');
    elsif v_coupon.min_order_paisa is not null and v_subtotal < v_coupon.min_order_paisa then
      v_coupon_result := jsonb_build_object('code', v_code, 'error', 'min_order', 'min_order_paisa', v_coupon.min_order_paisa);
    else
      if v_coupon.usage_limit_per_customer is not null and (p_profile_id is not null or v_email is not null) then
        select count(*) into v_customer_uses
        from public.orders o
        where o.coupon_id = v_coupon.id
          and o.status <> 'canceled'
          and (
            (p_profile_id is not null and o.user_id = p_profile_id)
            or (v_email is not null and o.contact_email = v_email)
          );
      end if;

      if coalesce(v_customer_uses, 0) >= coalesce(v_coupon.usage_limit_per_customer, 2147483647) then
        v_coupon_result := jsonb_build_object('code', v_code, 'error', 'customer_limit');
      else
        v_discount := case v_coupon.type
          when 'percentage' then (v_subtotal * v_coupon.percent_off) / 100
          else v_coupon.amount_off_paisa
        end;
        if v_coupon.max_discount_paisa is not null then
          v_discount := least(v_discount, v_coupon.max_discount_paisa);
        end if;
        v_discount := least(v_discount, v_subtotal);
        v_coupon_result := jsonb_build_object(
          'code', v_code,
          'coupon_id', v_coupon.id,
          'description', v_coupon.description,
          'discount_paisa', v_discount
        );
      end if;
    end if;
  end if;

  select * into v_settings from public.store_settings limit 1;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal_paisa', v_subtotal,
    'weight_grams', v_weight,
    'zone', case when v_zone.id is null then null
               else jsonb_build_object('id', v_zone.id, 'name', v_zone.name) end,
    'delivery_options', v_options,
    'selected_delivery', v_selected,
    'coupon', v_coupon_result,
    'discount_paisa', v_discount,
    'delivery_fee_paisa', v_delivery_fee,
    'total_paisa', v_subtotal - v_discount + v_delivery_fee,
    'cod_enabled', coalesce(v_settings.cod_enabled, false),
    'cod_max_order_paisa', v_settings.cod_max_order_paisa
  );
end;
$$;

-- Internal: only the definer functions below call it.
revoke execute on function public.checkout_price(jsonb, text, uuid, text, text, uuid) from public, anon, authenticated;

/* ---------- Quote (read-only preview) ---------- */

create or replace function public.checkout_quote(
  p_items jsonb,
  p_municipality_code text default null,
  p_courier_service_id uuid default null,
  p_coupon_code text default null,
  p_contact_email text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.checkout_price(
    p_items, p_municipality_code, p_courier_service_id, p_coupon_code, p_contact_email,
    public.current_profile_id()
  )
$$;

revoke execute on function public.checkout_quote(jsonb, text, uuid, text, text) from public;
grant execute on function public.checkout_quote(jsonb, text, uuid, text, text) to anon, authenticated;

/* ---------- Place order (atomic) ---------- */

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
  v_name text := btrim(coalesce(p_contact ->> 'name', ''));
  v_email text := lower(btrim(coalesce(p_contact ->> 'email', '')));
  v_phone text := btrim(coalesce(p_contact ->> 'phone_e164', ''));
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
begin
  /* Contact. The server action already normalised the phone with libphonenumber. */
  if char_length(v_name) not between 2 and 100
     or char_length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or v_phone !~ '^\+977[0-9]{8,10}$' then
    raise exception 'checkout:invalid_contact' using errcode = '22023';
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

  if v_profile_id is null and coalesce(p_tracking_hash, '') !~ '^[0-9a-f]{64}$' then
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
    p_items, v_municipality.code, p_courier_service_id, p_coupon_code, v_email, v_profile_id
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
    guest_tracking_hash
  )
  values (
    v_order_number,
    v_profile_id,
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
    p_tracking_hash
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

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text) to anon, authenticated;

/* ---------- Order tracking (owner by session, guest by secret) ---------- */

-- Returns the order only to its signed-in owner, or to anyone holding the
-- tracking secret. Otherwise null (never "exists but forbidden").
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
      'courier_website', v_courier.website_url
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

/* ---------- Nearest municipality (location assistance only) ---------- */

-- Suggests the closest municipality centre to browser coordinates. It is a
-- hint the shopper confirms; ward and street are never guessed.
create or replace function public.nearest_municipality(p_latitude numeric, p_longitude numeric)
returns table (
  municipality_code text,
  district_code text,
  province_code text,
  postal_code text,
  distance_km numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.code, d.code, d.province_code, m.postal_code,
         round((111.32 * sqrt(
           power(m.latitude - p_latitude, 2)
           + power((m.longitude - p_longitude) * cos(radians(p_latitude)), 2)
         ))::numeric, 1)
  from public.nepal_municipalities m
  join public.nepal_districts d on d.code = m.district_code
  where p_latitude between 26 and 31
    and p_longitude between 80 and 89
    and m.latitude is not null and m.longitude is not null
  order by power(m.latitude - p_latitude, 2)
         + power((m.longitude - p_longitude) * cos(radians(p_latitude)), 2)
  limit 1
$$;

revoke execute on function public.nearest_municipality(numeric, numeric) from public;
grant execute on function public.nearest_municipality(numeric, numeric) to anon, authenticated;
