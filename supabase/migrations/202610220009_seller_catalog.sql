create or replace function public.variant_options_are_valid(value jsonb)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select case
    when jsonb_typeof(value) is distinct from 'array' then false
    when jsonb_array_length(value) > 8 then false
    else not exists (
      select 1 from jsonb_array_elements(value) as options(item)
      where jsonb_typeof(item) <> 'object'
        or not (item ?& array['label_ar', 'label_en', 'value_ar', 'value_en'])
        or jsonb_typeof(item -> 'label_ar') <> 'string'
        or jsonb_typeof(item -> 'label_en') <> 'string'
        or jsonb_typeof(item -> 'value_ar') <> 'string'
        or jsonb_typeof(item -> 'value_en') <> 'string'
        or char_length(btrim(item ->> 'label_ar')) not between 1 and 80
        or char_length(btrim(item ->> 'label_en')) not between 1 and 80
        or char_length(btrim(item ->> 'value_ar')) not between 1 and 80
        or char_length(btrim(item ->> 'value_en')) not between 1 and 80
    )
  end
$$;

create function public.can_manage_shop_catalog(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shops s where s.id = p_shop_id and s.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.shop_members sm
    where sm.shop_id = p_shop_id and sm.user_id = (select auth.uid()) and sm.role = 'catalog'
  )
$$;
revoke all on function public.can_manage_shop_catalog(uuid) from public;
grant execute on function public.can_manage_shop_catalog(uuid) to authenticated;

create policy "shop owners and catalog staff read their products" on public.products
  for select to authenticated using (public.can_manage_shop_catalog(shop_id));
create policy "shop owners and catalog staff read their variants" on public.product_variants
  for select to authenticated using (exists (
    select 1 from public.products p
    where p.id = product_id and public.can_manage_shop_catalog(p.shop_id)
  ));

create function public.list_catalog_shops()
returns table (shop_id uuid, shop_slug text, name_ar text, name_en text, status text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.slug, s.name_ar, s.name_en, s.status
  from public.shops s
  where s.status = 'active' and (
    s.owner_user_id = (select auth.uid())
    or exists (select 1 from public.shop_members sm where sm.shop_id = s.id and sm.user_id = (select auth.uid()) and sm.role = 'catalog')
  )
  order by s.name_en, s.id
$$;
revoke all on function public.list_catalog_shops() from public;
grant execute on function public.list_catalog_shops() to authenticated;

create function public.list_shop_catalog(p_shop_id uuid)
returns table (
  product_id uuid, slug text, title_ar text, title_en text, description_ar text,
  description_en text, status text, variants jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select p.id, p.slug, p.title_ar, p.title_en, p.description_ar, p.description_en, p.status,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', v.id, 'sku', v.sku, 'price_fils', v.price_fils, 'option_values', v.option_values,
          'supply_mode', v.supply_mode, 'stock_quantity', v.stock_quantity, 'status', v.status
        ) order by v.sort_order, v.id)
        from public.product_variants v where v.product_id = p.id
      ), '[]'::jsonb), p.created_at
    from public.products p where p.shop_id = p_shop_id order by p.created_at desc, p.id desc limit 100;
end;
$$;
revoke all on function public.list_shop_catalog(uuid) from public;
grant execute on function public.list_shop_catalog(uuid) to authenticated;

create function public.create_seller_product(
  p_shop_id uuid, p_category_id uuid, p_title_ar text, p_title_en text,
  p_description_ar text, p_description_en text, p_variants jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  product_id uuid := gen_random_uuid();
  product_slug text;
  item jsonb;
  item_options jsonb;
  item_labels jsonb;
  first_option_labels jsonb;
  item_price numeric;
  item_stock integer;
  item_sku text;
  item_supply text;
  item_index integer := 0;
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status = 'active') then
    raise exception 'active shop required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id and status = 'active') then
    raise exception 'active category required' using errcode = '22023';
  end if;
  if p_title_ar is null or char_length(btrim(p_title_ar)) not between 1 and 200
     or p_title_en is null or char_length(btrim(p_title_en)) not between 1 and 200
     or p_description_ar is null or char_length(p_description_ar) > 10000
     or p_description_en is null or char_length(p_description_en) > 10000 then
    raise exception 'invalid product fields' using errcode = '22023';
  end if;
  if p_variants is null or jsonb_typeof(p_variants) is distinct from 'array' or jsonb_array_length(p_variants) not between 1 and 50 then
    raise exception 'provide between 1 and 50 variants' using errcode = '22023';
  end if;

  product_slug := left(coalesce(nullif(trim(both '-' from regexp_replace(lower(btrim(p_title_en)), '[^a-z0-9]+', '-', 'g')), ''), 'product'), 90)
    || '-' || replace(product_id::text, '-', '');
  insert into public.products (id, shop_id, category_id, slug, title_ar, title_en, description_ar, description_en, status, published_at)
  values (product_id, p_shop_id, p_category_id, product_slug, btrim(p_title_ar), btrim(p_title_en), btrim(p_description_ar), btrim(p_description_en), 'published', now());

  for item in select value from jsonb_array_elements(p_variants) loop
    item_index := item_index + 1;
    if jsonb_typeof(item) <> 'object' then raise exception 'variant must be an object' using errcode = '22023'; end if;
    item_options := coalesce(item -> 'option_values', '[]'::jsonb);
    if not public.variant_options_are_valid(item_options) then raise exception 'invalid bilingual variant options' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_array(option.value ->> 'label_ar', option.value ->> 'label_en') order by option.ordinality), '[]'::jsonb)
      into item_labels from jsonb_array_elements(item_options) with ordinality as option(value, ordinality);
    if item_index = 1 then
      first_option_labels := item_labels;
    elsif first_option_labels is distinct from item_labels then
      raise exception 'variant options must use the same bilingual labels and order' using errcode = '22023';
    end if;
    if coalesce(item ->> 'price_fils', '') !~ '^[1-9][0-9]{0,15}$' then raise exception 'invalid variant price' using errcode = '22023'; end if;
    item_price := (item ->> 'price_fils')::numeric;
    if item_price > 9007199254740991 then raise exception 'variant price is outside the supported range' using errcode = '22023'; end if;
    item_supply := item ->> 'supply_mode';
    if item_supply not in ('stocked', 'after_order') then raise exception 'invalid supply mode' using errcode = '22023'; end if;
    item_stock := null;
    if item_supply = 'stocked' then
      if coalesce(item ->> 'stock_quantity', '') !~ '^(0|[1-9][0-9]{0,9})$'
         or (item ->> 'stock_quantity')::numeric > 2147483647 then
        raise exception 'invalid stock quantity' using errcode = '22023';
      end if;
      item_stock := (item ->> 'stock_quantity')::integer;
    end if;
    item_sku := nullif(btrim(item ->> 'sku'), '');
    if item_sku is not null and char_length(item_sku) > 100 then raise exception 'SKU is too long' using errcode = '22023'; end if;
    insert into public.product_variants (product_id, sku, price_fils, option_values, supply_mode, stock_quantity, sort_order)
    values (product_id, coalesce(item_sku, 'SKU-' || upper(replace(gen_random_uuid()::text, '-', ''))), item_price::bigint,
      item_options, item_supply, item_stock, item_index - 1);
  end loop;
  return product_id;
end;
$$;
revoke all on function public.create_seller_product(uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.create_seller_product(uuid, uuid, text, text, text, text, jsonb) to authenticated;
