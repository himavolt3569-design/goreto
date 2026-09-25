-- Delivery configuration and coupons (AGENTS §11.5, §11.7).
-- Courier secrets never live here; they are environment variables.

create type public.courier_integration_mode as enum ('manual', 'api');
create type public.service_level as enum ('standard', 'express', 'pickup');
create type public.coupon_type as enum ('fixed', 'percentage');

/* ---------- Couriers and services ---------- */

create table public.couriers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_path text check (logo_path is null or logo_path !~ '^https?://'),
  support_phone text,
  website_url text check (website_url is null or website_url ~ '^https://'),
  integration_mode public.courier_integration_mode not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger couriers_set_updated_at
  before update on public.couriers
  for each row execute function public.set_updated_at();

create table public.courier_services (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers (id) on delete restrict,
  name text not null check (name <> ''),
  service_code text not null unique,
  service_level public.service_level not null,
  description text not null default '',
  estimated_min_days smallint not null check (estimated_min_days >= 0),
  estimated_max_days smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (estimated_max_days >= estimated_min_days)
);

create index courier_services_courier_id_idx on public.courier_services (courier_id);

create trigger courier_services_set_updated_at
  before update on public.courier_services
  for each row execute function public.set_updated_at();

/* ---------- Zones and rates ---------- */

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  -- nepal_districts.code values this zone covers.
  district_codes text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_zones_district_codes_idx on public.delivery_zones using gin (district_codes);

create trigger delivery_zones_set_updated_at
  before update on public.delivery_zones
  for each row execute function public.set_updated_at();

create table public.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.delivery_zones (id) on delete cascade,
  courier_service_id uuid not null references public.courier_services (id) on delete cascade,
  price_paisa bigint not null check (price_paisa >= 0),
  -- Override the service's estimate for this zone when set.
  estimated_min_days smallint check (estimated_min_days is null or estimated_min_days >= 0),
  estimated_max_days smallint,
  min_weight_grams integer check (min_weight_grams is null or min_weight_grams >= 0),
  max_weight_grams integer,
  min_order_paisa bigint check (min_order_paisa is null or min_order_paisa >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zone_id, courier_service_id),
  check (
    estimated_min_days is null
    or estimated_max_days is null
    or estimated_max_days >= estimated_min_days
  ),
  check (
    min_weight_grams is null
    or max_weight_grams is null
    or max_weight_grams >= min_weight_grams
  )
);

create index delivery_rates_courier_service_id_idx on public.delivery_rates (courier_service_id);

create trigger delivery_rates_set_updated_at
  before update on public.delivery_rates
  for each row execute function public.set_updated_at();

/* ---------- Coupons ---------- */

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,32}$'),
  description text not null default '',
  type public.coupon_type not null,
  percent_off smallint check (percent_off is null or percent_off between 1 and 100),
  amount_off_paisa bigint check (amount_off_paisa is null or amount_off_paisa > 0),
  min_order_paisa bigint check (min_order_paisa is null or min_order_paisa >= 0),
  max_discount_paisa bigint check (max_discount_paisa is null or max_discount_paisa > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_limit_per_customer integer check (usage_limit_per_customer is null or usage_limit_per_customer > 0),
  times_used integer not null default 0 check (times_used >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (type = 'percentage' and percent_off is not null and amount_off_paisa is null)
    or (type = 'fixed' and amount_off_paisa is not null and percent_off is null)
  )
);

create trigger coupons_set_updated_at
  before update on public.coupons
  for each row execute function public.set_updated_at();

/* ---------- RLS ---------- */

alter table public.couriers enable row level security;
alter table public.courier_services enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.delivery_rates enable row level security;
alter table public.coupons enable row level security;

-- Checkout needs active delivery options before sign-in, so they are public.
create policy "couriers: public read active"
  on public.couriers for select to anon, authenticated
  using (is_active or (select public.has_permission('delivery.manage')));
create policy "courier_services: public read active"
  on public.courier_services for select to anon, authenticated
  using (is_active or (select public.has_permission('delivery.manage')));
create policy "delivery_zones: public read active"
  on public.delivery_zones for select to anon, authenticated
  using (is_active or (select public.has_permission('delivery.manage')));
create policy "delivery_rates: public read active"
  on public.delivery_rates for select to anon, authenticated
  using (is_active or (select public.has_permission('delivery.manage')));

create policy "couriers: delivery.manage write"
  on public.couriers for all to authenticated
  using ((select public.has_permission('delivery.manage')))
  with check ((select public.has_permission('delivery.manage')));
create policy "courier_services: delivery.manage write"
  on public.courier_services for all to authenticated
  using ((select public.has_permission('delivery.manage')))
  with check ((select public.has_permission('delivery.manage')));
create policy "delivery_zones: delivery.manage write"
  on public.delivery_zones for all to authenticated
  using ((select public.has_permission('delivery.manage')))
  with check ((select public.has_permission('delivery.manage')));
create policy "delivery_rates: delivery.manage write"
  on public.delivery_rates for all to authenticated
  using ((select public.has_permission('delivery.manage')))
  with check ((select public.has_permission('delivery.manage')));

-- Coupons are validated server-side at order placement; shoppers never list them.
create policy "coupons: promotions.manage all"
  on public.coupons for all to authenticated
  using ((select public.has_permission('promotions.manage')))
  with check ((select public.has_permission('promotions.manage')));

grant select on
  public.couriers, public.courier_services, public.delivery_zones, public.delivery_rates
  to anon, authenticated;
grant insert, update, delete on
  public.couriers, public.courier_services, public.delivery_zones, public.delivery_rates
  to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;

grant all on all tables in schema public to service_role;
