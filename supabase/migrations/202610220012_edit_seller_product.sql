drop function public.list_shop_catalog(uuid);
create function public.list_shop_catalog(p_shop_id uuid)
returns table (
  product_id uuid, category_id uuid, slug text, title_ar text, title_en text, description_ar text,
  description_en text, status text, variants jsonb, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select p.id, p.category_id, p.slug, p.title_ar, p.title_en, p.description_ar, p.description_en, p.status,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'sku', v.sku, 'price_fils', v.price_fils, 'option_values', v.option_values,
        'supply_mode', v.supply_mode, 'stock_quantity', v.stock_quantity, 'status', v.status
      ) order by v.sort_order, v.id) from public.product_variants v where v.product_id = p.id), '[]'::jsonb), p.created_at
    from public.products p where p.shop_id = p_shop_id order by p.created_at desc, p.id desc limit 100;
end;
$$;
revoke all on function public.list_shop_catalog(uuid) from public;
grant execute on function public.list_shop_catalog(uuid) to authenticated;

create function public.update_seller_product(
  p_shop_id uuid, p_product_id uuid, p_category_id uuid,
  p_title_ar text, p_title_en text, p_description_ar text, p_description_en text, p_variants jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  product public.products%rowtype;
  variant public.product_variants%rowtype;
  item jsonb;
  item_options jsonb;
  item_labels jsonb;
  first_labels jsonb;
  seen_ids uuid[] := array[]::uuid[];
  item_index integer := 0;
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into product from public.products where id = p_product_id and shop_id = p_shop_id for update;
  if not found then raise exception 'product not found in this shop' using errcode = '22023'; end if;
  if not exists (select 1 from public.shops where id = p_shop_id and status = 'active')
     or not exists (select 1 from public.categories where id = p_category_id and status = 'active') then
    raise exception 'active shop and category required' using errcode = '22023';
  end if;
  if p_title_ar is null or char_length(btrim(p_title_ar)) not between 1 and 200
     or p_title_en is null or char_length(btrim(p_title_en)) not between 1 and 200
     or p_description_ar is null or char_length(p_description_ar) > 10000
     or p_description_en is null or char_length(p_description_en) > 10000
     or p_variants is null or jsonb_typeof(p_variants) is distinct from 'array'
     or jsonb_array_length(p_variants) not between 1 and 50 then
    raise exception 'invalid product fields' using errcode = '22023';
  end if;
  if jsonb_array_length(p_variants) <> (select count(*) from public.product_variants where product_id = p_product_id) then
    raise exception 'variant set cannot be added or removed through product editing' using errcode = '22023';
  end if;
  update public.products set category_id = p_category_id, title_ar = btrim(p_title_ar), title_en = btrim(p_title_en),
    description_ar = btrim(p_description_ar), description_en = btrim(p_description_en), updated_at = now()
  where id = p_product_id;
  for item in select value from jsonb_array_elements(p_variants) loop
    item_index := item_index + 1;
    if jsonb_typeof(item) <> 'object' or coalesce(item ->> 'variant_id', '') !~ '^[0-9a-fA-F-]{36}$'
       or coalesce(item ->> 'price_fils', '') !~ '^[1-9][0-9]{0,15}$'
       or nullif(btrim(item ->> 'sku'), '') is null or char_length(btrim(item ->> 'sku')) > 100 then
      raise exception 'invalid variant fields' using errcode = '22023';
    end if;
    if (item ->> 'price_fils')::numeric > 9007199254740991 then raise exception 'variant price out of range' using errcode = '22023'; end if;
    item_options := coalesce(item -> 'option_values', '[]'::jsonb);
    if not public.variant_options_are_valid(item_options) then raise exception 'invalid bilingual variant options' using errcode = '22023'; end if;
    select coalesce(jsonb_agg(jsonb_build_array(option.value ->> 'label_ar', option.value ->> 'label_en') order by option.ordinality), '[]'::jsonb)
      into item_labels from jsonb_array_elements(item_options) with ordinality as option(value, ordinality);
    if item_index = 1 then first_labels := item_labels;
    elsif first_labels is distinct from item_labels then raise exception 'variant option labels must match' using errcode = '22023'; end if;
    if (item ->> 'variant_id')::uuid = any(seen_ids) then raise exception 'duplicate variant id' using errcode = '22023'; end if;
    seen_ids := array_append(seen_ids, (item ->> 'variant_id')::uuid);
    select * into variant from public.product_variants where id = (item ->> 'variant_id')::uuid and product_id = p_product_id for update;
    if not found then raise exception 'variant does not belong to this product' using errcode = '22023'; end if;
    if item ->> 'supply_mode' is distinct from variant.supply_mode then raise exception 'change supply mode through a stock migration' using errcode = '22023'; end if;
    update public.product_variants set sku = btrim(item ->> 'sku'), price_fils = (item ->> 'price_fils')::bigint,
      option_values = item_options, updated_at = now() where id = variant.id;
  end loop;
  return p_product_id;
end;
$$;
revoke all on function public.update_seller_product(uuid, uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.update_seller_product(uuid, uuid, uuid, text, text, text, text, jsonb) to authenticated;
