-- Send & track and Autopilot (prompts/goreto-send-and-track.md): a usual
-- parcel weight for Daraz bookings when the products in an order have no
-- weight saved. Booking takes the typed weight, then the shipment's, then the
-- products', then this one. DEX weighs parcels at pickup, so it only sets the
-- fee estimate and the declared weight.

alter table public.courier_provider_accounts
  add column default_weight_grams integer
    check (default_weight_grams is null or default_weight_grams between 1 and 100000);

-- Same as 20261007100000_daraz_courier_ops, plus `default_weight_grams`
-- (null clears it). Only the listed keys change; absent keys keep their value.
create or replace function public.admin_update_provider_account(p_provider text, p_patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_unknown text;
  v_box jsonb;
begin
  if not public.has_permission('delivery.manage') then
    raise exception 'delivery.manage required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Invalid settings' using errcode = '22023';
  end if;

  select key into v_unknown
  from jsonb_object_keys(p_patch) as key
  where key not in (
    'platform_name', 'external_seller_id', 'pickup_warehouse_code', 'return_warehouse_code',
    'origin_name', 'origin_phone_e164', 'origin_email', 'origin_address_details', 'origin_daraz_address_id',
    'origin_latitude', 'origin_longitude',
    'solution_codes', 'default_delivery_option', 'default_open_box', 'undeliverable_option',
    'default_length_cm', 'default_width_cm', 'default_height_cm', 'default_weight_grams',
    'booking_endpoint', 'phone_format', 'declare_insurance', 'default_item_category',
    'box_presets', 'auto_book', 'xspace_case_template_id', 'xspace_category_id',
    'mark_linked', 'mark_pickup_synced', 'mark_return_synced'
  )
  limit 1;
  if v_unknown is not null then
    raise exception 'Unknown setting %', v_unknown using errcode = '22023';
  end if;

  if p_patch ? 'default_weight_grams' and jsonb_typeof(p_patch -> 'default_weight_grams') <> 'null' and (
    jsonb_typeof(p_patch -> 'default_weight_grams') <> 'number'
    or (p_patch ->> 'default_weight_grams')::numeric not between 1 and 100000
    or (p_patch ->> 'default_weight_grams')::numeric <> trunc((p_patch ->> 'default_weight_grams')::numeric)
  ) then
    raise exception 'The usual parcel weight must be a whole number of grams from 1 to 100000'
      using errcode = '22023', detail = 'default_weight_grams';
  end if;

  if p_patch ? 'box_presets' then
    if jsonb_typeof(p_patch -> 'box_presets') <> 'array' then
      raise exception 'Box sizes must be a list' using errcode = '22023', detail = 'box_presets';
    end if;
    for v_box in select value from jsonb_array_elements(p_patch -> 'box_presets') loop
      if jsonb_typeof(v_box) <> 'object'
         or char_length(coalesce(v_box ->> 'name', '')) not between 1 and 40
         or coalesce((v_box ->> 'length_cm')::numeric, 0) not between 1 and 300
         or coalesce((v_box ->> 'width_cm')::numeric, 0) not between 1 and 300
         or coalesce((v_box ->> 'height_cm')::numeric, 0) not between 1 and 300 then
        raise exception 'Each box needs a name and sizes from 1 to 300 cm' using errcode = '22023', detail = 'box_presets';
      end if;
    end loop;
  end if;

  update public.courier_provider_accounts a
  set platform_name = case when p_patch ? 'platform_name' then nullif(btrim(p_patch ->> 'platform_name'), '') else a.platform_name end,
      external_seller_id = case when p_patch ? 'external_seller_id' then nullif(btrim(p_patch ->> 'external_seller_id'), '') else a.external_seller_id end,
      pickup_warehouse_code = case when p_patch ? 'pickup_warehouse_code' then nullif(btrim(p_patch ->> 'pickup_warehouse_code'), '') else a.pickup_warehouse_code end,
      return_warehouse_code = case when p_patch ? 'return_warehouse_code' then nullif(btrim(p_patch ->> 'return_warehouse_code'), '') else a.return_warehouse_code end,
      origin_name = case when p_patch ? 'origin_name' then nullif(btrim(p_patch ->> 'origin_name'), '') else a.origin_name end,
      origin_phone_e164 = case when p_patch ? 'origin_phone_e164' then nullif(btrim(p_patch ->> 'origin_phone_e164'), '') else a.origin_phone_e164 end,
      origin_email = case when p_patch ? 'origin_email' then nullif(btrim(p_patch ->> 'origin_email'), '') else a.origin_email end,
      origin_address_details = case when p_patch ? 'origin_address_details' then nullif(btrim(p_patch ->> 'origin_address_details'), '') else a.origin_address_details end,
      origin_daraz_address_id = case when p_patch ? 'origin_daraz_address_id' then nullif(btrim(p_patch ->> 'origin_daraz_address_id'), '') else a.origin_daraz_address_id end,
      origin_latitude = case when p_patch ? 'origin_latitude' then (p_patch ->> 'origin_latitude')::numeric else a.origin_latitude end,
      origin_longitude = case when p_patch ? 'origin_longitude' then (p_patch ->> 'origin_longitude')::numeric else a.origin_longitude end,
      solution_codes = case when p_patch ? 'solution_codes'
        then coalesce((select array_agg(btrim(code)) from jsonb_array_elements_text(p_patch -> 'solution_codes') code where btrim(code) <> ''), '{}')
        else a.solution_codes end,
      default_delivery_option = coalesce(p_patch ->> 'default_delivery_option', a.default_delivery_option),
      default_open_box = coalesce((p_patch ->> 'default_open_box')::boolean, a.default_open_box),
      undeliverable_option = coalesce(p_patch ->> 'undeliverable_option', a.undeliverable_option),
      default_length_cm = coalesce((p_patch ->> 'default_length_cm')::numeric, a.default_length_cm),
      default_width_cm = coalesce((p_patch ->> 'default_width_cm')::numeric, a.default_width_cm),
      default_height_cm = coalesce((p_patch ->> 'default_height_cm')::numeric, a.default_height_cm),
      default_weight_grams = case when p_patch ? 'default_weight_grams' then (p_patch ->> 'default_weight_grams')::integer else a.default_weight_grams end,
      booking_endpoint = coalesce(p_patch ->> 'booking_endpoint', a.booking_endpoint),
      phone_format = coalesce(p_patch ->> 'phone_format', a.phone_format),
      declare_insurance = coalesce((p_patch ->> 'declare_insurance')::boolean, a.declare_insurance),
      default_item_category = case when p_patch ? 'default_item_category' then nullif(btrim(p_patch ->> 'default_item_category'), '') else a.default_item_category end,
      box_presets = coalesce(p_patch -> 'box_presets', a.box_presets),
      auto_book = coalesce((p_patch ->> 'auto_book')::boolean, a.auto_book),
      xspace_case_template_id = case when p_patch ? 'xspace_case_template_id' then (p_patch ->> 'xspace_case_template_id')::bigint else a.xspace_case_template_id end,
      xspace_category_id = case when p_patch ? 'xspace_category_id' then nullif(btrim(p_patch ->> 'xspace_category_id'), '') else a.xspace_category_id end,
      linked_at = case when (p_patch ->> 'mark_linked')::boolean then now() else a.linked_at end,
      pickup_synced_at = case when (p_patch ->> 'mark_pickup_synced')::boolean then now() else a.pickup_synced_at end,
      return_synced_at = case when (p_patch ->> 'mark_return_synced')::boolean then now() else a.return_synced_at end
  where a.provider = p_provider;

  if not found then
    raise exception 'Unknown provider %', p_provider using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_provider_account(text, jsonb) from public, anon;
grant execute on function public.admin_update_provider_account(text, jsonb) to authenticated;
