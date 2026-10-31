create function public.variant_options_are_valid(value jsonb)
returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when jsonb_typeof(value) <> 'array' then false
    when jsonb_array_length(value) > 8 then false
    else not exists (
      select 1
      from jsonb_array_elements(value) as options(item)
      where jsonb_typeof(item) <> 'object'
        or not (item ?& array['label_ar', 'label_en', 'value_ar', 'value_en'])
        or jsonb_typeof(item -> 'label_ar') <> 'string'
        or jsonb_typeof(item -> 'label_en') <> 'string'
        or jsonb_typeof(item -> 'value_ar') <> 'string'
        or jsonb_typeof(item -> 'value_en') <> 'string'
        or char_length(item ->> 'label_ar') not between 1 and 80
        or char_length(item ->> 'label_en') not between 1 and 80
        or char_length(item ->> 'value_ar') not between 1 and 80
        or char_length(item ->> 'value_en') not between 1 and 80
    )
  end;
$$;

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null check (char_length(sku) between 1 and 100),
  price_fils bigint not null check (price_fils > 0 and price_fils <= 9007199254740991),
  option_values jsonb not null default '[]'::jsonb,
  supply_mode text not null check (supply_mode in ('stocked', 'after_order')),
  stock_quantity integer,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku),
  unique (product_id, option_values),
  check (public.variant_options_are_valid(option_values)),
  check (
    (supply_mode = 'stocked' and stock_quantity is not null and stock_quantity >= 0)
    or (supply_mode = 'after_order' and stock_quantity is null)
  )
);

create index product_variants_active_product_idx
  on public.product_variants (product_id, sort_order, id) where status = 'active';

insert into public.product_variants (product_id, sku, price_fils, supply_mode, stock_quantity)
select id, 'legacy-' || id::text, price_fils, 'after_order', null
from public.products;
alter table public.products drop column price_fils;

alter table public.product_variants enable row level security;
create policy "public can read variants of published products" on public.product_variants
  for select to anon, authenticated using (
    status = 'active' and (supply_mode = 'after_order' or stock_quantity > 0) and exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id and s.status = 'active'
      join public.categories c on c.id = p.category_id and c.status = 'active'
      where p.id = product_id and p.status = 'published'
    )
  );
grant select (id, product_id, price_fils, option_values, supply_mode, sort_order)
  on public.product_variants to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.product_variants from public, anon, authenticated;

drop function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint);
create function public.search_public_catalog(
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
  with matching as (
    select p.id as product_id, p.slug as product_slug, p.title_ar, p.title_en,
      min(v.price_fils) as price_fils, s.name_ar as shop_name_ar, s.name_en as shop_name_en,
      s.slug as shop_slug, c.slug as category_slug, p.created_at
    from public.products p
    join public.shops s on s.id = p.shop_id and s.status = 'active'
    join public.categories c on c.id = p.category_id and c.status = 'active'
    join public.product_variants v on v.product_id = p.id and v.status = 'active'
    where p.status = 'published'
      and (coalesce(p_category_slug, '') = '' or c.slug = p_category_slug)
      and (p_min_price_fils is null or p_min_price_fils >= 0)
      and (p_max_price_fils is null or p_max_price_fils >= 0)
      and (p_min_price_fils is null or p_max_price_fils is null or p_min_price_fils <= p_max_price_fils)
      and (v.supply_mode = 'after_order' or v.stock_quantity > 0)
      and (coalesce(btrim(p_query), '') = ''
        or p.title_ar ilike '%' || btrim(p_query) || '%'
        or p.title_en ilike '%' || btrim(p_query) || '%'
        or s.name_ar ilike '%' || btrim(p_query) || '%'
        or s.name_en ilike '%' || btrim(p_query) || '%')
    group by p.id, s.id, c.id
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
    case when p_sort = 'price_low' then counted.price_fils end asc nulls last,
    case when p_sort = 'price_high' then counted.price_fils end desc nulls last,
    case when p_sort = 'newest' or p_sort not in ('price_low', 'price_high') then counted.created_at end desc nulls last,
    counted.product_id desc
  limit greatest(1, least(coalesce(p_limit, 24), 48))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke all on function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint) from public;
grant execute on function public.search_public_catalog(text, text, text, integer, integer, bigint, bigint) to anon, authenticated;
