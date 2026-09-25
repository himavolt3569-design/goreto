-- Admin panel: dashboard and analytics aggregates, customer summaries, and
-- the operational functions staff use to run fulfilment, payments,
-- inventory and the catalog (AGENTS §4.6, §9.2, §12, §16).
--
-- Aggregates are security definer: a permission such as analytics.read must
-- not require (or grant) row access to orders and profiles, so each function
-- checks the caller's permission itself and returns aggregates only.
--
-- Operations are security invoker so the existing write policies stay the
-- enforcement, except admin_transition_order: canceling restocks variants,
-- which fulfilment staff (orders.write) must be able to do without
-- inventory.write, so it is definer with an explicit orders.write check.
--
-- Nothing is granted implicitly (harden_grants): every function lists its own
-- grants. Store days are Asia/Kathmandu dates.

/* ---------- Helpers ---------- */

-- Start of a Kathmandu calendar day as a timestamptz (index-friendly bounds).
create or replace function public.npt_day_start(p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select p_day::timestamp at time zone 'Asia/Kathmandu'
$$;

revoke execute on function public.npt_day_start(date) from public, anon;
grant execute on function public.npt_day_start(date) to authenticated;

create or replace function public.admin_assert_range(p_from date, p_to date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.admin_assert_range(date, date) from public, anon;
grant execute on function public.admin_assert_range(date, date) to authenticated;

/* ---------- Dashboard KPIs ---------- */

-- Totals for a period and its comparison period, plus a daily series for the
-- sparklines (up to today). Sales exclude canceled and refunded orders.
-- Active products and customers are point-in-time counts at the end of each
-- period, derived from published_at/archived_at and profile created_at.
create or replace function public.admin_dashboard_kpis(
  p_from date,
  p_to date,
  p_prev_from date,
  p_prev_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kathmandu')::date;
  v_result jsonb;
begin
  if not public.has_permission('analytics.read') then
    raise exception 'analytics.read required' using errcode = '42501';
  end if;
  perform public.admin_assert_range(p_from, p_to);
  perform public.admin_assert_range(p_prev_from, p_prev_to);

  with periods as (
    select 'current' as period, p_from as from_day, p_to as to_day
    union all
    select 'previous', p_prev_from, p_prev_to
  ),
  totals as (
    select
      pr.period,
      (
        select coalesce(sum(o.total_paisa) filter (
          where o.status <> 'canceled' and o.payment_status <> 'refunded'
        ), 0)
        from public.orders o
        where o.created_at >= public.npt_day_start(pr.from_day)
          and o.created_at < public.npt_day_start(pr.to_day + 1)
      ) as sales_paisa,
      (
        select count(*)
        from public.orders o
        where o.created_at >= public.npt_day_start(pr.from_day)
          and o.created_at < public.npt_day_start(pr.to_day + 1)
      ) as orders,
      (
        select count(*)
        from public.products p
        where p.status <> 'draft'
          and p.published_at < least(public.npt_day_start(pr.to_day + 1), now())
          and (p.archived_at is null or p.archived_at >= least(public.npt_day_start(pr.to_day + 1), now()))
      ) as active_products,
      (
        select count(*)
        from public.profiles c
        where c.role = 'customer'
          and c.deleted_at is null
          and c.created_at < least(public.npt_day_start(pr.to_day + 1), now())
      ) as customers
    from periods pr
  ),
  days as (
    select d::date as day
    from generate_series(p_from, least(p_to, v_today), interval '1 day') d
  ),
  daily_orders as (
    select
      (o.created_at at time zone 'Asia/Kathmandu')::date as day,
      coalesce(sum(o.total_paisa) filter (
        where o.status <> 'canceled' and o.payment_status <> 'refunded'
      ), 0) as sales_paisa,
      count(*) as orders
    from public.orders o
    where o.created_at >= public.npt_day_start(p_from)
      and o.created_at < public.npt_day_start(least(p_to, v_today) + 1)
    group by 1
  ),
  daily as (
    select
      d.day,
      coalesce(dor.sales_paisa, 0) as sales_paisa,
      coalesce(dor.orders, 0) as orders,
      (
        select count(*)
        from public.products p
        where p.status <> 'draft'
          and p.published_at < least(public.npt_day_start(d.day + 1), now())
          and (p.archived_at is null or p.archived_at >= least(public.npt_day_start(d.day + 1), now()))
      ) as active_products,
      (
        select count(*)
        from public.profiles c
        where c.role = 'customer'
          and c.deleted_at is null
          and c.created_at < least(public.npt_day_start(d.day + 1), now())
      ) as customers
    from days d
    left join daily_orders dor on dor.day = d.day
  )
  select jsonb_build_object(
    'current', (
      select jsonb_build_object(
        'sales_paisa', t.sales_paisa, 'orders', t.orders,
        'active_products', t.active_products, 'customers', t.customers)
      from totals t where t.period = 'current'
    ),
    'previous', (
      select jsonb_build_object(
        'sales_paisa', t.sales_paisa, 'orders', t.orders,
        'active_products', t.active_products, 'customers', t.customers)
      from totals t where t.period = 'previous'
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', dl.day, 'sales_paisa', dl.sales_paisa, 'orders', dl.orders,
        'active_products', dl.active_products, 'customers', dl.customers) order by dl.day)
      from daily dl
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_dashboard_kpis(date, date, date, date) from public, anon;
grant execute on function public.admin_dashboard_kpis(date, date, date, date) to authenticated;

/* ---------- Revenue series ---------- */

create or replace function public.admin_revenue_series(p_from date, p_to date, p_bucket text)
returns table (bucket date, sales_paisa bigint, orders integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_permission('analytics.read') then
    raise exception 'analytics.read required' using errcode = '42501';
  end if;
  perform public.admin_assert_range(p_from, p_to);
  if p_bucket not in ('day', 'month') then
    raise exception 'bucket must be day or month' using errcode = '22023';
  end if;

  return query
  with buckets as (
    select b::date as bucket
    from generate_series(
      date_trunc(p_bucket, p_from::timestamp),
      date_trunc(p_bucket, p_to::timestamp),
      case when p_bucket = 'day' then interval '1 day' else interval '1 month' end
    ) b
  ),
  sums as (
    select
      date_trunc(p_bucket, o.created_at at time zone 'Asia/Kathmandu')::date as bucket,
      coalesce(sum(o.total_paisa) filter (
        where o.status <> 'canceled' and o.payment_status <> 'refunded'
      ), 0)::bigint as sales_paisa,
      count(*)::integer as orders
    from public.orders o
    where o.created_at >= public.npt_day_start(p_from)
      and o.created_at < public.npt_day_start(p_to + 1)
    group by 1
  )
  select b.bucket, coalesce(s.sales_paisa, 0)::bigint, coalesce(s.orders, 0)::integer
  from buckets b
  left join sums s on s.bucket = b.bucket
  order by b.bucket;
end;
$$;

revoke execute on function public.admin_revenue_series(date, date, text) from public, anon;
grant execute on function public.admin_revenue_series(date, date, text) to authenticated;

/* ---------- Analytics breakdown ---------- */

create or replace function public.admin_analytics_breakdown(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('analytics.read') then
    raise exception 'analytics.read required' using errcode = '42501';
  end if;
  perform public.admin_assert_range(p_from, p_to);

  with range_orders as (
    select o.*
    from public.orders o
    where o.created_at >= public.npt_day_start(p_from)
      and o.created_at < public.npt_day_start(p_to + 1)
  ),
  sold_orders as (
    select * from range_orders
    where status <> 'canceled' and payment_status <> 'refunded'
  ),
  sold_items as (
    select oi.*
    from public.order_items oi
    join sold_orders so on so.id = oi.order_id
  ),
  buyers as (
    select distinct ro.user_id
    from range_orders ro
    where ro.user_id is not null
  )
  select jsonb_build_object(
    'order_count', (select count(*) from range_orders),
    'sold_order_count', (select count(*) from sold_orders),
    'sales_paisa', (select coalesce(sum(total_paisa), 0) from sold_orders),
    'discount_paisa', (select coalesce(sum(discount_paisa), 0) from sold_orders),
    'delivery_fee_paisa', (select coalesce(sum(delivery_fee_paisa), 0) from sold_orders),
    'aov_paisa', (
      select coalesce(sum(total_paisa) / nullif(count(*), 0), 0) from sold_orders
    ),
    'units_sold', (select coalesce(sum(quantity), 0) from sold_items),
    'guest_order_count', (select count(*) from range_orders where user_id is null),
    'buyer_count', (select count(*) from buyers),
    'repeat_buyer_count', (
      select count(*)
      from buyers b
      where (
        select count(*)
        from public.orders o
        where o.user_id = b.user_id
          and o.created_at < public.npt_day_start(p_to + 1)
      ) >= 2
    ),
    'status_counts', coalesce((
      select jsonb_agg(jsonb_build_object('status', s.status, 'count', s.n) order by s.status)
      from (select status, count(*) as n from range_orders group by status) s
    ), '[]'::jsonb),
    'payment_totals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', s.payment_status, 'count', s.n, 'total_paisa', s.total) order by s.payment_status)
      from (
        select payment_status, count(*) as n, sum(total_paisa) as total
        from range_orders group by payment_status
      ) s
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', t.product_id, 'title', t.title,
        'units', t.units, 'revenue_paisa', t.revenue) order by t.revenue desc, t.title)
      from (
        select si.product_id, max(si.product_title) as title,
               sum(si.quantity) as units, sum(si.line_total_paisa) as revenue
        from sold_items si
        group by si.product_id
        order by revenue desc, title
        limit 10
      ) t
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', c.title, 'units', c.units, 'revenue_paisa', c.revenue) order by c.revenue desc, c.title)
      from (
        select coalesce(parent.title, cat.title, 'Removed products') as title,
               sum(si.quantity) as units, sum(si.line_total_paisa) as revenue
        from sold_items si
        left join public.products p on p.id = si.product_id
        left join public.categories cat on cat.id = p.category_id
        left join public.categories parent on parent.id = cat.parent_id
        group by 1
      ) c
    ), '[]'::jsonb),
    'provinces', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', pv.name, 'orders', pv.n, 'revenue_paisa', pv.revenue) order by pv.revenue desc, pv.name)
      from (
        select coalesce(so.shipping_address ->> 'province_name', 'Unknown') as name,
               count(*) as n, sum(so.total_paisa) as revenue
        from sold_orders so
        group by 1
      ) pv
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_analytics_breakdown(date, date) from public, anon;
grant execute on function public.admin_analytics_breakdown(date, date) to authenticated;

/* ---------- Customer summaries ---------- */

-- Billed = collected COD only (AGENTS §4.9); pending = COD not yet collected
-- on orders that are still live.
create or replace function public.admin_customer_summaries(
  p_search text,
  p_sort text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid,
  full_name text,
  email text,
  phone_e164 text,
  created_at timestamptz,
  order_count integer,
  billed_paisa bigint,
  pending_paisa bigint,
  last_order_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pattern text;
begin
  if not public.has_permission('customers.read') then
    raise exception 'customers.read required' using errcode = '42501';
  end if;
  if p_sort is not null and p_sort not in ('newest', 'billed', 'orders', 'recent_order') then
    raise exception 'invalid sort' using errcode = '22023';
  end if;

  if nullif(btrim(p_search), '') is not null then
    v_pattern := '%' || replace(replace(replace(left(btrim(p_search), 64), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with matched as (
    select c.id, c.full_name, c.email, c.phone_e164, c.created_at
    from public.profiles c
    where c.role = 'customer'
      and c.deleted_at is null
      and (v_pattern is null or c.full_name ilike v_pattern or c.email ilike v_pattern)
  ),
  stats as (
    select
      m.*,
      coalesce(o.order_count, 0)::integer as order_count,
      coalesce(o.billed, 0)::bigint as billed_paisa,
      coalesce(o.pending, 0)::bigint as pending_paisa,
      o.last_order_at
    from matched m
    left join lateral (
      select
        count(*) as order_count,
        sum(x.total_paisa) filter (where x.payment_status = 'collected') as billed,
        sum(x.total_paisa) filter (where x.payment_status = 'pending' and x.status <> 'canceled') as pending,
        max(x.created_at) as last_order_at
      from public.orders x
      where x.user_id = m.id
    ) o on true
  )
  select
    s.id, s.full_name, s.email, s.phone_e164, s.created_at,
    s.order_count, s.billed_paisa, s.pending_paisa, s.last_order_at,
    count(*) over () as total_count
  from stats s
  order by
    case when p_sort = 'billed' then s.billed_paisa end desc nulls last,
    case when p_sort = 'orders' then s.order_count end desc nulls last,
    case when p_sort = 'recent_order' then s.last_order_at end desc nulls last,
    s.created_at desc,
    s.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_customer_summaries(text, text, integer, integer) from public, anon;
grant execute on function public.admin_customer_summaries(text, text, integer, integer) to authenticated;

/* ---------- Payments ledger (invoker: orders.read via RLS) ---------- */

create or replace function public.admin_payment_summary(p_from date, p_to date)
returns table (payment_status public.payment_status, order_count integer, total_paisa bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_permission('orders.read') then
    raise exception 'orders.read required' using errcode = '42501';
  end if;
  perform public.admin_assert_range(p_from, p_to);

  return query
  select o.payment_status, count(*)::integer, coalesce(sum(o.total_paisa), 0)::bigint
  from public.orders o
  where o.created_at >= public.npt_day_start(p_from)
    and o.created_at < public.npt_day_start(p_to + 1)
  group by o.payment_status
  order by o.payment_status;
end;
$$;

revoke execute on function public.admin_payment_summary(date, date) from public, anon;
grant execute on function public.admin_payment_summary(date, date) to authenticated;

/* ---------- Needs-attention counts (invoker; 0 without permission) ---------- */

create or replace function public.admin_attention_counts()
returns table (
  pending_orders integer,
  pending_reviews integer,
  low_stock_variants integer,
  sold_out_variants integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case when public.has_permission('orders.read') then (
      select count(*)::integer from public.orders o where o.status = 'pending_confirmation'
    ) else 0 end,
    case when public.has_permission('reviews.manage') then (
      select count(*)::integer from public.reviews r where r.status = 'pending'
    ) else 0 end,
    case when public.has_permission('catalog.read') then (
      select count(*)::integer
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.status = 'active' and v.is_active
        and v.stock_quantity > 0 and v.stock_quantity <= p.low_stock_threshold
    ) else 0 end,
    case when public.has_permission('catalog.read') then (
      select count(*)::integer
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.status = 'active' and v.is_active and v.stock_quantity = 0
    ) else 0 end
$$;

revoke execute on function public.admin_attention_counts() from public, anon;
grant execute on function public.admin_attention_counts() to authenticated;

/* ---------- Order status transitions ---------- */

-- pending_confirmation -> confirmed | canceled
-- confirmed            -> processing | canceled
-- processing           -> packed | canceled
-- packed               -> shipped (courier assigned) | canceled
-- shipped              -> delivered | canceled (returned to store)
-- delivered, canceled  -> terminal
--
-- Delivering records COD collection (cash is taken at the door). Canceling
-- marks payment failed and restocks the order's variants.
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

  v_allowed := case v_order.status
    when 'pending_confirmation' then p_status in ('confirmed', 'canceled')
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
    when 'confirmed' then
      update public.orders set status = p_status, confirmed_at = now() where id = p_order_id;

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

/* ---------- Courier assignment (invoker: orders.write via RLS) ---------- */

create or replace function public.admin_assign_courier(
  p_order_id uuid,
  p_courier_id uuid,
  p_tracking_number text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_courier public.couriers%rowtype;
  v_tracking text := nullif(upper(btrim(coalesce(p_tracking_number, ''))), '');
  v_service_id uuid;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmed', 'processing', 'packed') then
    raise exception 'A courier can be assigned only after confirmation and before shipping'
      using errcode = '22023';
  end if;

  select * into v_courier from public.couriers where id = p_courier_id and is_active;
  if not found then
    raise exception 'courier not found or inactive' using errcode = '22023';
  end if;

  if v_tracking is not null and v_tracking !~ '^[A-Z0-9-]{3,64}$' then
    raise exception 'Tracking numbers use letters, digits and dashes (3–64 characters)'
      using errcode = '22023';
  end if;

  -- Keep the purchased service when the chosen courier provides it.
  select cs.id into v_service_id
  from public.courier_services cs
  where cs.id = v_order.courier_service_id and cs.courier_id = p_courier_id;

  select * into v_shipment
  from public.shipments where order_id = p_order_id order by created_at limit 1 for update;

  if not found then
    insert into public.shipments (order_id, courier_id, courier_service_id, tracking_number, status, assigned_at)
    values (p_order_id, p_courier_id, v_service_id, v_tracking, 'assigned', now())
    returning * into v_shipment;
  else
    update public.shipments
    set courier_id = p_courier_id,
        courier_service_id = v_service_id,
        tracking_number = v_tracking,
        status = 'assigned',
        assigned_at = now()
    where id = v_shipment.id;
  end if;

  insert into public.shipment_events (shipment_id, status, message, source, occurred_at)
  values (
    v_shipment.id,
    'assigned',
    'Assigned to ' || v_courier.name
      || coalesce(' with tracking number ' || v_tracking, '') || '.',
    'staff',
    now()
  );
end;
$$;

revoke execute on function public.admin_assign_courier(uuid, uuid, text) from public, anon;
grant execute on function public.admin_assign_courier(uuid, uuid, text) to authenticated;

/* ---------- Tracking updates (invoker; never coordinates) ---------- */

create or replace function public.admin_add_shipment_event(
  p_order_id uuid,
  p_status public.shipment_status,
  p_message text,
  p_location text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_shipment_id uuid;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_location text := nullif(btrim(coalesce(p_location, '')), '');
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;
  if p_status not in ('in_transit', 'out_for_delivery', 'exception') then
    raise exception 'Only in-transit, out-for-delivery and exception updates can be added'
      using errcode = '22023';
  end if;
  if v_message is null or char_length(v_message) > 280 then
    raise exception 'A message (up to 280 characters) is required' using errcode = '22023';
  end if;
  if v_location is not null and char_length(v_location) > 120 then
    raise exception 'Location is limited to 120 characters' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'shipped' then
    raise exception 'Tracking updates can be added only while the order is shipped'
      using errcode = '22023';
  end if;

  update public.shipments set status = p_status
  where id = (select s.id from public.shipments s where s.order_id = p_order_id order by s.created_at limit 1)
  returning id into v_shipment_id;
  if v_shipment_id is null then
    raise exception 'shipment not found' using errcode = 'P0002';
  end if;

  insert into public.shipment_events (shipment_id, status, message, location_label, source, occurred_at)
  values (v_shipment_id, p_status, v_message, v_location, 'staff', now());
end;
$$;

revoke execute on function public.admin_add_shipment_event(uuid, public.shipment_status, text, text) from public, anon;
grant execute on function public.admin_add_shipment_event(uuid, public.shipment_status, text, text) to authenticated;

/* ---------- Refunds (invoker) ---------- */

-- Refunds do not restock: returned goods are inspected and restocked by hand.
create or replace function public.admin_mark_refunded(p_order_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.has_permission('orders.write') then
    raise exception 'orders.write required' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'delivered' or v_order.payment_status <> 'collected' then
    raise exception 'Only delivered orders with collected payment can be refunded'
      using errcode = '22023';
  end if;

  update public.orders
  set payment_status = 'refunded', refunded_at = now()
  where id = p_order_id;
end;
$$;

revoke execute on function public.admin_mark_refunded(uuid) from public, anon;
grant execute on function public.admin_mark_refunded(uuid) to authenticated;

/* ---------- Stock adjustment (invoker: inventory.write / catalog.write) ---------- */

-- A relative, atomic change: concurrent adjustments and future checkout
-- decrements serialize on the row lock, and stock never goes below zero.
create or replace function public.admin_adjust_stock(p_variant_id uuid, p_delta integer)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_quantity integer;
begin
  if not (public.has_permission('inventory.write') or public.has_permission('catalog.write')) then
    raise exception 'inventory.write required' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'Adjust by a whole number between -100000 and 100000 (not 0)'
      using errcode = '22023';
  end if;

  update public.product_variants
  set stock_quantity = stock_quantity + p_delta
  where id = p_variant_id and stock_quantity + p_delta >= 0
  returning stock_quantity into v_quantity;

  if v_quantity is null then
    if exists (select 1 from public.product_variants where id = p_variant_id) then
      raise exception 'Stock cannot go below zero' using errcode = '22023';
    end if;
    raise exception 'variant not found' using errcode = 'P0002';
  end if;

  return v_quantity;
end;
$$;

revoke execute on function public.admin_adjust_stock(uuid, integer) from public, anon;
grant execute on function public.admin_adjust_stock(uuid, integer) to authenticated;

/* ---------- Product status (invoker: catalog.write) ---------- */

create or replace function public.admin_set_product_status(
  p_product_id uuid,
  p_status public.product_status
)
returns public.product_status
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_status public.product_status;
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;

  update public.products
  set status = p_status,
      published_at = case when p_status = 'active' then coalesce(published_at, now()) else published_at end,
      archived_at = case
        when p_status = 'archived' then coalesce(archived_at, now())
        else null
      end
  where id = p_product_id
  returning status into v_status;

  if v_status is null then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  return v_status;
end;
$$;

revoke execute on function public.admin_set_product_status(uuid, public.product_status) from public, anon;
grant execute on function public.admin_set_product_status(uuid, public.product_status) to authenticated;

/* ---------- Read gaps for managers of inactive rows ---------- */

-- AR managers need to see (and re-enable) inactive assets; content managers
-- need inactive or scheduled collections. Both previously required catalog.read.
create policy "product_ar_assets: ar.manage read"
  on public.product_ar_assets for select to authenticated
  using ((select public.has_permission('ar.manage')));

create policy "collections: content.manage read"
  on public.collections for select to authenticated
  using ((select public.has_permission('content.manage')));

/* ---------- Indexes for admin lists ---------- */

create index reviews_pending_created_idx on public.reviews (created_at desc) where status = 'pending';
create index orders_payment_status_created_idx on public.orders (payment_status, created_at desc);
