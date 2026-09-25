-- Orders, item snapshots, shipments and append-only shipment events
-- (AGENTS §11.8, §12). Orders are created only by trusted server code (the
-- future place_order RPC), so there is no customer insert policy. Guest
-- tracking goes through a server path using guest_tracking_hash, never a
-- public policy.

create type public.order_status as enum (
  'pending_confirmation', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'canceled'
);
create type public.payment_method as enum ('cod');
create type public.payment_status as enum ('pending', 'collected', 'failed', 'refunded');
create type public.shipment_status as enum (
  'awaiting_assignment', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'exception', 'returned'
);
create type public.shipment_event_source as enum ('system', 'staff', 'courier_manual', 'courier_api');

/* ---------- Orders ---------- */

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^[A-Z]{2,4}[0-9]{6,14}$'),
  user_id uuid references public.profiles (id) on delete set null,
  contact_name text not null check (contact_name <> ''),
  contact_email text not null check (contact_email = lower(contact_email)),
  contact_phone_e164 text not null check (contact_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  -- Immutable address snapshot (codes + display names at order time).
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  status public.order_status not null default 'pending_confirmation',
  payment_method public.payment_method not null default 'cod',
  payment_status public.payment_status not null default 'pending',
  currency char(3) not null default 'NPR' check (currency = 'NPR'),
  subtotal_paisa bigint not null check (subtotal_paisa >= 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  delivery_fee_paisa bigint not null default 0 check (delivery_fee_paisa >= 0),
  total_paisa bigint not null check (total_paisa >= 0),
  courier_service_id uuid references public.courier_services (id) on delete set null,
  -- Purchased delivery-service snapshot; fulfilment may reassign the courier.
  delivery_snapshot jsonb not null check (jsonb_typeof(delivery_snapshot) = 'object'),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  -- sha256 hex of the guest tracking secret; the secret itself is never stored.
  guest_tracking_hash text check (guest_tracking_hash is null or guest_tracking_hash ~ '^[0-9a-f]{64}$'),
  confirmed_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  payment_collected_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_paisa <= subtotal_paisa),
  check (total_paisa = subtotal_paisa - discount_paisa + delivery_fee_paisa),
  check (payment_status <> 'collected' or payment_collected_at is not null),
  check (status <> 'canceled' or canceled_at is not null)
);

create index orders_user_id_created_idx on public.orders (user_id, created_at desc);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_courier_service_id_idx on public.orders (courier_service_id);
create index orders_coupon_id_idx on public.orders (coupon_id);
create index orders_guest_tracking_hash_idx on public.orders (guest_tracking_hash)
  where guest_tracking_hash is not null;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

/* ---------- Order items (snapshots) ---------- */

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_title text not null,
  variant_title text,
  sku text not null,
  image_path text,
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  quantity integer not null check (quantity > 0),
  line_total_paisa bigint not null,
  created_at timestamptz not null default now(),
  check (line_total_paisa = unit_price_paisa * quantity)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

/* ---------- Shipments ---------- */

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  courier_id uuid references public.couriers (id) on delete set null,
  courier_service_id uuid references public.courier_services (id) on delete set null,
  tracking_number text,
  status public.shipment_status not null default 'awaiting_assignment',
  estimated_delivery_from date,
  estimated_delivery_to date,
  assigned_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    estimated_delivery_from is null
    or estimated_delivery_to is null
    or estimated_delivery_to >= estimated_delivery_from
  )
);

create index shipments_order_id_idx on public.shipments (order_id);
create index shipments_courier_id_idx on public.shipments (courier_id);
create index shipments_courier_service_id_idx on public.shipments (courier_service_id);
create index shipments_tracking_number_idx on public.shipments (tracking_number)
  where tracking_number is not null;

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

/* ---------- Shipment events (append-only) ---------- */

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status public.shipment_status not null,
  message text not null check (message <> ''),
  location_label text,
  -- Only when a legitimate source supplies them; never synthesised.
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  source public.shipment_event_source not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create index shipment_events_shipment_id_idx on public.shipment_events (shipment_id, occurred_at);

/* ---------- RLS ---------- */

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

create policy "orders: read own"
  on public.orders for select to authenticated
  using (user_id = (select public.current_profile_id()));
create policy "orders: staff read"
  on public.orders for select to authenticated
  using ((select public.has_permission('orders.read')));
create policy "orders: staff update"
  on public.orders for update to authenticated
  using ((select public.has_permission('orders.write')))
  with check ((select public.has_permission('orders.write')));

create policy "order_items: read own"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select public.current_profile_id())
    )
  );
create policy "order_items: staff read"
  on public.order_items for select to authenticated
  using ((select public.has_permission('orders.read')));

create policy "shipments: read own"
  on public.shipments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = (select public.current_profile_id())
    )
  );
create policy "shipments: staff read"
  on public.shipments for select to authenticated
  using ((select public.has_permission('orders.read')));
create policy "shipments: staff insert"
  on public.shipments for insert to authenticated
  with check ((select public.has_permission('orders.write')));
create policy "shipments: staff update"
  on public.shipments for update to authenticated
  using ((select public.has_permission('orders.write')))
  with check ((select public.has_permission('orders.write')));

create policy "shipment_events: read own"
  on public.shipment_events for select to authenticated
  using (
    exists (
      select 1
      from public.shipments s
      join public.orders o on o.id = s.order_id
      where s.id = shipment_id and o.user_id = (select public.current_profile_id())
    )
  );
create policy "shipment_events: staff read"
  on public.shipment_events for select to authenticated
  using ((select public.has_permission('orders.read')));
create policy "shipment_events: staff append"
  on public.shipment_events for insert to authenticated
  with check ((select public.has_permission('orders.write')));

grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert, update on public.shipments to authenticated;
-- Append-only: no update/delete privilege for any user-context role.
grant select, insert on public.shipment_events to authenticated;

grant all on all tables in schema public to service_role;
