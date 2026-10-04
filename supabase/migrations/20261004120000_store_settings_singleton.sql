-- The store settings row (AGENTS §11.9) used to come only from the development
-- seed, so a fresh production database had none: checkout, order acceptance and
-- the admin Settings page all read this singleton. Create it with the column
-- defaults; databases that already have the row (dev) are left untouched.
-- Support contacts, the dispatch municipality and courier rules are set later
-- in /admin/settings.
--
-- The id is the one the development seed uses (scripts/seed), so `seed:load`
-- on a fresh dev database upserts this same row instead of hitting the
-- one-row `singleton` constraint.

insert into public.store_settings (id, store_name, tagline)
values ('9928237a-45d7-5df3-a204-425870edfa44', 'Goreto.store', 'Style it. See it. Love it.')
on conflict (singleton) do nothing;
