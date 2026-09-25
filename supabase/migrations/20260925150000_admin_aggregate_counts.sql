-- Database-side aggregates for admin figures that were summed in TypeScript
-- over a full table read, which PostgREST's row limit would silently
-- truncate: outstanding COD (payments page) and per-category product counts
-- (categories page).
--
-- Both are security invoker, so the caller's RLS applies to the underlying
-- rows exactly as on the tables.

/* ---------- Outstanding COD (invoker: orders.read) ---------- */

create or replace function public.admin_outstanding_cod()
returns table (order_count integer, total_paisa bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.has_permission('orders.read') then
    raise exception 'orders.read required' using errcode = '42501';
  end if;

  return query
  select count(*)::integer, coalesce(sum(o.total_paisa), 0)::bigint
  from public.orders o
  where o.payment_status = 'pending' and o.status <> 'canceled';
end;
$$;

revoke execute on function public.admin_outstanding_cod() from public, anon;
grant execute on function public.admin_outstanding_cod() to authenticated;

/* ---------- Products per category (invoker: RLS decides drafts) ---------- */

create or replace function public.admin_category_product_counts()
returns table (category_id uuid, product_count integer, active_product_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.category_id,
    count(*)::integer,
    (count(*) filter (where p.status = 'active'))::integer
  from public.products p
  group by p.category_id;
$$;

revoke execute on function public.admin_category_product_counts() from public, anon;
grant execute on function public.admin_category_product_counts() to authenticated;
