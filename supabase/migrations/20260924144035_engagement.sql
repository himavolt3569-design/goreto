-- Customer addresses, reviews, wishlist and newsletter (AGENTS §11.4, §11.6).

create type public.review_status as enum ('pending', 'published', 'rejected');
create type public.newsletter_status as enum ('subscribed', 'unsubscribed');
create type public.newsletter_source as enum ('homepage', 'checkout', 'account');

/* ---------- Customer addresses ---------- */

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null check (recipient_name <> ''),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  province_code text not null references public.nepal_provinces (code) on delete restrict,
  district_code text not null references public.nepal_districts (code) on delete restrict,
  municipality_code text not null references public.nepal_municipalities (code) on delete restrict,
  ward smallint not null check (ward >= 1),
  street_landmark text not null check (street_landmark <> ''),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create index customer_addresses_user_id_idx on public.customer_addresses (user_id);
create unique index customer_addresses_one_default_idx
  on public.customer_addresses (user_id) where is_default;
create index customer_addresses_province_code_idx on public.customer_addresses (province_code);
create index customer_addresses_district_code_idx on public.customer_addresses (district_code);
create index customer_addresses_municipality_code_idx on public.customer_addresses (municipality_code);

create trigger customer_addresses_set_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

-- Province -> district -> municipality must agree, and the ward must exist.
create or replace function public.validate_customer_address()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ok boolean;
begin
  select exists (
    select 1
    from public.nepal_municipalities m
    join public.nepal_districts d on d.code = m.district_code
    where m.code = new.municipality_code
      and d.code = new.district_code
      and d.province_code = new.province_code
      and new.ward <= m.ward_count
  ) into ok;

  if not ok then
    raise exception 'Address hierarchy or ward is invalid'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_customer_address() from public, anon, authenticated;

create trigger customer_addresses_validate
  before insert or update on public.customer_addresses
  for each row execute function public.validate_customer_address();

/* ---------- Reviews ---------- */

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- Set for verified purchases.
  order_item_id uuid references public.order_items (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text not null check (char_length(body) between 1 and 4000),
  status public.review_status not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  moderation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index reviews_product_published_idx on public.reviews (product_id) where status = 'published';
create index reviews_order_item_id_idx on public.reviews (order_item_id);
create index reviews_moderated_by_idx on public.reviews (moderated_by);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

/* ---------- Wishlist ---------- */

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index wishlist_items_product_id_idx on public.wishlist_items (product_id);

/* ---------- Newsletter ---------- */

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email like '%_@_%'),
  profile_id uuid references public.profiles (id) on delete set null,
  status public.newsletter_status not null default 'subscribed',
  source public.newsletter_source not null,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  check ((status = 'unsubscribed') = (unsubscribed_at is not null))
);

create index newsletter_subscribers_profile_id_idx on public.newsletter_subscribers (profile_id);

/* ---------- RLS ---------- */

alter table public.customer_addresses enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.newsletter_subscribers enable row level security;

create policy "customer_addresses: own read"
  on public.customer_addresses for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "customer_addresses: own insert"
  on public.customer_addresses for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "customer_addresses: own update"
  on public.customer_addresses for update to authenticated
  using (user_id = (select public.current_profile_id()))
  with check (user_id = (select public.current_profile_id()));
create policy "customer_addresses: own delete"
  on public.customer_addresses for delete to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "customer_addresses: staff read"
  on public.customer_addresses for select to authenticated
  using ((select public.has_permission('customers.read')));

-- Published reviews reach shoppers only through the storefront read
-- functions, which expose ratings and first-name bylines, never user ids.
create policy "reviews: own read"
  on public.reviews for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "reviews: own create pending"
  on public.reviews for insert to authenticated
  with check (
    user_id = (select public.current_profile_id())
    and status = 'pending'
    and moderated_by is null
  );
create policy "reviews: staff read"
  on public.reviews for select to authenticated
  using ((select public.has_permission('reviews.manage')));
create policy "reviews: staff moderate"
  on public.reviews for update to authenticated
  using ((select public.has_permission('reviews.manage')))
  with check ((select public.has_permission('reviews.manage')));

create policy "wishlist_items: own read"
  on public.wishlist_items for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "wishlist_items: own insert"
  on public.wishlist_items for insert to authenticated
  with check (user_id = (select public.current_profile_id()));
create policy "wishlist_items: own delete"
  on public.wishlist_items for delete to authenticated
  using (user_id = (select public.current_profile_id()));

create policy "newsletter_subscribers: staff read"
  on public.newsletter_subscribers for select to authenticated
  using ((select public.has_permission('content.manage')));

grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;
grant select on public.newsletter_subscribers to authenticated;

grant all on all tables in schema public to service_role;
