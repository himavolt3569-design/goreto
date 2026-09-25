-- Make Data API privileges exactly what the RLS policies intend.
--
-- Supabase Cloud's default privileges give anon and authenticated ALL
-- privileges (including TRUNCATE and every column UPDATE) on anything
-- `postgres` creates in public. RLS still filters rows, but the column-level
-- grants that keep profiles.role read-only were being overridden. From here
-- on nothing is granted implicitly: every table and function lists its own
-- grants, here and in future migrations.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, public;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

/* ---------- Tables ---------- */

-- Public catalog, geography, delivery options and store settings (RLS: active rows).
grant select on
  public.nepal_provinces, public.nepal_districts, public.nepal_municipalities,
  public.store_settings,
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_ar_assets, public.collections, public.collection_products,
  public.couriers, public.courier_services, public.delivery_zones, public.delivery_rates
  to anon, authenticated;

-- Staff/owner writes (RLS: permission checks).
grant update on public.store_settings to authenticated;
grant insert, update, delete on
  public.categories, public.products, public.product_variants, public.product_media,
  public.product_ar_assets, public.collections, public.collection_products,
  public.couriers, public.courier_services, public.delivery_zones, public.delivery_rates
  to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant select, insert, delete on public.staff_permissions to authenticated;

-- Profiles: users may change only their name and phone.
grant select on public.profiles to authenticated;
grant update (full_name, phone_e164) on public.profiles to authenticated;

-- Orders: created by trusted server code; tracking history is append-only.
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert, update on public.shipments to authenticated;
grant select, insert on public.shipment_events to authenticated;

-- Customer-owned rows (RLS: own profile only).
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update on public.reviews to authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;
grant select on public.newsletter_subscribers to authenticated;

grant all on all tables in schema public to service_role;

/* ---------- Functions ---------- */

grant execute on function public.current_profile_id() to anon, authenticated, service_role;
grant execute on function public.is_owner() to anon, authenticated, service_role;
grant execute on function public.has_permission(public.staff_permission) to anon, authenticated, service_role;
grant execute on function public.product_rating_summaries(uuid[]) to anon, authenticated, service_role;
grant execute on function public.storefront_testimonials(integer) to anon, authenticated, service_role;

/* ---------- Identity columns: second line of defence ----------
 * Even if a grant is widened by mistake later, a signed-in user can never
 * change their role, Clerk id, email or deletion marker. Trusted server code
 * (service_role) and migrations are unaffected.
 */

create or replace function public.guard_profile_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.role is distinct from old.role
    or new.clerk_user_id is distinct from old.clerk_user_id
    or new.email is distinct from old.email
    or new.deleted_at is distinct from old.deleted_at
  ) then
    raise exception 'profile identity fields are read-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_profile_identity() from public, anon, authenticated;

create trigger profiles_guard_identity
  before update on public.profiles
  for each row execute function public.guard_profile_identity();
