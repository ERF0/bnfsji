drop function if exists public.search_public_catalog(text, text, text, integer, integer);

create function public.search_public_catalog(
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
language sql stable security invoker set search_path = ''
as $$
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
  select product_id, product_slug, title_ar, title_en, price_fils,
    shop_name_ar, shop_name_en, shop_slug, category_slug, total_count
  from counted
  order by
    case when p_sort = 'price_low' then price_fils end asc nulls last,
    case when p_sort = 'price_high' then price_fils end desc nulls last,
    case when p_sort = 'newest' or p_sort not in ('price_low', 'price_high') then created_at end desc nulls last,
    product_id desc
  limit greatest(1, least(coalesce(p_limit, 24), 48))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint) from public;
grant execute on function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint) to anon, authenticated;
