drop function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint);

create function public.search_public_catalog(
  p_query text default '', p_category_slug text default null, p_sort text default 'newest',
  p_limit integer default 24, p_offset integer default 0,
  p_min_price_fils bigint default null, p_max_price_fils bigint default null,
  p_shop_slug text default null, p_fulfillment text default null, p_options jsonb default '[]'::jsonb
)
returns table (
  product_id uuid, product_slug text, title_ar text, title_en text,
  price_fils bigint, shop_name_ar text, shop_name_en text,
  shop_slug text, category_slug text, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_query is not null and char_length(p_query) > 100 then
    raise exception 'p_query must not exceed 100 characters' using errcode = '22023';
  end if;
  if p_offset is not null and (p_offset < 0 or p_offset > 23976) then
    raise exception 'p_offset must be between 0 and 23976' using errcode = '22023';
  end if;
  if p_fulfillment is not null and p_fulfillment not in ('stocked', 'after_order') then
    raise exception 'invalid fulfillment' using errcode = '22023';
  end if;
  if p_options is null or octet_length(p_options::text) > 8000
    or jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) > 16
    or exists (select 1 from jsonb_array_elements(p_options) as f(item)
      where jsonb_typeof(f.item) <> 'object'
        or not (f.item ?& array['label_ar', 'label_en', 'value_ar', 'value_en'])
        or jsonb_typeof(f.item -> 'label_ar') <> 'string'
        or jsonb_typeof(f.item -> 'label_en') <> 'string'
        or jsonb_typeof(f.item -> 'value_ar') <> 'string'
        or jsonb_typeof(f.item -> 'value_en') <> 'string'
        or char_length(f.item ->> 'label_ar') not between 1 and 80
        or char_length(f.item ->> 'label_en') not between 1 and 80
        or char_length(f.item ->> 'value_ar') not between 1 and 80
        or char_length(f.item ->> 'value_en') not between 1 and 80) then
    raise exception 'invalid options' using errcode = '22023';
  end if;
  return query
  with search_term as (
    select btrim(public.normalize_catalog_search(p_query)) as term
  ), matching as (
    select p.id as product_id, p.slug as product_slug, p.title_ar, p.title_en,
      min(v.price_fils) as price_fils, s.name_ar as shop_name_ar, s.name_en as shop_name_en,
      s.slug as shop_slug, c.slug as category_slug, p.created_at,
      min(case
        when term = '' then 0
        when normalized.title_ar = term or normalized.title_en = term then 0
        when starts_with(normalized.title_ar, term) or starts_with(normalized.title_en, term) then 1
        when strpos(normalized.title_ar, term) > 0 or strpos(normalized.title_en, term) > 0 then 2
        else 3
      end) as relevance
    from public.products p
    join public.shops s on s.id = p.shop_id and s.status = 'active'
    join public.categories c on c.id = p.category_id and c.status = 'active'
    join public.product_variants v on v.product_id = p.id and v.status = 'active'
    cross join search_term
    cross join lateral (select
      public.normalize_catalog_search(p.title_ar) as title_ar,
      public.normalize_catalog_search(p.title_en) as title_en,
      public.normalize_catalog_search(s.name_ar) as shop_ar,
      public.normalize_catalog_search(s.name_en) as shop_en
    ) normalized
    where p.status = 'published'
      and (coalesce(p_category_slug, '') = '' or c.slug = p_category_slug)
      and (coalesce(p_shop_slug, '') = '' or s.slug = p_shop_slug)
      and (p_min_price_fils is null or p_min_price_fils >= 0)
      and (p_max_price_fils is null or p_max_price_fils >= 0)
      and (p_min_price_fils is null or p_max_price_fils is null or p_min_price_fils <= p_max_price_fils)
      and (v.supply_mode = 'after_order' or v.stock_quantity > 0)
      and (p_fulfillment is null or v.supply_mode = p_fulfillment)
      and (term = '' or strpos(normalized.title_ar, term) > 0
        or strpos(normalized.title_en, term) > 0
        or strpos(normalized.shop_ar, term) > 0
        or strpos(normalized.shop_en, term) > 0)
      and not exists (
        select 1 from (select distinct f.item ->> 'label_ar' as label_ar,
          f.item ->> 'label_en' as label_en from jsonb_array_elements(p_options) as f(item)) labels
        where not exists (
          select 1 from jsonb_array_elements(v.option_values) as opt(item)
          join jsonb_array_elements(p_options) as chosen(item)
            on chosen.item ->> 'label_ar' = labels.label_ar
            and chosen.item ->> 'label_en' = labels.label_en
            and opt.item = chosen.item
        )
      )
    group by p.id, s.id, c.id, term
    having (p_min_price_fils is null or min(v.price_fils) >= p_min_price_fils)
      and (p_max_price_fils is null or min(v.price_fils) <= p_max_price_fils)
  ), counted as (
    select matching.*, count(*) over () as total_count from matching
  )
  select counted.product_id, counted.product_slug, counted.title_ar, counted.title_en,
    counted.price_fils, counted.shop_name_ar, counted.shop_name_en,
    counted.shop_slug, counted.category_slug, counted.total_count
  from counted
  order by
    case when p_sort = 'newest' and btrim(coalesce(p_query, '')) <> '' then counted.relevance end asc nulls last,
    case when p_sort = 'price_low' then counted.price_fils end asc nulls last,
    case when p_sort = 'price_high' then counted.price_fils end desc nulls last,
    case when p_sort = 'newest' or p_sort not in ('price_low', 'price_high') then counted.created_at end desc nulls last,
    counted.product_id desc
  limit greatest(1, least(coalesce(p_limit, 24), 48))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint, text, text, jsonb) from public;
grant execute on function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint, text, text, jsonb) to anon, authenticated;

create function public.catalog_filter_options(p_query text default '', p_category_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_query is not null and char_length(p_query) > 100 then
    raise exception 'p_query must not exceed 100 characters' using errcode = '22023';
  end if;
  with eligible as (
    select distinct p.id, s.slug, s.name_ar, s.name_en, v.option_values
    from public.products p
    join public.shops s on s.id = p.shop_id and s.status = 'active'
    join public.categories c on c.id = p.category_id and c.status = 'active'
    join public.product_variants v on v.product_id = p.id and v.status = 'active'
    where p.status = 'published'
      and (coalesce(p_category_slug, '') = '' or c.slug = p_category_slug)
      and (v.supply_mode = 'after_order' or v.stock_quantity > 0)
      and (btrim(coalesce(p_query, '')) = '' or
        strpos(public.normalize_catalog_search(p.title_ar), btrim(public.normalize_catalog_search(p_query))) > 0 or
        strpos(public.normalize_catalog_search(p.title_en), btrim(public.normalize_catalog_search(p_query))) > 0 or
        strpos(public.normalize_catalog_search(s.name_ar), btrim(public.normalize_catalog_search(p_query))) > 0 or
        strpos(public.normalize_catalog_search(s.name_en), btrim(public.normalize_catalog_search(p_query))) > 0)
  ), shop_counts as (
    select slug, name_ar, name_en, count(distinct id) as count from eligible group by slug, name_ar, name_en
  ), option_counts as (
    select opt.item ->> 'label_ar' as label_ar, opt.item ->> 'label_en' as label_en,
      opt.item ->> 'value_ar' as value_ar, opt.item ->> 'value_en' as value_en,
      count(distinct e.id) as count
    from eligible e cross join lateral jsonb_array_elements(e.option_values) opt(item)
    group by 1, 2, 3, 4
  ), attribute_groups as (
    select label_ar, label_en,
      jsonb_agg(jsonb_build_object('value_ar', value_ar, 'value_en', value_en, 'count', count)
        order by value_en, value_ar) as values
    from option_counts group by label_ar, label_en
  )
  select jsonb_build_object(
    'shops', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name_ar', name_ar,
      'name_en', name_en, 'count', count) order by name_en, slug), '[]'::jsonb) from shop_counts),
    'attributes', (select coalesce(jsonb_agg(jsonb_build_object('label_ar', label_ar,
      'label_en', label_en, 'values', values) order by label_en, label_ar), '[]'::jsonb) from attribute_groups)
  ) into result;
  return result;
end;
$$;
revoke all on function public.catalog_filter_options(text, text) from public;
grant execute on function public.catalog_filter_options(text, text) to anon, authenticated;
