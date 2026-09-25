-- Storage for catalog imagery (AGENTS §10.4): product, category and
-- collection photos. Public read via public object URLs; writes only for the
-- owner or catalog.write staff. Customer try-on photos will get their own
-- private bucket in the AR task; never put them here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

-- Upsert needs select + insert + update.
create policy "product-media: catalog.write select"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-media' and (select public.has_permission('catalog.write')));

create policy "product-media: catalog.write insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media' and (select public.has_permission('catalog.write')));

create policy "product-media: catalog.write update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-media' and (select public.has_permission('catalog.write')))
  with check (bucket_id = 'product-media' and (select public.has_permission('catalog.write')));

create policy "product-media: catalog.write delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-media' and (select public.has_permission('catalog.write')));
