create table public.stock_adjustments (
  id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  delta integer not null check (delta <> 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  created_at timestamptz not null default now(),
  check (quantity_after::bigint = quantity_before::bigint + delta::bigint)
);
create index stock_adjustments_shop_recent_idx on public.stock_adjustments (shop_id, created_at desc, id desc);
alter table public.stock_adjustments enable row level security;
create policy "catalog managers read shop stock history" on public.stock_adjustments
  for select to authenticated using (public.can_manage_shop_catalog(shop_id));
revoke all on public.stock_adjustments from public, anon, authenticated;

create function public.adjust_variant_stock(
  p_adjustment_id uuid, p_shop_id uuid, p_variant_id uuid, p_delta integer, p_reason text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v public.product_variants%rowtype;
  previous public.stock_adjustments%rowtype;
  new_quantity bigint;
  clean_reason text;
begin
  if p_adjustment_id is null or p_delta is null or p_delta = 0
     or p_reason is null or char_length(btrim(p_reason)) not between 1 and 300 then
    raise exception 'invalid stock adjustment' using errcode = '22023';
  end if;
  clean_reason := btrim(p_reason);
  perform pg_advisory_xact_lock(hashtextextended(p_adjustment_id::text, 0));
  if not public.can_manage_shop_catalog(p_shop_id)
     or not exists (select 1 from public.shops where id = p_shop_id and status = 'active') then
    raise exception 'not authorized to adjust this shop inventory' using errcode = '42501';
  end if;
  select pv.* into v
  from public.product_variants pv join public.products p on p.id = pv.product_id
  where pv.id = p_variant_id and p.shop_id = p_shop_id
  for update of pv;
  if not found then raise exception 'variant not found in this shop' using errcode = '22023'; end if;
  select * into previous from public.stock_adjustments where id = p_adjustment_id;
  if found then
    if previous.shop_id <> p_shop_id or previous.variant_id <> p_variant_id
       or previous.actor_user_id <> (select auth.uid()) or previous.delta <> p_delta
       or previous.reason <> clean_reason then
      raise exception 'stock adjustment id was already used for a different request' using errcode = '22023';
    end if;
    return previous.quantity_after;
  end if;
  if v.supply_mode <> 'stocked' or v.stock_quantity is null then
    raise exception 'only stocked variants have adjustable inventory' using errcode = '22023';
  end if;
  new_quantity := v.stock_quantity::bigint + p_delta::bigint;
  if new_quantity < 0 or new_quantity > 2147483647 then
    raise exception 'stock adjustment would exceed inventory bounds' using errcode = '22023';
  end if;
  insert into public.stock_adjustments (
    id, shop_id, product_id, variant_id, actor_user_id, delta, quantity_before, quantity_after, reason
  ) values (
    p_adjustment_id, p_shop_id, v.product_id, p_variant_id, (select auth.uid()), p_delta,
    v.stock_quantity, new_quantity::integer, clean_reason
  );
  update public.product_variants set stock_quantity = new_quantity::integer, updated_at = now() where id = p_variant_id;
  return new_quantity::integer;
end;
$$;
revoke all on function public.adjust_variant_stock(uuid, uuid, uuid, integer, text) from public;
grant execute on function public.adjust_variant_stock(uuid, uuid, uuid, integer, text) to authenticated;

create function public.list_shop_stock_adjustments(p_shop_id uuid)
returns table (
  adjustment_id uuid, variant_id uuid, sku text, product_title_ar text, product_title_en text,
  actor_email text, delta integer, quantity_before integer, quantity_after integer, reason text, created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select sa.id, sa.variant_id, v.sku, p.title_ar, p.title_en, u.email::text,
      sa.delta, sa.quantity_before, sa.quantity_after, sa.reason, sa.created_at
    from public.stock_adjustments sa
    join public.product_variants v on v.id = sa.variant_id
    join public.products p on p.id = sa.product_id
    join auth.users u on u.id = sa.actor_user_id
    where sa.shop_id = p_shop_id
    order by sa.created_at desc, sa.id desc limit 100;
end;
$$;
revoke all on function public.list_shop_stock_adjustments(uuid) from public;
grant execute on function public.list_shop_stock_adjustments(uuid) to authenticated;
