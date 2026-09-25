-- Foundation: extensions, enums, profiles/staff, permission helpers, store
-- settings and Nepal geography (AGENTS §9, §11.1, §11.9, §15.5).
--
-- Identity comes from the Clerk session token via Supabase third-party auth:
-- the signed-in user is the profile whose clerk_user_id = auth.jwt()->>'sub'.
-- Never compare against auth.uid(). Tables are not auto-exposed to the Data
-- API (config.toml auto_expose_new_tables = false), so every table grants
-- exactly what its policies need.

create extension if not exists pg_trgm with schema extensions;

/* ---------- Enums ---------- */

create type public.profile_role as enum ('customer', 'owner', 'staff');

create type public.staff_permission as enum (
  'analytics.read',
  'catalog.read',
  'catalog.write',
  'inventory.write',
  'orders.read',
  'orders.write',
  'customers.read',
  'reviews.manage',
  'promotions.manage',
  'content.manage',
  'ar.manage',
  'delivery.manage',
  'settings.manage',
  'staff.manage'
);

create type public.municipality_type as enum (
  'metropolitan_city',
  'sub_metropolitan_city',
  'municipality',
  'rural_municipality'
);

/* ---------- Shared trigger ---------- */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

/* ---------- Profiles and staff ---------- */

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique check (clerk_user_id <> ''),
  full_name text,
  email text check (email is null or email = lower(email)),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role public.profile_role not null default 'customer',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where role <> 'customer';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.staff_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  permission_key public.staff_permission not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, permission_key)
);

create index staff_permissions_granted_by_idx on public.staff_permissions (granted_by);

/* ---------- Permission helpers ----------
 * security definer so policies on profiles/staff_permissions don't recurse.
 * Each helper answers only about the caller, from the verified JWT `sub`.
 * Fixed empty search_path; every reference is schema-qualified.
 */

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.clerk_user_id = (select auth.jwt() ->> 'sub')
    and p.deleted_at is null
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.clerk_user_id = (select auth.jwt() ->> 'sub')
      and p.deleted_at is null
      and p.role = 'owner'
  )
$$;

create or replace function public.has_permission(permission public.staff_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.clerk_user_id = (select auth.jwt() ->> 'sub')
      and p.deleted_at is null
      and (
        p.role = 'owner'
        or (
          p.role = 'staff'
          and exists (
            select 1
            from public.staff_permissions sp
            where sp.profile_id = p.id
              and sp.permission_key = permission
          )
        )
      )
  )
$$;

revoke execute on function public.current_profile_id() from public;
revoke execute on function public.is_owner() from public;
revoke execute on function public.has_permission(public.staff_permission) from public;
grant execute on function public.current_profile_id() to anon, authenticated, service_role;
grant execute on function public.is_owner() to anon, authenticated, service_role;
grant execute on function public.has_permission(public.staff_permission)
  to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.staff_permissions enable row level security;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = (select public.current_profile_id()));

create policy "profiles: staff read"
  on public.profiles for select to authenticated
  using ((select public.has_permission('customers.read')));

-- Only name and phone are user-writable (column grant below); role,
-- clerk_user_id, email and deleted_at are written by trusted server code.
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select public.current_profile_id()))
  with check (id = (select public.current_profile_id()));

create policy "staff_permissions: read own"
  on public.staff_permissions for select to authenticated
  using (profile_id = (select public.current_profile_id()));

create policy "staff_permissions: owner read"
  on public.staff_permissions for select to authenticated
  using ((select public.is_owner()));

create policy "staff_permissions: owner insert"
  on public.staff_permissions for insert to authenticated
  with check ((select public.is_owner()));

create policy "staff_permissions: owner delete"
  on public.staff_permissions for delete to authenticated
  using ((select public.is_owner()));

grant select on public.profiles to authenticated;
grant update (full_name, phone_e164) on public.profiles to authenticated;
grant select, insert, delete on public.staff_permissions to authenticated;

/* ---------- Nepal geography (reference data) ---------- */

create table public.nepal_provinces (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  number smallint not null unique check (number between 1 and 7),
  name text not null,
  sort_order smallint not null default 0
);

create table public.nepal_districts (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  province_code text not null references public.nepal_provinces (code) on delete restrict,
  name text not null,
  sort_order smallint not null default 0
);

create index nepal_districts_province_code_idx on public.nepal_districts (province_code);

create table public.nepal_municipalities (
  code text primary key check (code ~ '^[a-z0-9-]+$'),
  district_code text not null references public.nepal_districts (code) on delete restrict,
  name text not null,
  type public.municipality_type not null,
  ward_count smallint not null check (ward_count between 1 and 40),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  latitude numeric(9, 6) check (latitude is null or latitude between 26 and 31),
  longitude numeric(9, 6) check (longitude is null or longitude between 80 and 89)
);

create index nepal_municipalities_district_code_idx on public.nepal_municipalities (district_code);

alter table public.nepal_provinces enable row level security;
alter table public.nepal_districts enable row level security;
alter table public.nepal_municipalities enable row level security;

create policy "nepal_provinces: public read"
  on public.nepal_provinces for select to anon, authenticated using (true);
create policy "nepal_districts: public read"
  on public.nepal_districts for select to anon, authenticated using (true);
create policy "nepal_municipalities: public read"
  on public.nepal_municipalities for select to anon, authenticated using (true);

grant select on public.nepal_provinces, public.nepal_districts, public.nepal_municipalities
  to anon, authenticated;

/* ---------- Store settings (non-secret singleton) ---------- */

create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  store_name text not null,
  tagline text,
  support_email text,
  support_phone_e164 text
    check (support_phone_e164 is null or support_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  currency char(3) not null default 'NPR' check (currency = 'NPR'),
  timezone text not null default 'Asia/Kathmandu',
  country_code char(2) not null default 'NP',
  phone_country_code text not null default '+977',
  order_number_prefix text not null default 'GT' check (order_number_prefix ~ '^[A-Z]{2,4}$'),
  cod_enabled boolean not null default true,
  cod_max_order_paisa bigint check (cod_max_order_paisa is null or cod_max_order_paisa > 0),
  returns_window_days smallint not null default 7 check (returns_window_days >= 0),
  default_low_stock_threshold integer not null default 5 check (default_low_stock_threshold >= 0),
  dispatch_municipality_code text
    references public.nepal_municipalities (code) on delete set null,
  feature_flags jsonb not null default '{}' check (jsonb_typeof(feature_flags) = 'object'),
  social_links jsonb not null default '{}' check (jsonb_typeof(social_links) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index store_settings_dispatch_municipality_code_idx
  on public.store_settings (dispatch_municipality_code);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

create policy "store_settings: public read"
  on public.store_settings for select to anon, authenticated using (true);

create policy "store_settings: settings.manage update"
  on public.store_settings for update to authenticated
  using ((select public.has_permission('settings.manage')))
  with check ((select public.has_permission('settings.manage')));

grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;

grant all on all tables in schema public to service_role;
