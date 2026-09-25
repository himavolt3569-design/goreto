-- A review may cite an order item only if it proves a real purchase: the
-- item belongs to the reviewer's own delivered order and is the reviewed
-- product. Without this, a customer could attach any order_item_id (even
-- another customer's) and appear as a verified purchase, which is what
-- storefront_testimonials trusts. Reviews without an order item stay allowed.
--
-- The subquery runs with the caller's RLS, so only their own orders are
-- visible to it anyway; the explicit user check keeps the intent readable.

drop policy "reviews: own create pending" on public.reviews;

create policy "reviews: own create pending"
  on public.reviews for insert to authenticated
  with check (
    user_id = (select public.current_profile_id())
    and status = 'pending'
    and moderated_by is null
    and (
      order_item_id is null
      or exists (
        select 1
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        -- Qualified: a bare product_id here would resolve to oi.product_id.
        where oi.id = reviews.order_item_id
          and oi.product_id = reviews.product_id
          and o.user_id = (select public.current_profile_id())
          and o.status = 'delivered'
      )
    )
  );
