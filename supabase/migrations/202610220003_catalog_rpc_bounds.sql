create or replace function public.search_public_catalog(
  p_query text default '',
  p_category_slug text default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0,
  p_min_price_fils bigint default null,
  p_max_price_fils bigint default null
)
returns table (
  product_id uuid, product_slug text, title_ar text, title_en text,
  price_fils bigint, shop_name_ar text, shop_name_en text,
  shop_slug text, category_slug text, total_count bigint
)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_query is not null and char_length(p_query) > 100 then
    raise exception 'p_query must not exceed 100 characters' using errcode = '22023';
  end if;

  if p_offset is not null and (p_offset < 0 or p_offset > 23976) then
    raise exception 'p_offset must be between 0 and 23976' using errcode = '22023';
  end if;

  return query
  with matching as (
    select p.id as product_id, p.slug as product_slug, p.title_ar, p.title_en,
      p.price_fils, s.name_ar as shop_name_ar, s.name_en as shop_name_en,
      s.slug as shop_slug, c.slug as category_slug, p.created_at
    from public.products p
    join public.shops s on s.id = p.shop_id and s.status = 'active'
    join public.categories c on c.id = p.category_id and c.status = 'active'
    where p.status = 'published'
      and (coalesce(p_category_slug, '') = '' or c.slug = p_category_slug)
      and (p_min_price_fils is null or p_min_price_fils >= 0)
      and (p_max_price_fils is null or p_max_price_fils >= 0)
      and (p_min_price_fils is null or p_max_price_fils is null or p_min_price_fils <= p_max_price_fils)
      and (p_min_price_fils is null or p.price_fils >= p_min_price_fils)
      and (p_max_price_fils is null or p.price_fils <= p_max_price_fils)
      and (coalesce(btrim(p_query), '') = ''
        or p.title_ar ilike '%' || btrim(p_query) || '%'
        or p.title_en ilike '%' || btrim(p_query) || '%'
        or s.name_ar ilike '%' || btrim(p_query) || '%'
        or s.name_en ilike '%' || btrim(p_query) || '%')
  ), counted as (
    select matching.*, count(*) over () as total_count from matching
  )
  select counted.product_id, counted.product_slug, counted.title_ar, counted.title_en, counted.price_fils,
    counted.shop_name_ar, counted.shop_name_en, counted.shop_slug, counted.category_slug, counted.total_count
  from counted
  order by
    case when p_sort = 'price_low' then counted.price_fils end asc nulls last,
    case when p_sort = 'price_high' then counted.price_fils end desc nulls last,
    case when p_sort = 'newest' or p_sort not in ('price_low', 'price_high') then counted.created_at end desc nulls last,
    counted.product_id desc
  limit greatest(1, least(coalesce(p_limit, 24), 48))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
