-- Customer account reads (AGENTS §4.9, §10.8): the signed-in customer's own
-- order figures and shipment history, aggregated in SQL.
--
-- Both are security invoker, so RLS still applies underneath. They also filter
-- on current_profile_id() explicitly: RLS alone would hand an owner or staff
-- member with orders.read every order in the store, and the account area is
-- about their own orders only.

/* ---------- Summary: counts, billed and pending COD ---------- */

-- Billed = collected COD only. Pending = COD not yet collected on a live
-- order. Canceled, failed and refunded orders are in neither total.
create or replace function public.account_summary()
returns table (
  order_count integer,
  in_progress_count integer,
  billed_paisa bigint,
  billed_order_count integer,
  pending_paisa bigint,
  pending_order_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::integer,
    (count(*) filter (where o.status not in ('delivered', 'canceled')))::integer,
    coalesce(sum(o.total_paisa) filter (where o.payment_status = 'collected'), 0)::bigint,
    (count(*) filter (where o.payment_status = 'collected'))::integer,
    coalesce(sum(o.total_paisa) filter (where o.payment_status = 'pending' and o.status <> 'canceled'), 0)::bigint,
    (count(*) filter (where o.payment_status = 'pending' and o.status <> 'canceled'))::integer
  from public.orders o
  where o.user_id = (select public.current_profile_id());
$$;

revoke execute on function public.account_summary() from public, anon;
grant execute on function public.account_summary() to authenticated;

/* ---------- Tracking history across the customer's orders ---------- */

create or replace function public.account_tracking_events(p_limit integer default 50)
returns table (
  order_number text,
  status public.shipment_status,
  message text,
  location_label text,
  occurred_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.order_number, e.status, e.message, e.location_label, e.occurred_at
  from public.shipment_events e
  join public.shipments s on s.id = e.shipment_id
  join public.orders o on o.id = s.order_id
  where o.user_id = (select public.current_profile_id())
  order by e.occurred_at desc, e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

revoke execute on function public.account_tracking_events(integer) from public, anon;
grant execute on function public.account_tracking_events(integer) to authenticated;
