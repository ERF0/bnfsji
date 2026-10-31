-- Normalize common Arabic spelling differences and diacritics for catalog lookup.
-- This is deliberately small; transliteration and typo correction need inventory evidence.
create function public.normalize_catalog_search(value text)
returns text language sql immutable parallel safe set search_path = ''
as $$
  select lower(translate(
    regexp_replace(coalesce(value, ''), '[ً-ٰٟـ]', '', 'g'),
    'آأإٱى', 'ااااي'
  ));
$$;

revoke all on function public.normalize_catalog_search(text) from public;

create or replace function public.search_public_catalog(
  p_query text default '', p_category_slug text default null, p_sort text default 'newest',
  p_limit integer default 24, p_offset integer default 0,
  p_min_price_fils bigint default null, p_max_price_fils bigint default null
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
      and (p_min_price_fils is null or p_min_price_fils >= 0)
      and (p_max_price_fils is null or p_max_price_fils >= 0)
      and (p_min_price_fils is null or p_max_price_fils is null or p_min_price_fils <= p_max_price_fils)
      and (v.supply_mode = 'after_order' or v.stock_quantity > 0)
      and (term = '' or strpos(normalized.title_ar, term) > 0
        or strpos(normalized.title_en, term) > 0
        or strpos(normalized.shop_ar, term) > 0
        or strpos(normalized.shop_en, term) > 0)
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
