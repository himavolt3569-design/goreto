-- Sponsored products (prompts/goreto-poppins-heroes-sponsors.md, phase C).
-- Staff flag a product as sponsored; the storefront marks it with a tick and
-- lists it in a homepage section. Additive column with a default, so nothing
-- to backfill. Writes ride the existing products policies (catalog.write via
-- the product editor, content.manage via the flag toggle like is_featured);
-- reads follow the existing public read of active products.

alter table public.products
  add column is_sponsored boolean not null default false;

create index products_sponsored_idx on public.products (published_at desc)
  where is_sponsored and status = 'active';

/* ---------- Search results carry the flag (return type changes) ---------- */

drop function public.search_products(text, text, bigint, bigint, text, integer, integer);

create function public.search_products(
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
  is_sponsored boolean,
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
      p.is_limited_edition, p.is_sponsored, p.published_at, p.is_featured,
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
    pg.is_limited_edition, pg.is_sponsored, pg.published_at, cover.storage_path, cover.alt_text, pg.total_count
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
