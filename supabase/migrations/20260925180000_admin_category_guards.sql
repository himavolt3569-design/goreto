-- PR #8 review fixes (prompts/goreto-pr8-review-fixes.md). A new migration
-- because 20260925170000_admin_categories_collections is already applied.
--
-- * A category can't be its own parent: the table CHECK already refuses it,
--   this gives the form a readable error on parentId instead of 23514 text.
-- * admin_delete_category sees subcategories hidden by the caller's RLS
--   (catalog.write without catalog.read can't read inactive ones) and only
--   blames products for the products foreign key.

/* ---------- Two-level category tree ---------- */

-- Definer so the check sees hidden categories even when the caller can't.
create or replace function public.categories_enforce_two_levels()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A category can''t be its own parent. Choose another category.'
      using errcode = '22023', detail = 'parentId';
  end if;
  if exists (select 1 from public.categories c where c.id = new.parent_id and c.parent_id is not null) then
    raise exception 'A subcategory can''t have its own subcategories. Choose a top-level category.'
      using errcode = '22023', detail = 'parentId';
  end if;
  if exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'This category has subcategories, so it has to stay top-level.'
      using errcode = '22023', detail = 'parentId';
  end if;
  return new;
end;
$$;

/* ---------- Subcategory check that ignores the caller's RLS ---------- */

-- Answers one yes/no question, and only for catalog writers.
create or replace function public.category_has_children(p_category_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;
  return exists (select 1 from public.categories c where c.parent_id = p_category_id);
end;
$$;

revoke execute on function public.category_has_children(uuid) from public, anon;
grant execute on function public.category_has_children(uuid) to authenticated;

/* ---------- Delete a category ---------- */

-- Only empty categories: no products (any status) and no subcategories.
-- Returns the image object key so the caller can remove the file.
create or replace function public.admin_delete_category(p_category_id uuid)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_image text;
  v_deleted uuid;
  v_constraint text;
begin
  if not public.has_permission('catalog.write') then
    raise exception 'catalog.write required' using errcode = '42501';
  end if;

  perform 1 from public.categories c where c.id = p_category_id for update;
  if public.category_has_children(p_category_id) then
    raise exception 'This category has subcategories. Move or delete them first.' using errcode = '22023';
  end if;

  begin
    delete from public.categories c where c.id = p_category_id
    returning c.id, c.image_path into v_deleted, v_image;
  exception when foreign_key_violation or restrict_violation then
    get stacked diagnostics v_constraint = constraint_name;
    -- products.category_id is ON DELETE RESTRICT; RLS may hide drafts from
    -- the caller, but the constraint sees every product.
    if v_constraint = 'products_category_id_fkey' then
      raise exception 'This category still has products. Move them to another category, or hide the category instead.'
        using errcode = '22023';
    end if;
    raise;
  end;

  if v_deleted is null then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  return v_image;
end;
$$;
