alter table public.shops
  add column description_ar text not null default '' check (char_length(description_ar) <= 1000),
  add column description_en text not null default '' check (char_length(description_en) <= 1000);

create function public.get_my_shop_profile()
returns table (shop_id uuid, slug text, name_ar text, name_en text,
  description_ar text, description_en text, status text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.slug, s.name_ar, s.name_en, s.description_ar, s.description_en, s.status
  from public.shops s where s.owner_user_id = (select auth.uid())
$$;
revoke all on function public.get_my_shop_profile() from public;
grant execute on function public.get_my_shop_profile() to authenticated;

create function public.update_my_shop_profile(
  p_shop_id uuid, p_name_ar text, p_name_en text,
  p_description_ar text, p_description_en text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare updated_id uuid;
begin
  if p_shop_id is null or p_name_ar is null or p_name_en is null
    or p_description_ar is null or p_description_en is null
    or char_length(btrim(p_name_ar)) not between 2 and 120
    or char_length(btrim(p_name_en)) not between 2 and 120
    or char_length(btrim(p_description_ar)) > 1000
    or char_length(btrim(p_description_en)) > 1000 then
    raise exception 'invalid shop profile' using errcode = '22023';
  end if;
  update public.shops
  set name_ar = btrim(p_name_ar), name_en = btrim(p_name_en),
    description_ar = btrim(p_description_ar), description_en = btrim(p_description_en),
    updated_at = now()
  where id = p_shop_id and owner_user_id = (select auth.uid()) and status = 'active'
  returning id into updated_id;
  if updated_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return updated_id;
end;
$$;
revoke all on function public.update_my_shop_profile(uuid, text, text, text, text) from public;
grant execute on function public.update_my_shop_profile(uuid, text, text, text, text) to authenticated;
