-- Saved addresses keep the point picked on the map (prompts/goreto-address-map-picker.md).
--
-- account_save_address gains p_latitude / p_longitude. Both null keeps the
-- stored point while the municipality is unchanged (as before); a new point
-- replaces it. Otherwise identical to the account_addresses_wishlist version.

drop function public.account_save_address(uuid, text, text, text, text, text, text, integer, text, text, boolean);

create or replace function public.account_save_address(
  p_id uuid,
  p_label text,
  p_recipient_name text,
  p_phone_e164 text,
  p_province_code text,
  p_district_code text,
  p_municipality_code text,
  p_ward integer,
  p_street_landmark text,
  p_postal_code text,
  p_make_default boolean,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_label text := btrim(coalesce(p_label, ''));
  v_default boolean;
  v_id uuid;
begin
  if v_profile is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if char_length(v_label) not between 1 and 40 then
    raise exception 'Label must be 1-40 characters' using errcode = '22023';
  end if;
  if p_ward is null or p_ward not between 1 and 99 then
    raise exception 'Address hierarchy or ward is invalid' using errcode = '23514';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
    or p_latitude not between 26 and 31
    or p_longitude not between 80 and 89 then
    raise exception 'Location is outside Nepal' using errcode = '22023';
  end if;
  if p_id is not null and not exists (
    select 1 from public.customer_addresses a where a.id = p_id and a.user_id = v_profile
  ) then
    raise exception 'Address not found' using errcode = 'P0002';
  end if;

  v_default := coalesce(p_make_default, false) or not exists (
    select 1 from public.customer_addresses a
    where a.user_id = v_profile and a.is_default and a.id is distinct from p_id
  );

  if v_default then
    update public.customer_addresses
    set is_default = false
    where user_id = v_profile and is_default and id is distinct from p_id;
  end if;

  if p_id is null then
    insert into public.customer_addresses (
      user_id, label, recipient_name, phone_e164, province_code, district_code,
      municipality_code, ward, street_landmark, postal_code, latitude, longitude, is_default
    ) values (
      v_profile, v_label, btrim(p_recipient_name), p_phone_e164, p_province_code, p_district_code,
      p_municipality_code, p_ward::smallint, btrim(p_street_landmark), nullif(btrim(coalesce(p_postal_code, '')), ''),
      p_latitude, p_longitude, v_default
    )
    returning id into v_id;
  else
    update public.customer_addresses a
    set label = v_label,
        recipient_name = btrim(p_recipient_name),
        phone_e164 = p_phone_e164,
        province_code = p_province_code,
        district_code = p_district_code,
        municipality_code = p_municipality_code,
        ward = p_ward::smallint,
        street_landmark = btrim(p_street_landmark),
        postal_code = nullif(btrim(coalesce(p_postal_code, '')), ''),
        latitude = case
          when p_latitude is not null then p_latitude
          when a.municipality_code = p_municipality_code then a.latitude
        end,
        longitude = case
          when p_longitude is not null then p_longitude
          when a.municipality_code = p_municipality_code then a.longitude
        end,
        is_default = v_default
    where a.id = p_id and a.user_id = v_profile
    returning a.id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.account_save_address(uuid, text, text, text, text, text, text, integer, text, text, boolean, numeric, numeric)
  from public, anon;
grant execute on function public.account_save_address(uuid, text, text, text, text, text, text, integer, text, text, boolean, numeric, numeric)
  to authenticated;
