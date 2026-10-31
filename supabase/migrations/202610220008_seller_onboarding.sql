create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role in ('owner', 'admin')),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.platform_staff enable row level security;
revoke all on public.platform_staff from public, anon, authenticated;

create table public.platform_admin_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('granted', 'revoked')),
  created_at timestamptz not null default now()
);
alter table public.platform_admin_events enable row level security;
revoke all on public.platform_admin_events from public, anon, authenticated;

create function public.bootstrap_platform_owner(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  lock table public.platform_staff in exclusive mode;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'account not found' using errcode = '22023';
  end if;
  if exists (select 1 from public.platform_staff) then
    raise exception 'platform owner is already bootstrapped' using errcode = '42501';
  end if;
  insert into public.platform_staff (user_id, role) values (p_user_id, 'owner');
end;
$$;
revoke all on function public.bootstrap_platform_owner(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_platform_owner(uuid) to service_role;

create function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_staff where user_id = (select auth.uid()) and role = 'owner')
$$;
revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

create function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_staff where user_id = (select auth.uid()) and role = 'admin')
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

create function public.admin_action_is_mfa_verified()
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
$$;
revoke all on function public.admin_action_is_mfa_verified() from public;
grant execute on function public.admin_action_is_mfa_verified() to authenticated;

create function public.is_shop_owner(p_shop_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shops where id = p_shop_id and owner_user_id = (select auth.uid()))
$$;
revoke all on function public.is_shop_owner(uuid) from public;
grant execute on function public.is_shop_owner(uuid) to authenticated;

create table public.shop_members (
  shop_id uuid not null references public.shops(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('catalog', 'orders')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id, role)
);
alter table public.shop_members enable row level security;
create policy "shop owners and members read their access" on public.shop_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_shop_owner(shop_id));
revoke all on public.shop_members from public, anon, authenticated;
grant select on public.shop_members to authenticated;

create table public.shop_staff_access_events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  role text not null check (role in ('catalog', 'orders')),
  action text not null check (action in ('granted', 'revoked')),
  created_at timestamptz not null default now()
);
alter table public.shop_staff_access_events enable row level security;
create policy "shop owners review staff access history" on public.shop_staff_access_events
  for select to authenticated using (public.is_shop_owner(shop_id));
revoke all on public.shop_staff_access_events from public, anon, authenticated;
grant select on public.shop_staff_access_events to authenticated;

create function public.get_owned_shop()
returns table (shop_id uuid, name_ar text, name_en text, status text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.name_ar, s.name_en, s.status
  from public.shops s where s.owner_user_id = (select auth.uid())
$$;
revoke all on function public.get_owned_shop() from public;
grant execute on function public.get_owned_shop() to authenticated;

create function public.list_shop_staff(p_shop_id uuid)
returns table (user_id uuid, email text, roles text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_shop_owner(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select sm.user_id, u.email::text, array_agg(sm.role order by sm.role)
    from public.shop_members sm join auth.users u on u.id = sm.user_id
    where sm.shop_id = p_shop_id group by sm.user_id, u.email order by u.email;
end;
$$;
revoke all on function public.list_shop_staff(uuid) from public;
grant execute on function public.list_shop_staff(uuid) to authenticated;

create function public.search_shop_staff_accounts(p_shop_id uuid, p_email text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_shop_owner(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_email is null or char_length(btrim(p_email)) < 3 or char_length(p_email) > 254 then
    raise exception 'provide at least 3 email characters' using errcode = '22023';
  end if;
  return query
    select u.id, u.email::text from auth.users u
    where u.id <> (select auth.uid()) and u.email ilike '%' || btrim(p_email) || '%'
    order by u.email limit 20;
end;
$$;
revoke all on function public.search_shop_staff_accounts(uuid, text) from public;
grant execute on function public.search_shop_staff_accounts(uuid, text) to authenticated;

create function public.set_shop_staff_access(p_shop_id uuid, p_user_id uuid, p_roles text[])
returns void language plpgsql security definer set search_path = '' as $$
declare selected_role text;
begin
  if not public.is_shop_owner(p_shop_id) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id)
     or p_user_id = (select owner_user_id from public.shops where id = p_shop_id)
     or p_roles is null
     or exists (select 1 from unnest(p_roles) as r where r not in ('catalog', 'orders')) then
    raise exception 'invalid staff assignment' using errcode = '22023';
  end if;
  perform 1 from public.shops where id = p_shop_id for update;
  with revoked as (
    delete from public.shop_members where shop_id = p_shop_id and user_id = p_user_id and not (role = any(p_roles))
    returning shop_id, user_id, role
  ) insert into public.shop_staff_access_events (shop_id, actor_user_id, target_user_id, role, action)
    select shop_id, (select auth.uid()), user_id, role, 'revoked' from revoked;
  for selected_role in select distinct unnest(p_roles) loop
    if not exists (select 1 from public.shop_members where shop_id = p_shop_id and user_id = p_user_id and role = selected_role) then
      insert into public.shop_members (shop_id, user_id, role, created_by)
      values (p_shop_id, p_user_id, selected_role, (select auth.uid()));
      insert into public.shop_staff_access_events (shop_id, actor_user_id, target_user_id, role, action)
      values (p_shop_id, (select auth.uid()), p_user_id, selected_role, 'granted');
    end if;
  end loop;
end;
$$;
revoke all on function public.set_shop_staff_access(uuid, uuid, text[]) from public;
grant execute on function public.set_shop_staff_access(uuid, uuid, text[]) to authenticated;

create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null unique references auth.users(id) on delete restrict,
  store_name_ar text not null check (char_length(btrim(store_name_ar)) between 1 and 120),
  store_name_en text not null check (char_length(btrim(store_name_en)) between 1 and 120),
  contact text not null check (char_length(btrim(contact)) between 1 and 160),
  address text not null check (char_length(btrim(address)) between 1 and 1000),
  proof_path text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'rejected', 'approved')),
  assigned_reviewer_id uuid references public.platform_staff(user_id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 2000),
  shop_id uuid unique references public.shops(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved') = (shop_id is not null)),
  check (proof_path is null or proof_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(pdf|jpg|png)$'))
);
create function public.is_assigned_seller_reviewer(p_application_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.seller_applications a
    join public.platform_staff ps on ps.user_id = a.assigned_reviewer_id and ps.role = 'admin'
    where a.id = p_application_id and a.assigned_reviewer_id = (select auth.uid())
  )
$$;
revoke all on function public.is_assigned_seller_reviewer(uuid) from public;
grant execute on function public.is_assigned_seller_reviewer(uuid) to authenticated;

create index seller_applications_review_queue_idx on public.seller_applications (submitted_at, id) where status = 'submitted';
alter table public.seller_applications enable row level security;
create policy "applicants read their seller application" on public.seller_applications
  for select to authenticated using (applicant_user_id = (select auth.uid()));
create policy "assigned admins read seller applications" on public.seller_applications
  for select to authenticated using (public.admin_action_is_mfa_verified() and public.is_assigned_seller_reviewer(id));
create policy "platform owners read seller applications for assignment" on public.seller_applications
  for select to authenticated using (public.admin_action_is_mfa_verified() and public.is_platform_owner());
create policy "applicants create a draft application" on public.seller_applications
  for insert to authenticated with check (applicant_user_id = (select auth.uid()) and status = 'draft' and assigned_reviewer_id is null and shop_id is null);
create policy "applicants edit draft or rejected applications" on public.seller_applications
  for update to authenticated
  using (applicant_user_id = (select auth.uid()) and status in ('draft', 'rejected'))
  with check (applicant_user_id = (select auth.uid()) and status in ('draft', 'rejected') and assigned_reviewer_id is null and shop_id is null);
revoke all on public.seller_applications from public, anon, authenticated;
grant select on public.seller_applications to authenticated;
grant insert (applicant_user_id, store_name_ar, store_name_en, contact, address) on public.seller_applications to authenticated;
grant update (store_name_ar, store_name_en, contact, address, proof_path) on public.seller_applications to authenticated;

create table public.seller_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.seller_applications(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('submitted', 'assigned', 'approved', 'rejected')),
  detail text check (detail is null or char_length(detail) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.seller_application_events enable row level security;
create policy "assigned admins read application history" on public.seller_application_events
  for select to authenticated using (public.admin_action_is_mfa_verified() and public.is_assigned_seller_reviewer(application_id));
revoke all on public.seller_application_events from public, anon, authenticated;
grant select on public.seller_application_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('seller-address-proofs', 'seller-address-proofs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "applicants upload address proof while editing" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'seller-address-proofs'
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'
    and exists (
      select 1 from public.seller_applications a
      where a.id::text = split_part(name, '/', 1)
        and a.applicant_user_id = (select auth.uid())
        and a.status in ('draft', 'rejected')
    )
  );
create policy "assigned admins read address proof" on storage.objects
  for select to authenticated using (
    bucket_id = 'seller-address-proofs'
    and exists (
      select 1 from public.seller_applications a
      where a.id::text = split_part(name, '/', 1)
        and public.admin_action_is_mfa_verified() and public.is_assigned_seller_reviewer(a.id)
    )
  );

create function public.search_existing_accounts(p_email text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.admin_action_is_mfa_verified() then raise exception 'administrator MFA is required' using errcode = '42501'; end if;
  if p_email is null or char_length(btrim(p_email)) < 3 or char_length(p_email) > 254 then
    raise exception 'provide at least 3 email characters' using errcode = '22023';
  end if;
  return query
    select u.id, u.email::text from auth.users u
    where u.email ilike '%' || btrim(p_email) || '%'
      and not exists (select 1 from public.platform_staff ps where ps.user_id = u.id)
    order by u.email limit 20;
end;
$$;
revoke all on function public.search_existing_accounts(text) from public;
grant execute on function public.search_existing_accounts(text) to authenticated;

create function public.provision_platform_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.admin_action_is_mfa_verified() then raise exception 'administrator MFA is required' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'account not found' using errcode = '22023';
  end if;
  if exists (select 1 from public.platform_staff where user_id = p_user_id and role = 'owner') then
    raise exception 'owner cannot be provisioned as an admin' using errcode = '23514';
  end if;
  insert into public.platform_staff (user_id, role, created_by)
  values (p_user_id, 'admin', (select auth.uid()))
  on conflict (user_id) do update set role = 'admin', created_by = (select auth.uid());
  insert into public.platform_admin_events (actor_user_id, target_user_id, action)
  values ((select auth.uid()), p_user_id, 'granted');
end;
$$;
revoke all on function public.provision_platform_admin(uuid) from public;
grant execute on function public.provision_platform_admin(uuid) to authenticated;

create function public.list_platform_admins()
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.admin_action_is_mfa_verified() then raise exception 'administrator MFA is required' using errcode = '42501'; end if;
  return query
    select ps.user_id, u.email::text, ps.created_at
    from public.platform_staff ps join auth.users u on u.id = ps.user_id
    where ps.role = 'admin' order by ps.created_at, ps.user_id;
end;
$$;
revoke all on function public.list_platform_admins() from public;
grant execute on function public.list_platform_admins() to authenticated;

create function public.revoke_platform_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.admin_action_is_mfa_verified() then raise exception 'administrator MFA is required' using errcode = '42501'; end if;
  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'owner cannot revoke their own access' using errcode = '22023';
  end if;
  delete from public.platform_staff where user_id = p_user_id and role = 'admin';
  if not found then raise exception 'platform administrator not found' using errcode = '22023'; end if;
  insert into public.platform_admin_events (actor_user_id, target_user_id, action)
  values ((select auth.uid()), p_user_id, 'revoked');
end;
$$;
revoke all on function public.revoke_platform_admin(uuid) from public;
grant execute on function public.revoke_platform_admin(uuid) to authenticated;

create function public.list_platform_admin_events()
returns table (actor_email text, target_email text, action text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.admin_action_is_mfa_verified() then raise exception 'administrator MFA is required' using errcode = '42501'; end if;
  return query
    select actor.email::text, target.email::text, e.action, e.created_at
    from public.platform_admin_events e
    left join auth.users actor on actor.id = e.actor_user_id
    join auth.users target on target.id = e.target_user_id
    order by e.created_at desc, e.id desc limit 50;
end;
$$;
revoke all on function public.list_platform_admin_events() from public;
grant execute on function public.list_platform_admin_events() to authenticated;

create function public.assign_seller_reviewer(p_application_id uuid, p_reviewer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'not authorized' using errcode = '42501'; end if;
  if not public.admin_action_is_mfa_verified() then raise exception 'administrator MFA is required' using errcode = '42501'; end if;
  if not exists (select 1 from public.platform_staff where user_id = p_reviewer_id and role = 'admin') then
    raise exception 'reviewer is not a platform admin' using errcode = '22023';
  end if;
  update public.seller_applications set assigned_reviewer_id = p_reviewer_id
  where id = p_application_id and status = 'submitted';
  if not found then raise exception 'submitted application not found' using errcode = '22023'; end if;
  insert into public.seller_application_events (application_id, actor_user_id, event_type)
  values (p_application_id, (select auth.uid()), 'assigned');
end;
$$;
revoke all on function public.assign_seller_reviewer(uuid, uuid) from public;
grant execute on function public.assign_seller_reviewer(uuid, uuid) to authenticated;

create function public.submit_seller_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.seller_applications%rowtype;
begin
  select * into a from public.seller_applications
  where id = p_application_id and applicant_user_id = (select auth.uid()) for update;
  if not found or a.status not in ('draft', 'rejected') then raise exception 'application cannot be submitted' using errcode = '22023'; end if;
  if a.proof_path is null or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'seller-address-proofs' and o.name = a.proof_path
      and o.owner_id = (select auth.uid())::text
      and case when o.metadata ->> 'size' ~ '^[0-9]{1,12}$'
        then (o.metadata ->> 'size')::bigint between 1 and 10485760 else false end
      and coalesce(o.metadata ->> 'mimetype', '') in ('application/pdf', 'image/jpeg', 'image/png')
  ) then raise exception 'valid address proof is required' using errcode = '22023'; end if;
  update public.seller_applications set status = 'submitted', assigned_reviewer_id = null,
    rejection_reason = null, submitted_at = now(), updated_at = now()
  where id = p_application_id;
  insert into public.seller_application_events (application_id, actor_user_id, event_type)
  values (p_application_id, (select auth.uid()), 'submitted');
end;
$$;
revoke all on function public.submit_seller_application(uuid) from public;
grant execute on function public.submit_seller_application(uuid) to authenticated;

create function public.review_seller_application(p_application_id uuid, p_decision text, p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.seller_applications%rowtype; new_shop_id uuid; shop_slug text;
begin
  select * into a from public.seller_applications
  where id = p_application_id and assigned_reviewer_id = (select auth.uid()) for update;
  if not found or a.status <> 'submitted' or not exists (
    select 1 from public.platform_staff where user_id = (select auth.uid()) and role = 'admin'
  ) or not public.admin_action_is_mfa_verified() then raise exception 'not authorized to review this application' using errcode = '42501'; end if;
  if p_decision = 'reject' then
    if p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000 then raise exception 'rejection reason is required' using errcode = '22023'; end if;
    update public.seller_applications set status = 'rejected', assigned_reviewer_id = null,
      rejection_reason = btrim(p_reason), reviewed_at = now(), updated_at = now()
    where id = p_application_id;
    insert into public.seller_application_events (application_id, actor_user_id, event_type, detail)
    values (p_application_id, (select auth.uid()), 'rejected', btrim(p_reason));
    return null;
  end if;
  if p_decision <> 'approve' then raise exception 'invalid review decision' using errcode = '22023'; end if;
  new_shop_id := gen_random_uuid();
  shop_slug := left(coalesce(nullif(trim(both '-' from regexp_replace(lower(a.store_name_en), '[^a-z0-9]+', '-', 'g')), ''), 'shop'), 70)
    || '-' || replace(new_shop_id::text, '-', '');
  insert into public.shops (id, owner_user_id, slug, name_ar, name_en, status)
  values (new_shop_id, a.applicant_user_id, shop_slug, a.store_name_ar, a.store_name_en, 'active');
  update public.seller_applications set status = 'approved', shop_id = new_shop_id, reviewed_at = now(), updated_at = now()
  where id = p_application_id;
  insert into public.seller_application_events (application_id, actor_user_id, event_type)
  values (p_application_id, (select auth.uid()), 'approved');
  return new_shop_id;
end;
$$;
revoke all on function public.review_seller_application(uuid, text, text) from public;
grant execute on function public.review_seller_application(uuid, text, text) to authenticated;
