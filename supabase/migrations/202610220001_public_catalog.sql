create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^([a-z0-9]+(-[a-z0-9]+)*)$'),
  name_ar text not null,
  name_en text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'active', 'retired')),
  sort_order integer not null default 100 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  slug text not null unique check (slug ~ '^([a-z0-9]+(-[a-z0-9]+)*)$'),
  name_ar text not null,
  name_en text not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  slug text not null check (slug ~ '^([a-z0-9]+(-[a-z0-9]+)*)$'),
  title_ar text not null,
  title_en text not null,
  description_ar text not null default '',
  description_en text not null default '',
  price_fils bigint not null check (price_fils > 0 and price_fils <= 9007199254740991),
  currency text not null default 'JOD' check (currency = 'JOD'),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'published', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (shop_id, slug),
  unique (id, shop_id)
);

create index products_public_catalog_idx on public.products (created_at desc, id desc) where status = 'published';
create index products_shop_category_idx on public.products (shop_id, category_id, status);

alter table public.categories enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;

create policy "active categories are publicly readable" on public.categories
  for select to anon, authenticated using (status = 'active');
create policy "active shops are publicly readable" on public.shops
  for select to anon, authenticated using (status = 'active');
create policy "published products from active shops and categories are publicly readable" on public.products
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.shops s where s.id = shop_id and s.status = 'active')
    and exists (select 1 from public.categories c where c.id = category_id and c.status = 'active')
  );

grant select on public.categories, public.shops, public.products to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.categories, public.shops, public.products from public, anon, authenticated;

create function public.search_public_catalog(
  p_query text default '',
  p_category_slug text default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
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

revoke all on function public.search_public_catalog(text, text, text, integer, integer) from public;
grant execute on function public.search_public_catalog(text, text, text, integer, integer) to anon, authenticated;

insert into public.categories (slug, name_ar, name_en, status, sort_order) values
  ('clothing', 'ملابس', 'Clothing', 'active', 10),
  ('accessories', 'إكسسوارات', 'Accessories', 'active', 20)
on conflict (slug) do nothing;
