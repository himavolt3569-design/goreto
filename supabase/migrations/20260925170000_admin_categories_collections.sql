-- Admin phase 2 (prompts/goreto-admin-categories-collections.md): create,
-- edit and delete categories and collections.
--
-- * Categories stay a two-level tree (the storefront, the admin Select and
--   the seed all assume it); a trigger makes that a database rule.
-- * admin_delete_category explains why a category can't be deleted instead
--   of surfacing a raw foreign-key error.
-- * admin_save_collection writes a collection and its ordered product links
--   in one transaction.
-- * content.manage staff can read every collection (not only live ones) and
--   upload hero images under collections/ in the product-media bucket.
--
-- Writes are security invoker, so the existing RLS policies (categories:
-- catalog.write; collections and links: content.manage) stay the enforcement.
-- Validation errors are 22023 with DETAIL naming the form field.

/* ---------- Two-level category tree ---------- */

-- Definer so the check sees hidden categories even when the caller can't.
create or replace function public.categories_enforce_two_levels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
    raise exception 'A subcategory can''t have its own subcategories. Choose a top-level category.'
      using errcode = '22023', detail = 'parentId';
  end if;
  if exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'This category has subcategories, so it has to stay top-level.'
      using errcode = '22023', detail = 'parentId';
  end if;
  return new;
end;
$$;

revoke execute on function public.categories_enforce_two_levels() from public, anon, authenticated;

create trigger categories_enforce_two_levels
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_enforce_two_levels();

/* ---------- Delete a category ---------- */

-- Only empty categories: no products (any status) and no subcategories.
-- Returns the image object key so the caller can remove the file.
create or replace function public.admin_delete_category(p_category_id uuid)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_image text;
  v_deleted uuid;
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;

  perform 1 from public.categories c where c.id = p_category_id for update;
  if exists (select 1 from public.categories c where c.parent_id = p_category_id) then
    raise exception 'This category has subcategories. Move or delete them first.' using errcode = '22023';
  end if;

  begin
    delete from public.categories c where c.id = p_category_id
    returning c.id, c.image_path into v_deleted, v_image;
  exception when foreign_key_violation or restrict_violation then
    -- products.category_id is ON DELETE RESTRICT; RLS may hide drafts from
    -- the caller, but the constraint sees every product.
    raise exception 'This category still has products. Move them to another category, or hide the category instead.'
      using errcode = '22023';
  end;

  if v_deleted is null then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  return v_image;
end;
$$;

revoke execute on function public.admin_delete_category(uuid) from public, anon;
grant execute on function public.admin_delete_category(uuid) to authenticated;

/* ---------- Save a collection and its products ---------- */

-- p_collection: { title, slug, eyebrow, description, hero_image_path,
--   hero_image_alt, sort_order, is_active, starts_at, ends_at }
-- p_product_ids: the collection's products in display order (replaces the
--   current links). Returns { id, slug, previous_slug }.
create or replace function public.admin_save_collection(
  p_collection_id uuid,
  p_collection jsonb,
  p_product_ids uuid[]
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text := p_collection ->> 'slug';
  v_previous_slug text;
  v_image text := nullif(p_collection ->> 'hero_image_path', '');
  v_starts timestamptz := nullif(p_collection ->> 'starts_at', '')::timestamptz;
  v_ends timestamptz := nullif(p_collection ->> 'ends_at', '')::timestamptz;
  v_ids uuid[] := coalesce(p_product_ids, '{}');
begin
  if not public.has_permission('content.manage') then
    raise exception 'content.manage required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_collection) is distinct from 'object' then
    raise exception 'Invalid collection payload' using errcode = '22023';
  end if;

  if coalesce(btrim(p_collection ->> 'title'), '') = '' then
    raise exception 'Enter a title' using errcode = '22023', detail = 'title';
  end if;
  if coalesce(v_slug, '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Use lowercase letters, digits and single dashes' using errcode = '22023', detail = 'slug';
  end if;
  if exists (select 1 from public.collections c where c.slug = v_slug and c.id is distinct from p_collection_id) then
    raise exception 'Another collection already uses this URL slug' using errcode = '22023', detail = 'slug';
  end if;
  if v_image is not null and coalesce(btrim(p_collection ->> 'hero_image_alt'), '') = '' then
    raise exception 'Describe the image for people using screen readers' using errcode = '22023', detail = 'heroImageAlt';
  end if;
  if v_starts is not null and v_ends is not null and v_ends <= v_starts then
    raise exception 'The end has to be after the start' using errcode = '22023', detail = 'endsAt';
  end if;
  if cardinality(v_ids) > 200 then
    raise exception 'Add at most 200 products' using errcode = '22023', detail = 'products';
  end if;
  if cardinality(v_ids) <> (select count(distinct i) from unnest(v_ids) i) then
    raise exception 'A product is listed twice' using errcode = '22023', detail = 'products';
  end if;

  if p_collection_id is null then
    insert into public.collections (
      title, slug, eyebrow, description, hero_image_path, hero_image_alt,
      sort_order, is_active, starts_at, ends_at
    )
    values (
      btrim(p_collection ->> 'title'),
      v_slug,
      coalesce(btrim(p_collection ->> 'eyebrow'), ''),
      coalesce(btrim(p_collection ->> 'description'), ''),
      v_image,
      coalesce(btrim(p_collection ->> 'hero_image_alt'), ''),
      coalesce((p_collection ->> 'sort_order')::integer, 0),
      coalesce((p_collection ->> 'is_active')::boolean, true),
      v_starts,
      v_ends
    )
    returning id into v_id;
  else
    select c.slug into v_previous_slug from public.collections c where c.id = p_collection_id for update;
    update public.collections c
    set title = btrim(p_collection ->> 'title'),
        slug = v_slug,
        eyebrow = coalesce(btrim(p_collection ->> 'eyebrow'), ''),
        description = coalesce(btrim(p_collection ->> 'description'), ''),
        hero_image_path = v_image,
        hero_image_alt = coalesce(btrim(p_collection ->> 'hero_image_alt'), ''),
        sort_order = coalesce((p_collection ->> 'sort_order')::integer, 0),
        is_active = coalesce((p_collection ->> 'is_active')::boolean, true),
        starts_at = v_starts,
        ends_at = v_ends
    where c.id = p_collection_id
    returning c.id into v_id;
    if v_id is null then
      raise exception 'collection not found' using errcode = 'P0002';
    end if;
  end if;

  /* Products, in order. Unknown ids fail the foreign key. */
  delete from public.collection_products cp
  where cp.collection_id = v_id and cp.product_id <> all (v_ids);

  begin
    insert into public.collection_products (collection_id, product_id, sort_order)
    select v_id, t.id, (t.ordinality - 1)::integer
    from unnest(v_ids) with ordinality as t(id, ordinality)
    on conflict (collection_id, product_id) do update set sort_order = excluded.sort_order;
  exception when foreign_key_violation then
    raise exception 'A product in the list no longer exists. Refresh the page.' using errcode = '22023', detail = 'products';
  end;

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'previous_slug', v_previous_slug);
end;
$$;

revoke execute on function public.admin_save_collection(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.admin_save_collection(uuid, jsonb, uuid[]) to authenticated;

/* ---------- content.manage sees every collection ---------- */

-- The public policy shows live collections, plus all of them to catalog.read.
-- Staff who manage collections need scheduled and switched-off ones too.
create policy "collections: content.manage read all"
  on public.collections for select to authenticated
  using ((select public.has_permission('content.manage')));

/* ---------- Hero images: content.manage may write collections/ ---------- */

create policy "product-media: content.manage select collections"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-media'
    and name like 'collections/%'
    and (select public.has_permission('content.manage'))
  );

create policy "product-media: content.manage insert collections"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-media'
    and name like 'collections/%'
    and (select public.has_permission('content.manage'))
  );

create policy "product-media: content.manage update collections"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-media'
    and name like 'collections/%'
    and (select public.has_permission('content.manage'))
  )
  with check (
    bucket_id = 'product-media'
    and name like 'collections/%'
    and (select public.has_permission('content.manage'))
  );

create policy "product-media: content.manage delete collections"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-media'
    and name like 'collections/%'
    and (select public.has_permission('content.manage'))
  );
