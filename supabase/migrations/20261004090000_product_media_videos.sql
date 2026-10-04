-- Product videos and per-product media limits (prompts/goreto-admin-bulk-add-products.md).
--
-- * The product-media bucket also accepts MP4 and WebM. The bucket limit rises
--   to 50 MB for videos; photos stay capped at 10 MB by the app and the
--   server-side check of the stored bytes.
-- * A product holds at most 7 images and 3 videos, enforced by a trigger.
-- * Covers (search results) only ever use images.
-- * The unused-upload cleanup also recognises uploaded videos.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']
where id = 'product-media';

/* ---------- Limits ---------- */

create or replace function public.product_media_enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_limit integer := case when new.kind = 'video' then 3 else 7 end;
begin
  -- Serialise media changes per product so two uploads can't both pass the count.
  perform 1 from public.products p where p.id = new.product_id for update;

  select count(*) into v_count
  from public.product_media pm
  where pm.product_id = new.product_id
    and pm.kind = new.kind
    and pm.id <> new.id;

  if v_count >= v_limit then
    raise exception 'A product can have at most % %', v_limit, case when new.kind = 'video' then 'videos' else 'photos' end
      using errcode = '22023', detail = 'media';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_media_enforce_limits() from public, anon, authenticated;

create trigger product_media_enforce_limits
  before insert or update of product_id, kind on public.product_media
  for each row execute function public.product_media_enforce_limits();

/* ---------- Unused-upload cleanup: videos too ---------- */

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

/* ---------- Search covers: images only ---------- */

create or replace function public.search_products(
  q text default null,
  category_slug text default null,
  min_price_paisa bigint default null,
  max_price_paisa bigint default null,
  sort text default null,
  page_limit integer default 24,
  page_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  category_id uuid,
  base_price_paisa bigint,
  is_bestseller boolean,
  is_limited_edition boolean,
  published_at timestamptz,
  cover_path text,
  cover_alt text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive
  input as (
    select
      nullif(btrim(left(coalesce(q, ''), 64)), '') as term,
      least(greatest(coalesce(page_limit, 24), 1), 48) as page_size,
      least(greatest(coalesce(page_offset, 0), 0), 10000) as skip
  ),
  terms as (
    select
      i.*,
      case
        when sort in ('featured', 'newest', 'price-asc', 'price-desc') then sort
        when sort = 'relevance' and i.term is not null then 'relevance'
        when i.term is not null then 'relevance'
        else 'featured'
      end as sort_key,
      case when i.term is null then null else websearch_to_tsquery('english', i.term) end as words_q,
      (
        select to_tsquery('english', string_agg(w || ':*', ' & '))
        from unnest(regexp_split_to_array(lower(coalesce(i.term, '')), '[^a-z0-9]+')) as w
        where w <> ''
      ) as prefix_q
    from input i
  ),
  scope as (
    select c.id
    from public.categories c
    where c.slug = category_slug and c.is_active
    union
    select c.id
    from public.categories c
    join scope s on c.parent_id = s.id
    where c.is_active
  ),
  candidates as (
    select
      p.id, p.slug, p.title, p.category_id, p.base_price_paisa, p.is_bestseller,
      p.is_limited_edition, p.published_at, p.is_featured,
      p.search_vector || setweight(
        to_tsvector(
          'english',
          c.title || ' ' || coalesce(parent.title, '') || ' ' || array_to_string(p.tags, ' ')
        ),
        'D'
      ) as doc
    from public.products p
    join public.categories c on c.id = p.category_id and c.is_active
    left join public.categories parent on parent.id = c.parent_id
    where p.status = 'active'
      and (category_slug is null or p.category_id in (select s.id from scope s))
      and (min_price_paisa is null or p.base_price_paisa >= min_price_paisa)
      and (max_price_paisa is null or p.base_price_paisa <= max_price_paisa)
  ),
  matched as (
    select
      cand.*,
      t.sort_key,
      case
        when t.term is null then 0
        when lower(cand.title) = lower(t.term) then 2
        when starts_with(lower(cand.title), lower(t.term)) then 1
        else 0
      end as title_tier,
      case
        when t.term is null then 0
        else ts_rank(cand.doc, coalesce(t.words_q || t.prefix_q, t.words_q))
          + extensions.word_similarity(t.term, cand.title)
      end as score
    from candidates cand
    cross join terms t
    where t.term is null
       or cand.doc @@ t.words_q
       or (t.prefix_q is not null and cand.doc @@ t.prefix_q)
       or extensions.word_similarity(t.term, cand.title) >= 0.4
  ),
  page as (
    select m.*, count(*) over () as total_count
    from matched m
    order by
      case when m.sort_key = 'price-asc' then m.base_price_paisa end asc,
      case when m.sort_key = 'price-desc' then m.base_price_paisa end desc,
      case when m.sort_key = 'newest' then m.published_at end desc,
      case when m.sort_key = 'relevance' then m.title_tier end desc,
      case when m.sort_key = 'relevance' then m.score end desc,
      m.is_featured desc,
      m.published_at desc,
      m.slug
    limit (select page_size from input)
    offset (select skip from input)
  )
  select
    pg.id, pg.slug, pg.title, pg.category_id, pg.base_price_paisa, pg.is_bestseller,
    pg.is_limited_edition, pg.published_at, cover.storage_path, cover.alt_text, pg.total_count
  from page pg
  left join lateral (
    select pm.storage_path, pm.alt_text
    from public.product_media pm
    where pm.product_id = pg.id and pm.kind = 'image'
    order by pm.sort_order
    limit 1
  ) cover on true
  order by
    case when pg.sort_key = 'price-asc' then pg.base_price_paisa end asc,
    case when pg.sort_key = 'price-desc' then pg.base_price_paisa end desc,
    case when pg.sort_key = 'newest' then pg.published_at end desc,
    case when pg.sort_key = 'relevance' then pg.title_tier end desc,
    case when pg.sort_key = 'relevance' then pg.score end desc,
    pg.is_featured desc,
    pg.published_at desc,
    pg.slug
$$;

revoke execute on function public.search_products(text, text, bigint, bigint, text, integer, integer) from public;
grant execute on function public.search_products(text, text, bigint, bigint, text, integer, integer)
  to anon, authenticated, service_role;
