create function public.get_buyer_delivery_fee(p_shop_ids uuid[])
returns table (delivery_mode text, fee_fils bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  requested_count integer;
  active_count integer;
begin
  if p_shop_ids is null or cardinality(p_shop_ids) not between 1 and 50
     or array_position(p_shop_ids, null) is not null then
    raise exception 'invalid shop list' using errcode = '22023';
  end if;
  select count(distinct shop_id)::integer into requested_count from unnest(p_shop_ids) as requested(shop_id);
  if requested_count <> cardinality(p_shop_ids) then
    raise exception 'duplicate shop IDs' using errcode = '22023';
  end if;
  select count(*)::integer into active_count
  from public.shops s where s.id = any(p_shop_ids) and s.status = 'active';
  if active_count <> requested_count then
    raise exception 'shop is unavailable' using errcode = '22023';
  end if;
  if requested_count = 1 then
    return query
      select 'seller'::text, s.seller_delivery_fee_fils
      from public.shops s where s.id = p_shop_ids[1] and s.status = 'active';
  else
    return query
      select 'platform'::text, p.fee_fils
      from public.platform_delivery_settings p where p.singleton;
  end if;
end;
$$;
revoke all on function public.get_buyer_delivery_fee(uuid[]) from public;
grant execute on function public.get_buyer_delivery_fee(uuid[]) to anon, authenticated;
