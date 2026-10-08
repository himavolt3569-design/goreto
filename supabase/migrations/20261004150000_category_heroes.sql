-- Per-category hero banners (prompts/goreto-poppins-heroes-sponsors.md, phase B).
-- Additive: new columns with defaults, so existing rows need no backfill. The
-- existing categories RLS (public read of active rows, catalog.write writes)
-- and table grants already cover the new columns.

alter table public.categories
  add column hero_image_path text
    check (hero_image_path is null or hero_image_path !~ '^https?://'),
  add column hero_image_alt text not null default '' check (char_length(hero_image_alt) <= 200),
  add column hero_eyebrow text not null default '' check (char_length(hero_eyebrow) <= 40),
  add column hero_title text not null default '' check (char_length(hero_title) <= 80),
  add column hero_text text not null default '' check (char_length(hero_text) <= 240);

comment on column public.categories.hero_image_path is
  'Hero banner on /categories/<slug>; null shows the plain heading. An empty hero_title falls back to title.';

/* ---------- Unused-upload cleanup: keep category hero images ---------- */

create or replace function public.admin_orphaned_storage_objects(
  p_bucket text,
  p_older_than interval default interval '24 hours'
)
returns table (name text, size_bytes bigint, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket = 'product-media' then
    if not public.has_permission('catalog.write') then
      raise exception 'catalog.write required' using errcode = '42501';
    end if;
  elsif p_bucket = 'ar-assets' then
    if not public.has_permission('ar.manage') then
      raise exception 'ar.manage required' using errcode = '42501';
    end if;
  else
    raise exception 'Unknown bucket' using errcode = '22023';
  end if;

  if p_older_than < interval '1 hour' then
    raise exception 'Uploads younger than an hour may still be in use' using errcode = '22023';
  end if;

  return query
  select
    o.name,
    -- Storage writes the size, but never let a missing or malformed value
    -- (text, a fraction, a number beyond bigint) break the whole listing.
    case when (o.metadata ->> 'size') ~ '^[0-9]{1,18}$' then (o.metadata ->> 'size')::bigint else 0 end,
    o.created_at
  from storage.objects o
  where o.bucket_id = p_bucket
    and o.created_at < now() - p_older_than
    and (
      (p_bucket = 'product-media'
        and o.name ~ '^(products|categories|collections)/(new-)?[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif|mp4|webm)$'
        and not exists (select 1 from public.product_media m where m.storage_path = o.name)
        and not exists (select 1 from public.categories c where c.image_path = o.name or c.hero_image_path = o.name)
        and not exists (select 1 from public.collections c where c.hero_image_path = o.name))
      or (p_bucket = 'ar-assets'
        and o.name ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|webp|glb|usdz)$'
        and not exists (select 1 from public.product_ar_assets a where a.asset_path = o.name))
    )
  order by o.created_at, o.name;
end;
$$;

revoke execute on function public.admin_orphaned_storage_objects(text, interval) from public, anon;
grant execute on function public.admin_orphaned_storage_objects(text, interval) to authenticated;
