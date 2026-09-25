-- Inventory list for the admin panel: one row per variant with its product,
-- category and stock state against the product's own low-stock threshold (a
-- cross-column comparison PostgREST filters can't express).
--
-- security_invoker: the caller's RLS applies to every underlying table, so
-- staff see drafts only with catalog.read, exactly as on the tables.

create view public.admin_inventory
with (security_invoker = true)
as
select
  v.id as variant_id,
  v.sku,
  v.title as variant_title,
  v.option_values,
  v.stock_quantity,
  v.is_active as variant_active,
  v.updated_at,
  p.id as product_id,
  p.title as product_title,
  p.slug as product_slug,
  p.status as product_status,
  p.low_stock_threshold,
  c.title as category_title,
  case
    when v.stock_quantity = 0 then 'sold_out'
    when v.stock_quantity <= p.low_stock_threshold then 'low_stock'
    else 'in_stock'
  end as stock_state
from public.product_variants v
join public.products p on p.id = v.product_id
left join public.categories c on c.id = p.category_id;

revoke all on public.admin_inventory from public, anon, authenticated;
grant select on public.admin_inventory to authenticated;
grant select on public.admin_inventory to service_role;
