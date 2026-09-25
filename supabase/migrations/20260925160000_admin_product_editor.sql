-- Product editor for the admin panel (AGENTS §4.7): create, edit and delete
-- products with their options, variants, specs, collection links and photo
-- order, each in one transaction.
--
-- Writes are security invoker, so the catalog RLS policies stay the
-- enforcement (catalog.write; content.manage for collection links). Two small
-- definer helpers answer "was this ordered?" for catalog staff, who cannot
-- read order_items under RLS; they return ids/booleans for one product only.
--
-- Stock of existing variants is never set here: it only moves through
-- admin_adjust_stock and checkout, so an edit can't overwrite a sale.

/* ---------- One variant per option combination ---------- */

-- Deferrable so a save that swaps two variants' combinations is checked at
-- commit, not halfway through.
alter table public.product_variants
  add constraint product_variants_product_option_values_key
  unique (product_id, option_values) deferrable initially immediate;

/* ---------- Order history helpers (definer: order_items is orders.read only) ---------- */

create or replace function public.admin_ordered_variant_ids(p_product_id uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;

  return query
  select distinct oi.variant_id
  from public.order_items oi
  join public.product_variants pv on pv.id = oi.variant_id
  where pv.product_id = p_product_id;
end;
$$;

revoke execute on function public.admin_ordered_variant_ids(uuid) from public, anon;
grant execute on function public.admin_ordered_variant_ids(uuid) to authenticated;

create or replace function public.admin_product_has_orders(p_product_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;

  return exists (select 1 from public.order_items oi where oi.product_id = p_product_id)
    or exists (
      select 1
      from public.order_items oi
      join public.product_variants pv on pv.id = oi.variant_id
      where pv.product_id = p_product_id
    );
end;
$$;

revoke execute on function public.admin_product_has_orders(uuid) from public, anon;
grant execute on function public.admin_product_has_orders(uuid) to authenticated;

/* ---------- Save (create or update) ---------- */

-- p_product: { title, slug, category_id, short_description, description,
--   base_price_paisa, compare_at_price_paisa, status, is_featured,
--   is_bestseller, is_limited_edition, low_stock_threshold, options, specs,
--   care_instructions, tags }
-- p_variants: [{ id?, sku, title?, option_values, price_paisa?, weight_grams?,
--   is_active, initial_stock }] in display order.
-- p_collection_ids: null leaves collection links untouched.
--
-- Validation errors are 22023 with a readable message; DETAIL names the form
-- field (e.g. "slug", "variants.2.sku") so the editor can show it inline.
create or replace function public.admin_save_product(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb,
  p_collection_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text := p_product ->> 'slug';
  v_previous_slug text;
  v_status public.product_status;
  v_options jsonb := coalesce(p_product -> 'options', '[]'::jsonb);
  v_option_names text[];
  v_count integer;
  v_payload_ids uuid[];
  v_kept uuid[] := '{}';
  v_ordered uuid[];
  v_deactivated text[];
  v_row record;
  v_variant_id uuid;
  v_sku text;
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_product) is distinct from 'object' or jsonb_typeof(p_variants) is distinct from 'array' then
    raise exception 'Invalid product payload' using errcode = '22023';
  end if;
  v_status := (p_product ->> 'status')::public.product_status;

  /* Options: [{ name, values: [{ value, label, swatch_hex? }] }] */
  if jsonb_typeof(v_options) <> 'array' or jsonb_array_length(v_options) > 3 then
    raise exception 'Use at most 3 options' using errcode = '22023', detail = 'options';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_options) o
    where coalesce(btrim(o ->> 'name'), '') = ''
      or jsonb_typeof(o -> 'values') is distinct from 'array'
      or jsonb_array_length(o -> 'values') not between 1 and 20
  ) then
    raise exception 'Each option needs a name and 1 to 20 values' using errcode = '22023', detail = 'options';
  end if;
  select coalesce(array_agg(o ->> 'name'), '{}') into v_option_names from jsonb_array_elements(v_options) o;
  if cardinality(v_option_names) <> (select count(distinct lower(n)) from unnest(v_option_names) n) then
    raise exception 'Option names must be different from each other' using errcode = '22023', detail = 'options';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_options) o, jsonb_array_elements(o -> 'values') v
    where coalesce(v ->> 'value', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(btrim(v ->> 'label'), '') = ''
      or (jsonb_typeof(v -> 'swatch_hex') = 'string' and (v ->> 'swatch_hex') !~ '^#[0-9a-fA-F]{6}$')
  ) then
    raise exception 'Each option value needs a label, and swatches use #RRGGBB' using errcode = '22023', detail = 'options';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_options) o
    where (select count(distinct v ->> 'value') from jsonb_array_elements(o -> 'values') v) <> jsonb_array_length(o -> 'values')
  ) then
    raise exception 'Option values must be different within an option' using errcode = '22023', detail = 'options';
  end if;

  /* Variants */
  v_count := jsonb_array_length(p_variants);
  if v_count not between 1 and 100 then
    raise exception 'A product needs 1 to 100 variants' using errcode = '22023', detail = 'variants';
  end if;
  if cardinality(v_option_names) = 0 and v_count <> 1 then
    raise exception 'A product without options has exactly one variant' using errcode = '22023', detail = 'variants';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_variants) v
    where jsonb_typeof(v -> 'option_values') is distinct from 'object'
      or (select coalesce(array_agg(k order by k), '{}') from jsonb_object_keys(v -> 'option_values') k)
         <> (select coalesce(array_agg(n order by n), '{}') from unnest(v_option_names) n)
      or exists (
        select 1 from jsonb_each(v -> 'option_values') e
        where jsonb_typeof(e.value) <> 'string'
          or not exists (
            select 1
            from jsonb_array_elements(v_options) o, jsonb_array_elements(o -> 'values') ov
            where o ->> 'name' = e.key and ov ->> 'value' = e.value #>> '{}'
          )
      )
  ) then
    raise exception 'Every variant needs one value for each option' using errcode = '22023', detail = 'variants';
  end if;
  if (select count(distinct v -> 'option_values') from jsonb_array_elements(p_variants) v) <> v_count then
    raise exception 'Two variants have the same option combination' using errcode = '22023', detail = 'variants';
  end if;
  if (select count(distinct v ->> 'sku') from jsonb_array_elements(p_variants) v) <> v_count then
    raise exception 'Each variant needs its own SKU' using errcode = '22023', detail = 'variants';
  end if;
  if v_status = 'active' and not exists (
    select 1 from jsonb_array_elements(p_variants) v where (v ->> 'is_active')::boolean
  ) then
    raise exception 'An active product needs at least one active variant' using errcode = '22023', detail = 'status';
  end if;

  /* Product */
  if exists (select 1 from public.products p where p.slug = v_slug and p.id is distinct from p_product_id) then
    raise exception 'Another product already uses this URL slug' using errcode = '22023', detail = 'slug';
  end if;

  if p_product_id is null then
    insert into public.products (
      category_id, title, slug, short_description, description,
      base_price_paisa, compare_at_price_paisa, status,
      is_featured, is_bestseller, is_limited_edition, low_stock_threshold,
      options, specs, care_instructions, tags, published_at, archived_at
    )
    values (
      (p_product ->> 'category_id')::uuid,
      p_product ->> 'title',
      v_slug,
      coalesce(p_product ->> 'short_description', ''),
      coalesce(p_product ->> 'description', ''),
      (p_product ->> 'base_price_paisa')::bigint,
      (p_product ->> 'compare_at_price_paisa')::bigint,
      v_status,
      coalesce((p_product ->> 'is_featured')::boolean, false),
      coalesce((p_product ->> 'is_bestseller')::boolean, false),
      coalesce((p_product ->> 'is_limited_edition')::boolean, false),
      (p_product ->> 'low_stock_threshold')::integer,
      v_options,
      coalesce(p_product -> 'specs', '[]'::jsonb),
      coalesce(p_product ->> 'care_instructions', ''),
      array(select jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb))),
      case when v_status = 'active' then now() end,
      case when v_status = 'archived' then now() end
    )
    returning id into v_id;
  else
    select p.slug into v_previous_slug from public.products p where p.id = p_product_id for update;
    update public.products p
    set category_id = (p_product ->> 'category_id')::uuid,
        title = p_product ->> 'title',
        slug = v_slug,
        short_description = coalesce(p_product ->> 'short_description', ''),
        description = coalesce(p_product ->> 'description', ''),
        base_price_paisa = (p_product ->> 'base_price_paisa')::bigint,
        compare_at_price_paisa = (p_product ->> 'compare_at_price_paisa')::bigint,
        status = v_status,
        is_featured = coalesce((p_product ->> 'is_featured')::boolean, false),
        is_bestseller = coalesce((p_product ->> 'is_bestseller')::boolean, false),
        is_limited_edition = coalesce((p_product ->> 'is_limited_edition')::boolean, false),
        low_stock_threshold = (p_product ->> 'low_stock_threshold')::integer,
        options = v_options,
        specs = coalesce(p_product -> 'specs', '[]'::jsonb),
        care_instructions = coalesce(p_product ->> 'care_instructions', ''),
        tags = array(select jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb))),
        published_at = case when v_status = 'active' then coalesce(p.published_at, now()) else p.published_at end,
        archived_at = case when v_status = 'archived' then coalesce(p.archived_at, now()) else null end
    where p.id = p_product_id
    returning p.id into v_id;

    if v_id is null then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  end if;

  /* Variants: update by id, reuse by combination, insert the rest */
  set constraints public.product_variants_product_option_values_key deferred;

  select coalesce(array_agg(nullif(v ->> 'id', '')::uuid) filter (where nullif(v ->> 'id', '') is not null), '{}')
  into v_payload_ids
  from jsonb_array_elements(p_variants) v;

  for v_row in
    select value as variant, (ordinality - 1)::integer as position
    from jsonb_array_elements(p_variants) with ordinality
  loop
    v_variant_id := nullif(v_row.variant ->> 'id', '')::uuid;
    v_sku := v_row.variant ->> 'sku';

    if v_variant_id is not null then
      if not exists (select 1 from public.product_variants pv where pv.id = v_variant_id and pv.product_id = v_id) then
        raise exception 'variant not found' using errcode = 'P0002', detail = format('variants.%s', v_row.position);
      end if;
    else
      -- A combination that was removed earlier (kept inactive because it was
      -- ordered) comes back as the same variant, with its stock and history.
      select pv.id into v_variant_id
      from public.product_variants pv
      where pv.product_id = v_id
        and pv.option_values = v_row.variant -> 'option_values'
        and pv.id <> all (v_payload_ids);
    end if;

    if exists (select 1 from public.product_variants pv where pv.sku = v_sku and pv.id is distinct from v_variant_id) then
      raise exception 'SKU % is already used by another variant', v_sku
        using errcode = '22023', detail = format('variants.%s.sku', v_row.position);
    end if;

    if v_variant_id is not null then
      update public.product_variants pv
      set sku = v_sku,
          title = nullif(btrim(v_row.variant ->> 'title'), ''),
          option_values = v_row.variant -> 'option_values',
          price_paisa = (v_row.variant ->> 'price_paisa')::bigint,
          weight_grams = (v_row.variant ->> 'weight_grams')::integer,
          is_active = (v_row.variant ->> 'is_active')::boolean,
          sort_order = v_row.position
      where pv.id = v_variant_id;
    else
      if coalesce((v_row.variant ->> 'initial_stock')::integer, 0) not between 0 and 100000 then
        raise exception 'Starting stock must be between 0 and 100000'
          using errcode = '22023', detail = format('variants.%s.initial_stock', v_row.position);
      end if;
      insert into public.product_variants (
        product_id, sku, title, option_values, price_paisa, weight_grams, is_active, sort_order, stock_quantity
      )
      values (
        v_id,
        v_sku,
        nullif(btrim(v_row.variant ->> 'title'), ''),
        v_row.variant -> 'option_values',
        (v_row.variant ->> 'price_paisa')::bigint,
        (v_row.variant ->> 'weight_grams')::integer,
        (v_row.variant ->> 'is_active')::boolean,
        v_row.position,
        coalesce((v_row.variant ->> 'initial_stock')::integer, 0)
      )
      returning id into v_variant_id;
    end if;

    v_kept := v_kept || v_variant_id;
  end loop;

  /* Variants left out: ordered ones become inactive, the rest are deleted */
  if p_product_id is not null then
    select coalesce(array_agg(id), '{}') into v_ordered from public.admin_ordered_variant_ids(v_id) as id;

    with deactivated as (
      update public.product_variants pv
      set is_active = false
      where pv.product_id = v_id and pv.id <> all (v_kept) and pv.id = any (v_ordered) and pv.is_active
      returning pv.sku
    )
    select coalesce(array_agg(sku order by sku), '{}') into v_deactivated from deactivated;

    -- Keep a removed variant's photos in the gallery (shared by all variants)
    -- instead of cascading them away with the variant.
    update public.product_media pm
    set variant_id = null
    where pm.product_id = v_id
      and pm.variant_id is not null
      and pm.variant_id <> all (v_kept)
      and pm.variant_id <> all (v_ordered);

    delete from public.product_variants pv
    where pv.product_id = v_id and pv.id <> all (v_kept) and pv.id <> all (v_ordered);
  end if;

  if v_status = 'active' and not exists (
    select 1 from public.product_variants pv where pv.product_id = v_id and pv.is_active
  ) then
    raise exception 'An active product needs at least one active variant' using errcode = '22023', detail = 'status';
  end if;

  set constraints public.product_variants_product_option_values_key immediate;

  /* Collections (content.manage) */
  if p_collection_ids is not null then
    if not public.has_permission('content.manage') then
      raise exception 'content.manage required to change collections' using errcode = '42501';
    end if;

    delete from public.collection_products cp
    where cp.product_id = v_id and cp.collection_id <> all (p_collection_ids);

    insert into public.collection_products (collection_id, product_id, sort_order)
    select c.id, v_id, coalesce((select max(cp.sort_order) + 1 from public.collection_products cp where cp.collection_id = c.id), 0)
    from (select distinct unnest(p_collection_ids) as id) c
    on conflict (collection_id, product_id) do nothing;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'previous_slug', v_previous_slug,
    'deactivated_skus', to_jsonb(coalesce(v_deactivated, '{}'))
  );
end;
$$;

revoke execute on function public.admin_save_product(uuid, jsonb, jsonb, uuid[]) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb, jsonb, uuid[]) to authenticated;

/* ---------- Delete (never-ordered products only) ---------- */

-- Returns the product's media object keys so the caller can remove the files.
-- Variants, media rows, AR assets, collection links, wishlist saves and
-- reviews cascade with the product.
create or replace function public.admin_delete_product(p_product_id uuid)
returns text[]
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_paths text[];
  v_deleted uuid;
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;

  perform 1 from public.products p where p.id = p_product_id for update;
  if public.admin_product_has_orders(p_product_id) then
    raise exception 'This product has orders. Archive it instead.' using errcode = '22023';
  end if;

  select coalesce(array_agg(pm.storage_path), '{}') into v_paths
  from public.product_media pm
  where pm.product_id = p_product_id;

  delete from public.products p where p.id = p_product_id returning p.id into v_deleted;
  if v_deleted is null then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  return v_paths;
end;
$$;

revoke execute on function public.admin_delete_product(uuid) from public, anon;
grant execute on function public.admin_delete_product(uuid) to authenticated;

/* ---------- Photo order ---------- */

create or replace function public.admin_reorder_product_media(p_product_id uuid, p_media_ids uuid[])
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;
  if p_media_ids is null
    or cardinality(p_media_ids) <> (select count(distinct m) from unnest(p_media_ids) m)
    or cardinality(p_media_ids) <> (select count(*) from public.product_media pm where pm.product_id = p_product_id)
    or exists (
      select 1 from unnest(p_media_ids) m
      where not exists (select 1 from public.product_media pm where pm.id = m and pm.product_id = p_product_id)
    )
  then
    raise exception 'The photo list changed. Refresh the page and try again.' using errcode = '22023';
  end if;

  update public.product_media pm
  set sort_order = (t.ordinality - 1)::integer
  from unnest(p_media_ids) with ordinality as t(id, ordinality)
  where pm.id = t.id;
end;
$$;

revoke execute on function public.admin_reorder_product_media(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reorder_product_media(uuid, uuid[]) to authenticated;

/* ---------- Status: publishing needs a purchasable variant ---------- */

-- Same signature and grants as admin_operations; adds the active-variant check
-- (the storefront needs at least one active variant to render a product).
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

  if p_status = 'active' and not exists (
    select 1 from public.product_variants pv where pv.product_id = p_product_id and pv.is_active
  ) then
    if exists (select 1 from public.products p where p.id = p_product_id) then
      raise exception 'Add an active variant before publishing this product' using errcode = '22023';
    end if;
    raise exception 'product not found' using errcode = 'P0002';
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
