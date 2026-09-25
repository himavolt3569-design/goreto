-- Public storefront reads over reviews.
--
-- Reviews are not directly readable by shoppers (their rows carry profile and
-- order ids). These two functions are the deliberate public surface: they
-- return only aggregates and first-name bylines for published reviews of
-- active products. security definer with an empty search_path; inputs are
-- bounded.

create or replace function public.product_rating_summaries(product_ids uuid[])
returns table (product_id uuid, rating_avg numeric, rating_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.product_id,
         round(avg(r.rating)::numeric, 1) as rating_avg,
         count(*)::integer as rating_count
  from public.reviews r
  join public.products p on p.id = r.product_id
  where r.status = 'published'
    and p.status = 'active'
    and r.product_id = any (product_ids[1:500])
  group by r.product_id
$$;

create or replace function public.storefront_testimonials(max_count integer default 3)
returns table (
  review_id uuid,
  quote text,
  author_name text,
  product_title text,
  product_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.review_id, t.quote, t.author_name, t.product_title, t.product_slug
  from (
    select distinct on (r.product_id)
           r.id as review_id,
           r.body as quote,
           -- "Priya Shrestha" -> "Priya S."
           split_part(btrim(pr.full_name), ' ', 1)
             || coalesce(' ' || nullif(left(split_part(btrim(pr.full_name), ' ', 2), 1), '') || '.', '')
             as author_name,
           p.title as product_title,
           p.slug as product_slug,
           r.created_at
    from public.reviews r
    join public.products p on p.id = r.product_id and p.status = 'active'
    join public.profiles pr on pr.id = r.user_id and pr.deleted_at is null
    where r.status = 'published'
      and r.rating = 5
      and r.order_item_id is not null
      and pr.full_name is not null
      and char_length(r.body) between 60 and 280
    order by r.product_id, r.created_at desc
  ) t
  order by t.created_at desc
  limit least(greatest(coalesce(max_count, 3), 1), 12)
$$;

revoke execute on function public.product_rating_summaries(uuid[]) from public;
revoke execute on function public.storefront_testimonials(integer) from public;
grant execute on function public.product_rating_summaries(uuid[]) to anon, authenticated, service_role;
grant execute on function public.storefront_testimonials(integer) to anon, authenticated, service_role;
