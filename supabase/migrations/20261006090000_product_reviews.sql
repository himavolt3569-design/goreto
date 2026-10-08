-- Product reviews (AGENTS §4.2, §4.9, §11.4, §16): verified buyers write and
-- edit their own review, shoppers read published ones, customers delete their
-- own. Client decision 2026-10-06: only verified buyers may review, so every
-- new review must cite the reviewer's own delivered order item.

/* ---------- Writes: verified buyers only ---------- */

-- Replaces the verified_review_purchases policy, which still allowed a review
-- with no order item. Direct inserts now need the same proof as submit_review.
drop policy "reviews: own create pending" on public.reviews;

create policy "reviews: own create pending"
  on public.reviews for insert to authenticated
  with check (
    user_id = (select public.current_profile_id())
    and status = 'pending'
    and moderated_by is null
    and order_item_id is not null
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      -- Qualified: a bare product_id here would resolve to oi.product_id.
      where oi.id = reviews.order_item_id
        and oi.product_id = reviews.product_id
        and o.user_id = (select public.current_profile_id())
        and o.status = 'delivered'
    )
  );

-- Customers may remove their own review; nobody else's. The hosted dev
-- database already had a policy of this name created outside migrations, so
-- it's replaced with this definition rather than assumed absent.
drop policy if exists "reviews: own delete" on public.reviews;
create policy "reviews: own delete"
  on public.reviews for delete to authenticated
  using (user_id = (select public.current_profile_id()));

grant delete on public.reviews to authenticated;

-- The app's single write path. security definer because an edit must reset
-- status and moderation fields the caller can't write directly; the reviewer
-- and the order item are derived here, never taken from the browser.
--
-- A real change (rating, title or body) goes back to moderation and drops off
-- the storefront until published again. An unchanged resubmit is a no-op.
create or replace function public.submit_review(
  p_product_slug text,
  p_rating smallint,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_product uuid;
  v_item uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_profile is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if v_title is not null and char_length(v_title) > 120 then
    raise exception 'invalid_title' using errcode = '22023';
  end if;
  if char_length(v_body) not between 10 and 2000 then
    raise exception 'invalid_body' using errcode = '22023';
  end if;

  select p.id into v_product
  from public.products p
  where p.slug = p_product_slug and p.status = 'active';
  if v_product is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  select oi.id into v_item
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.user_id = v_profile
    and o.status = 'delivered'
    and oi.product_id = v_product
  order by o.delivered_at desc nulls last, o.created_at desc, oi.id
  limit 1;
  if v_item is null then
    raise exception 'not_a_verified_buyer' using errcode = '42501';
  end if;

  insert into public.reviews as r (user_id, product_id, order_item_id, rating, title, body)
  values (v_profile, v_product, v_item, p_rating, v_title, v_body)
  on conflict (user_id, product_id) do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        order_item_id = excluded.order_item_id,
        status = 'pending',
        moderated_by = null,
        moderated_at = null,
        moderation_note = null
    where (r.rating, r.title, r.body) is distinct from (excluded.rating, excluded.title, excluded.body)
  returning r.id into v_id;

  -- Unchanged resubmit: the conflict update was skipped, so nothing returned.
  if v_id is null then
    select r.id into v_id from public.reviews r where r.user_id = v_profile and r.product_id = v_product;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.submit_review(text, smallint, text, text) from public, anon;
grant execute on function public.submit_review(text, smallint, text, text) to authenticated;

/* ---------- Public reads: published reviews of active products ---------- */

-- Same deliberate public surface as storefront_reads: no profile, order or
-- product ids, and a first-name byline ("Priya S."). Deleted or nameless
-- profiles read "Goreto customer". Inputs are bounded.
create or replace function public.product_reviews(
  p_product_slug text,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  review_id uuid,
  rating smallint,
  title text,
  body text,
  author_name text,
  verified boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.rating,
         r.title,
         r.body,
         coalesce(
           nullif(
             split_part(btrim(pr.full_name), ' ', 1)
               || coalesce(' ' || nullif(left(split_part(btrim(pr.full_name), ' ', 2), 1), '') || '.', ''),
             ''
           ),
           'Goreto customer'
         ),
         r.order_item_id is not null,
         r.created_at
  from public.reviews r
  join public.products p on p.id = r.product_id
  left join public.profiles pr on pr.id = r.user_id and pr.deleted_at is null
  where p.slug = p_product_slug
    and p.status = 'active'
    and r.status = 'published'
  order by r.created_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 10), 50))
  offset greatest(0, least(coalesce(p_offset, 0), 10000))
$$;

-- Review count per star rating, for the 5 → 1 bars. Ratings with no reviews
-- are absent; the app fills them in.
create or replace function public.product_rating_breakdown(p_product_slug text)
returns table (rating smallint, review_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.rating, count(*)::integer
  from public.reviews r
  join public.products p on p.id = r.product_id
  where p.slug = p_product_slug
    and p.status = 'active'
    and r.status = 'published'
  group by r.rating
$$;

revoke execute on function public.product_reviews(text, integer, integer) from public;
revoke execute on function public.product_rating_breakdown(text) from public;
grant execute on function public.product_reviews(text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.product_rating_breakdown(text) to anon, authenticated, service_role;

/* ---------- Account read: what the customer can review next ---------- */

-- Active products from the caller's own delivered orders that they haven't
-- reviewed yet, newest delivery first. security invoker, so RLS applies; the
-- explicit profile filter keeps owners and staff (who can read every order)
-- to their own purchases, as in account_reads.
create or replace function public.account_reviewable_products()
returns table (
  product_id uuid,
  slug text,
  title text,
  image_path text,
  delivered_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.product_id, t.slug, t.title, t.image_path, t.delivered_at
  from (
    select distinct on (p.id)
           p.id as product_id,
           p.slug,
           p.title,
           oi.image_path,
           coalesce(o.delivered_at, o.updated_at) as delivered_at
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.products p on p.id = oi.product_id and p.status = 'active'
    where o.user_id = (select public.current_profile_id())
      and o.status = 'delivered'
      and not exists (
        select 1 from public.reviews r
        where r.user_id = o.user_id and r.product_id = p.id
      )
    order by p.id, coalesce(o.delivered_at, o.updated_at) desc
  ) t
  order by t.delivered_at desc, t.product_id
  limit 20
$$;

revoke execute on function public.account_reviewable_products() from public, anon;
grant execute on function public.account_reviewable_products() to authenticated;
