create table public.product_images (
  id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  sort_order smallint not null check (sort_order between 0 and 9),
  status text not null default 'pending' check (status in ('pending', 'active', 'deleting')),
  created_at timestamptz not null default now(),
  foreign key (product_id, shop_id) references public.products(id, shop_id) on delete restrict,
  check (storage_path ~ ('^' || shop_id::text || '/' || product_id::text || '/' || id::text || '\.(jpg|png|webp)$')),
  constraint product_images_order_unique unique (product_id, sort_order) deferrable initially deferred
);
create index product_images_product_order_idx on public.product_images (product_id, sort_order, id) where status = 'active';
alter table public.product_images enable row level security;
create policy "public reads published product images" on public.product_images
  for select to anon using (
    status = 'active' and exists (
        select 1 from public.products p
        join public.shops s on s.id = p.shop_id and s.status = 'active'
        join public.categories c on c.id = p.category_id and c.status = 'active'
        where p.id = product_id and p.status = 'published'
      )
  );
create policy "catalog managers read their product images" on public.product_images
  for select to authenticated using (public.can_manage_shop_catalog(shop_id));
revoke all on public.product_images from public, anon, authenticated;
grant select (id, shop_id, product_id, storage_path, content_type, sort_order, status, created_at)
  on public.product_images to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog managers upload only into their product folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.products p
      where p.id::text = split_part(name, '/', 2)
        and p.shop_id::text = split_part(name, '/', 1)
        and public.can_manage_shop_catalog(p.shop_id)
    )
  );
create policy "public reads only published product image objects" on storage.objects
  for select to anon using (
    bucket_id = 'product-images' and exists (
      select 1 from public.product_images i
      join public.products p on p.id = i.product_id and p.shop_id = i.shop_id
      join public.shops s on s.id = i.shop_id and s.status = 'active'
      join public.categories c on c.id = p.category_id and c.status = 'active'
      where i.storage_path = name and i.status = 'active' and p.status = 'published'
    )
  );
create policy "catalog managers read their product image objects" on storage.objects
  for select to authenticated using (
    bucket_id = 'product-images' and exists (
      select 1 from public.product_images i
      where i.storage_path = name and i.status in ('pending', 'active')
        and public.can_manage_shop_catalog(i.shop_id)
    )
  );
create policy "catalog managers delete only from their product folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-images'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.products p
      where p.id::text = split_part(name, '/', 2)
        and p.shop_id::text = split_part(name, '/', 1)
        and public.can_manage_shop_catalog(p.shop_id)
    )
  );

create function public.begin_seller_product_image_upload(
  p_shop_id uuid, p_product_id uuid, p_image_id uuid, p_content_type text
)
returns table (image_id uuid, storage_path text, sort_order smallint)
language plpgsql security definer set search_path = '' as $$
declare
  file_extension text;
  next_order integer;
  selected_path text;
begin
  if p_shop_id is null or p_product_id is null or p_image_id is null or p_content_type is null
     or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'invalid product image' using errcode = '22023';
  end if;
  if not public.can_manage_shop_catalog(p_shop_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  file_extension := case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' else 'webp' end;
  selected_path := p_shop_id::text || '/' || p_product_id::text || '/' || p_image_id::text || '.' || file_extension;
  perform 1 from public.products p where p.id = p_product_id and p.shop_id = p_shop_id and p.status in ('published', 'draft') for update;
  if not found then raise exception 'product not found in this shop' using errcode = '22023'; end if;

  select i.sort_order into next_order from public.product_images i
  where i.product_id = p_product_id and i.id = p_image_id;
  if found then
    if exists (select 1 from public.product_images i where i.product_id = p_product_id and i.id = p_image_id and i.storage_path = selected_path and i.content_type = p_content_type and i.status = 'pending') then
      return query select i.id, i.storage_path, i.sort_order from public.product_images i where i.product_id = p_product_id and i.id = p_image_id;
      return;
    end if;
    raise exception 'image id already used' using errcode = '22023';
  end if;
  select coalesce(max(i.sort_order) + 1, 0) into next_order
  from public.product_images i where i.product_id = p_product_id;
  if next_order >= 10 then raise exception 'product image limit reached' using errcode = '22023'; end if;
  insert into public.product_images (id, shop_id, product_id, storage_path, content_type, sort_order)
  values (p_image_id, p_shop_id, p_product_id, selected_path, p_content_type, next_order);
  return query select p_image_id, selected_path, next_order::smallint;
end;
$$;
revoke all on function public.begin_seller_product_image_upload(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.begin_seller_product_image_upload(uuid, uuid, uuid, text) to authenticated;

create function public.activate_seller_product_image(p_shop_id uuid, p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.product_images set status = 'active'
  where id = p_image_id and shop_id = p_shop_id and status = 'pending';
  if not found and not exists (select 1 from public.product_images where id = p_image_id and shop_id = p_shop_id and status = 'active') then
    raise exception 'pending image not found' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.activate_seller_product_image(uuid, uuid) from public, anon;
grant execute on function public.activate_seller_product_image(uuid, uuid) to authenticated;

create function public.begin_seller_product_image_delete(p_shop_id uuid, p_image_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  selected_path text;
  selected_product_id uuid;
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select product_id into selected_product_id from public.product_images where id = p_image_id and shop_id = p_shop_id;
  if not found then raise exception 'image not found' using errcode = '22023'; end if;
  perform 1 from public.products where id = selected_product_id and shop_id = p_shop_id for update;
  update public.product_images set status = 'deleting'
  where id = p_image_id and shop_id = p_shop_id
  returning storage_path into selected_path;
  if selected_path is null then raise exception 'image not found' using errcode = '22023'; end if;
  return selected_path;
end;
$$;
revoke all on function public.begin_seller_product_image_delete(uuid, uuid) from public, anon;
grant execute on function public.begin_seller_product_image_delete(uuid, uuid) to authenticated;

create function public.complete_seller_product_image_delete(p_shop_id uuid, p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  selected_product_id uuid;
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  select product_id into selected_product_id from public.product_images where id = p_image_id and shop_id = p_shop_id and status = 'deleting';
  if not found then raise exception 'image deletion is not pending' using errcode = '22023'; end if;
  perform 1 from public.products where id = selected_product_id and shop_id = p_shop_id for update;
  delete from public.product_images where id = p_image_id and shop_id = p_shop_id and status = 'deleting'
  returning product_id into selected_product_id;
  if not found then raise exception 'image deletion is not pending' using errcode = '22023'; end if;
  with ordered as (
    select i.id, (row_number() over (order by i.sort_order, i.id) - 1)::smallint as next_order
    from public.product_images i where i.product_id = selected_product_id
  )
  update public.product_images i set sort_order = ordered.next_order
  from ordered where i.id = ordered.id;
end;
$$;
revoke all on function public.complete_seller_product_image_delete(uuid, uuid) from public, anon;
grant execute on function public.complete_seller_product_image_delete(uuid, uuid) to authenticated;

create function public.reorder_seller_product_images(p_shop_id uuid, p_product_id uuid, p_image_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  expected_count integer;
begin
  if not public.can_manage_shop_catalog(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_image_ids is null or cardinality(p_image_ids) > 10
     or exists (select 1 from unnest(p_image_ids) as requested(id) where id is null)
     or (select count(distinct id) from unnest(p_image_ids) as requested(id)) <> cardinality(p_image_ids) then
    raise exception 'invalid image order' using errcode = '22023';
  end if;
  perform 1 from public.products p where p.id = p_product_id and p.shop_id = p_shop_id for update;
  if not found then raise exception 'product not found in this shop' using errcode = '22023'; end if;
  if exists (select 1 from public.product_images i where i.product_id = p_product_id and i.status <> 'active') then
    raise exception 'finish pending image changes before reordering' using errcode = '22023';
  end if;
  select count(*) into expected_count from public.product_images i where i.product_id = p_product_id and i.status = 'active';
  if expected_count <> cardinality(p_image_ids)
     or exists (
       select 1 from public.product_images i
       where i.product_id = p_product_id and i.status = 'active'
         and not (i.id = any(p_image_ids))
     )
     or exists (
       select 1 from unnest(p_image_ids) as requested(id)
       where not exists (select 1 from public.product_images i where i.id = requested.id and i.product_id = p_product_id and i.status = 'active')
     ) then
    raise exception 'image order must include every active image in this product exactly once' using errcode = '22023';
  end if;
  update public.product_images i set sort_order = ordered.position - 1
  from unnest(p_image_ids) with ordinality as ordered(id, position)
  where i.id = ordered.id and i.product_id = p_product_id and i.status = 'active';
end;
$$;
revoke all on function public.reorder_seller_product_images(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_seller_product_images(uuid, uuid, uuid[]) to authenticated;
