-- Catalog: categories, products, variants, media, AR assets, collections
-- (AGENTS §11.2, §11.3). Money is integer paisa.
--
-- Public (anon + authenticated) sees active rows only. Owner or staff with
-- catalog.read see drafts; catalog.write changes the catalog; inventory.write
-- may also update variants (stock).

create type public.product_status as enum ('draft', 'active', 'archived');
create type public.media_kind as enum ('image', 'video');
create type public.ar_mode as enum ('live_2d', 'live_3d', 'photo_ai');
create type public.ar_placement as enum (
  'ear', 'face', 'neck', 'wrist', 'hand', 'upper_body', 'full_body', 'freeform'
);

/* ---------- Categories ---------- */

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  title text not null check (title <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_id_idx on public.categories (parent_id);
create index categories_active_sort_idx on public.categories (sort_order) where is_active;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

/* ---------- Products ---------- */

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null check (title <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text not null default '',
  description text not null default '',
  base_price_paisa bigint not null check (base_price_paisa >= 0),
  compare_at_price_paisa bigint,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  is_bestseller boolean not null default false,
  is_limited_edition boolean not null default false,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  -- [{name, values: [{value, label, swatch_hex?}]}]
  options jsonb not null default '[]' check (jsonb_typeof(options) = 'array'),
  -- [{label, value}]
  specs jsonb not null default '[]' check (jsonb_typeof(specs) = 'array'),
  care_instructions text not null default '',
  tags text[] not null default '{}',
  published_at timestamptz,
  archived_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(short_description, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (compare_at_price_paisa is null or compare_at_price_paisa > base_price_paisa),
  check (status <> 'active' or published_at is not null)
);

create index products_category_id_idx on public.products (category_id);
create index products_active_featured_idx on public.products (published_at desc)
  where status = 'active' and is_featured;
create index products_status_published_idx on public.products (status, published_at desc);
create index products_search_vector_idx on public.products using gin (search_vector);
create index products_title_trgm_idx on public.products using gin (title extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

/* ---------- Variants ---------- */

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  title text,
  -- {"Color": "tan", "Size": "m"}
  option_values jsonb not null default '{}' check (jsonb_typeof(option_values) = 'object'),
  price_paisa bigint check (price_paisa is null or price_paisa >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_id_idx on public.product_variants (product_id, sort_order);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

/* ---------- Media ---------- */

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  kind public.media_kind not null default 'image',
  -- Object key in the product-media bucket, never a URL.
  storage_path text not null unique check (storage_path !~ '^https?://'),
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_media_product_id_idx on public.product_media (product_id, sort_order);
create index product_media_variant_id_idx on public.product_media (variant_id);

/* ---------- AR assets ---------- */

create table public.product_ar_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  mode public.ar_mode not null,
  placement public.ar_placement not null,
  asset_path text not null check (asset_path !~ '^https?://'),
  asset_format text not null check (asset_format in ('png', 'webp', 'glb', 'gltf', 'usdz')),
  -- Documented transform/anchor metadata only.
  calibration jsonb not null default '{}' check (jsonb_typeof(calibration) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_ar_assets_product_id_idx on public.product_ar_assets (product_id);
create index product_ar_assets_variant_id_idx on public.product_ar_assets (variant_id);

create trigger product_ar_assets_set_updated_at
  before update on public.product_ar_assets
  for each row execute function public.set_updated_at();

/* ---------- Collections ---------- */

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  eyebrow text not null default '',
  title text not null check (title <> ''),
  description text not null default '',
  hero_image_path text check (hero_image_path is null or hero_image_path !~ '^https?://'),
  hero_image_alt text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index collections_active_sort_idx on public.collections (sort_order) where is_active;

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (collection_id, product_id)
);

create index collection_products_product_id_idx on public.collection_products (product_id);

/* ---------- RLS ---------- */

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;
alter table public.product_ar_assets enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

-- Reads

create policy "categories: public read active"
  on public.categories for select to anon, authenticated
  using (is_active or (select public.has_permission('catalog.read')));

create policy "products: public read active"
  on public.products for select to anon, authenticated
  using (status = 'active' or (select public.has_permission('catalog.read')));

create policy "product_variants: public read active"
  on public.product_variants for select to anon, authenticated
  using (
    (
      is_active
      and exists (
        select 1 from public.products p
        where p.id = product_id and p.status = 'active'
      )
    )
    or (select public.has_permission('catalog.read'))
  );

create policy "product_media: public read active"
  on public.product_media for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
    or (select public.has_permission('catalog.read'))
  );

create policy "product_ar_assets: public read active"
  on public.product_ar_assets for select to anon, authenticated
  using (
    (
      is_active
      and exists (
        select 1 from public.products p
        where p.id = product_id and p.status = 'active'
      )
    )
    or (select public.has_permission('catalog.read'))
  );

create policy "collections: public read live"
  on public.collections for select to anon, authenticated
  using (
    (
      is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
    or (select public.has_permission('catalog.read'))
  );

create policy "collection_products: public read"
  on public.collection_products for select to anon, authenticated
  using (true);

-- Writes: catalog.write (variants also inventory.write, AR assets also ar.manage)

create policy "categories: catalog.write insert"
  on public.categories for insert to authenticated
  with check ((select public.has_permission('catalog.write')));
create policy "categories: catalog.write update"
  on public.categories for update to authenticated
  using ((select public.has_permission('catalog.write')))
  with check ((select public.has_permission('catalog.write')));
create policy "categories: catalog.write delete"
  on public.categories for delete to authenticated
  using ((select public.has_permission('catalog.write')));

create policy "products: catalog.write insert"
  on public.products for insert to authenticated
  with check ((select public.has_permission('catalog.write')));
create policy "products: catalog.write update"
  on public.products for update to authenticated
  using ((select public.has_permission('catalog.write')))
  with check ((select public.has_permission('catalog.write')));
create policy "products: catalog.write delete"
  on public.products for delete to authenticated
  using ((select public.has_permission('catalog.write')));

create policy "product_variants: catalog.write insert"
  on public.product_variants for insert to authenticated
  with check ((select public.has_permission('catalog.write')));
create policy "product_variants: catalog or inventory update"
  on public.product_variants for update to authenticated
  using (
    (select public.has_permission('catalog.write'))
    or (select public.has_permission('inventory.write'))
  )
  with check (
    (select public.has_permission('catalog.write'))
    or (select public.has_permission('inventory.write'))
  );
create policy "product_variants: catalog.write delete"
  on public.product_variants for delete to authenticated
  using ((select public.has_permission('catalog.write')));

create policy "product_media: catalog.write insert"
  on public.product_media for insert to authenticated
  with check ((select public.has_permission('catalog.write')));
create policy "product_media: catalog.write update"
  on public.product_media for update to authenticated
  using ((select public.has_permission('catalog.write')))
  with check ((select public.has_permission('catalog.write')));
create policy "product_media: catalog.write delete"
  on public.product_media for delete to authenticated
  using ((select public.has_permission('catalog.write')));

create policy "product_ar_assets: ar.manage insert"
  on public.product_ar_assets for insert to authenticated
  with check ((select public.has_permission('ar.manage')));
create policy "product_ar_assets: ar.manage update"
  on public.product_ar_assets for update to authenticated
  using ((select public.has_permission('ar.manage')))
  with check ((select public.has_permission('ar.manage')));
create policy "product_ar_assets: ar.manage delete"
  on public.product_ar_assets for delete to authenticated
  using ((select public.has_permission('ar.manage')));

create policy "collections: content.manage insert"
  on public.collections for insert to authenticated
  with check ((select public.has_permission('content.manage')));
create policy "collections: content.manage update"
  on public.collections for update to authenticated
  using ((select public.has_permission('content.manage')))
  with check ((select public.has_permission('content.manage')));
create policy "collections: content.manage delete"
  on public.collections for delete to authenticated
  using ((select public.has_permission('content.manage')));

create policy "collection_products: content.manage insert"
  on public.collection_products for insert to authenticated
  with check ((select public.has_permission('content.manage')));
create policy "collection_products: content.manage update"
  on public.collection_products for update to authenticated
  using ((select public.has_permission('content.manage')))
  with check ((select public.has_permission('content.manage')));
create policy "collection_products: content.manage delete"
  on public.collection_products for delete to authenticated
  using ((select public.has_permission('content.manage')));

grant select on
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_ar_assets, public.collections, public.collection_products
  to anon, authenticated;

grant insert, update, delete on
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_ar_assets, public.collections, public.collection_products
  to authenticated;

grant all on all tables in schema public to service_role;
