alter table public.shops
  add column seller_delivery_fee_fils bigint
  check (seller_delivery_fee_fils is null or seller_delivery_fee_fils between 0 and 9007199254740991);

create table public.platform_delivery_settings (
  singleton boolean primary key default true check (singleton),
  fee_fils bigint check (fee_fils is null or fee_fils between 0 and 9007199254740991),
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.platform_delivery_settings (singleton) values (true);
alter table public.platform_delivery_settings enable row level security;
revoke all on public.platform_delivery_settings from public, anon, authenticated;

create table public.delivery_fee_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('seller', 'platform')),
  shop_id uuid references public.shops(id) on delete restrict,
  fee_before_fils bigint,
  fee_after_fils bigint,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((scope = 'seller' and shop_id is not null) or (scope = 'platform' and shop_id is null)),
  check (fee_before_fils is null or fee_before_fils between 0 and 9007199254740991),
  check (fee_after_fils is null or fee_after_fils between 0 and 9007199254740991)
);
create index delivery_fee_events_shop_recent_idx on public.delivery_fee_events (shop_id, created_at desc, id desc) where scope = 'seller';
create index delivery_fee_events_platform_recent_idx on public.delivery_fee_events (created_at desc, id desc) where scope = 'platform';
alter table public.delivery_fee_events enable row level security;
revoke all on public.delivery_fee_events from public, anon, authenticated;

create function public.get_my_delivery_settings()
returns table (shop_id uuid, shop_name_ar text, shop_name_en text, seller_fee_fils bigint, platform_fee_fils bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name_ar, s.name_en, s.seller_delivery_fee_fils, p.fee_fils
  from public.shops s cross join public.platform_delivery_settings p
  where s.owner_user_id = (select auth.uid()) and s.status = 'active' and p.singleton
$$;
revoke all on function public.get_my_delivery_settings() from public;
grant execute on function public.get_my_delivery_settings() to authenticated;

create function public.set_shop_delivery_fee(p_shop_id uuid, p_fee_fils bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare previous_fee bigint;
begin
  if p_fee_fils is not null and p_fee_fils not between 0 and 9007199254740991 then
    raise exception 'invalid delivery fee' using errcode = '22023';
  end if;
  select s.seller_delivery_fee_fils into previous_fee
  from public.shops s where s.id = p_shop_id and s.owner_user_id = (select auth.uid()) and s.status = 'active'
  for update;
  if not found then raise exception 'not authorized' using errcode = '42501'; end if;
  if previous_fee is distinct from p_fee_fils then
    update public.shops set seller_delivery_fee_fils = p_fee_fils, updated_at = now() where id = p_shop_id;
    insert into public.delivery_fee_events (scope, shop_id, fee_before_fils, fee_after_fils, actor_user_id)
    values ('seller', p_shop_id, previous_fee, p_fee_fils, (select auth.uid()));
  end if;
  return p_fee_fils;
end;
$$;
revoke all on function public.set_shop_delivery_fee(uuid, bigint) from public;
grant execute on function public.set_shop_delivery_fee(uuid, bigint) to authenticated;

create function public.get_platform_delivery_settings()
returns table (fee_fils bigint, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.admin_action_is_mfa_verified() or not public.is_platform_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select p.fee_fils, p.updated_at from public.platform_delivery_settings p where p.singleton;
end;
$$;
revoke all on function public.get_platform_delivery_settings() from public;
grant execute on function public.get_platform_delivery_settings() to authenticated;

create function public.set_platform_delivery_fee(p_fee_fils bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare previous_fee bigint;
begin
  if not public.admin_action_is_mfa_verified() or not public.is_platform_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_fee_fils is not null and p_fee_fils not between 0 and 9007199254740991 then
    raise exception 'invalid delivery fee' using errcode = '22023';
  end if;
  select p.fee_fils into previous_fee from public.platform_delivery_settings p where p.singleton for update;
  if previous_fee is distinct from p_fee_fils then
    update public.platform_delivery_settings
      set fee_fils = p_fee_fils, updated_by = (select auth.uid()), updated_at = now()
      where singleton;
    insert into public.delivery_fee_events (scope, fee_before_fils, fee_after_fils, actor_user_id)
    values ('platform', previous_fee, p_fee_fils, (select auth.uid()));
  end if;
  return p_fee_fils;
end;
$$;
revoke all on function public.set_platform_delivery_fee(bigint) from public;
grant execute on function public.set_platform_delivery_fee(bigint) to authenticated;

create function public.list_delivery_fee_events(p_scope text, p_shop_id uuid default null)
returns table (scope text, shop_id uuid, fee_before_fils bigint, fee_after_fils bigint, actor_email text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_scope = 'seller' and p_shop_id is not null then
    if not public.is_shop_owner(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  elsif p_scope = 'platform' and p_shop_id is null then
    if not public.admin_action_is_mfa_verified() or not public.is_platform_owner() then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  else
    raise exception 'invalid delivery fee scope' using errcode = '22023';
  end if;
  return query
    select e.scope, e.shop_id, e.fee_before_fils, e.fee_after_fils, u.email::text, e.created_at
    from public.delivery_fee_events e join auth.users u on u.id = e.actor_user_id
    where e.scope = p_scope and e.shop_id is not distinct from p_shop_id
    order by e.created_at desc, e.id desc limit 100;
end;
$$;
revoke all on function public.list_delivery_fee_events(text, uuid) from public;
grant execute on function public.list_delivery_fee_events(text, uuid) to authenticated;
