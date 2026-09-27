-- Admin follow-ups (prompts/goreto-admin-media-ar.md): AR asset upload and
-- orphaned-upload cleanup.
--
-- * ar-assets: a public bucket for try-on overlays and 3D models, written by
--   ar.manage only. Customer try-on photos never go here (AGENTS §10.4).
-- * product_ar_assets: the file format must suit the try-on mode, and a
--   variant-specific asset must use a variant of the same product.
-- * admin_orphaned_storage_objects lists admin uploads no row references,
--   so staff can delete them through the Storage API (Supabase blocks direct
--   deletes from storage.objects).

/* ---------- AR asset bucket ---------- */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ar-assets',
  'ar-assets',
  true,
  26214400,
  array['image/png', 'image/webp', 'model/gltf-binary', 'model/vnd.usdz+zip']
)
on conflict (id) do nothing;

create policy "ar-assets: ar.manage select"
  on storage.objects for select to authenticated
  using (bucket_id = 'ar-assets' and (select public.has_permission('ar.manage')));

create policy "ar-assets: ar.manage insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ar-assets' and (select public.has_permission('ar.manage')));

create policy "ar-assets: ar.manage update"
  on storage.objects for update to authenticated
  using (bucket_id = 'ar-assets' and (select public.has_permission('ar.manage')))
  with check (bucket_id = 'ar-assets' and (select public.has_permission('ar.manage')));

create policy "ar-assets: ar.manage delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'ar-assets' and (select public.has_permission('ar.manage')));

/* ---------- AR asset rules ---------- */

-- 2D overlays and photo try-on garments are images; live 3D is a model.
alter table public.product_ar_assets
  add constraint product_ar_assets_mode_format_check check (
    (mode in ('live_2d', 'photo_ai') and asset_format in ('png', 'webp'))
    or (mode = 'live_3d' and asset_format in ('glb', 'gltf', 'usdz'))
  ) not valid;

alter table public.product_ar_assets validate constraint product_ar_assets_mode_format_check;

-- Definer so the check sees the variant even when RLS hides it from the caller.
create or replace function public.product_ar_assets_enforce_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.variant_id is not null and not exists (
    select 1 from public.product_variants v where v.id = new.variant_id and v.product_id = new.product_id
  ) then
    raise exception 'That variant belongs to another product.' using errcode = '22023', detail = 'variantId';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_ar_assets_enforce_variant() from public, anon, authenticated;

create trigger product_ar_assets_enforce_variant
  before insert or update of product_id, variant_id on public.product_ar_assets
  for each row execute function public.product_ar_assets_enforce_variant();

/* ---------- Orphaned uploads ---------- */

-- Admin uploads older than p_older_than that no row references. Only keys
-- the server hands out are considered: `<folder>/[new-]<uuid>/<uuid>.<ext>`.
-- Seed files and anything else in the buckets are never listed.
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
  select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
  from storage.objects o
  where o.bucket_id = p_bucket
    and o.created_at < now() - p_older_than
    and (
      (p_bucket = 'product-media'
        and o.name ~ '^(products|categories|collections)/(new-)?[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|avif)$'
        and not exists (select 1 from public.product_media m where m.storage_path = o.name)
        and not exists (select 1 from public.categories c where c.image_path = o.name)
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
