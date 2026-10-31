create table public.category_proposals (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^([a-z0-9]+(-[a-z0-9]+)*)$'),
  name_ar text not null check (char_length(btrim(name_ar)) between 1 and 100),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 100),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  decided_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((status = 'pending' and decided_by is null and decided_at is null)
      or (status <> 'pending' and decided_by is not null and decided_at is not null))
);
create unique index category_proposals_pending_slug_idx on public.category_proposals (slug) where status = 'pending';
create index category_proposals_recent_idx on public.category_proposals (created_at desc, id desc);
alter table public.category_proposals enable row level security;
revoke all on public.category_proposals from public, anon, authenticated;

create function public.propose_category(p_slug text, p_name_ar text, p_name_en text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare proposal_id uuid := gen_random_uuid();
begin
  if not public.admin_action_is_mfa_verified()
     or (not public.is_platform_admin() and not public.is_platform_owner()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_slug is null or p_slug !~ '^([a-z0-9]+(-[a-z0-9]+)*)$'
     or p_name_ar is null or char_length(btrim(p_name_ar)) not between 1 and 100
     or p_name_en is null or char_length(btrim(p_name_en)) not between 1 and 100 then
    raise exception 'invalid category proposal' using errcode = '22023';
  end if;
  if exists (select 1 from public.categories where slug = p_slug)
     or exists (select 1 from public.category_proposals where slug = p_slug and status = 'pending') then
    raise exception 'category slug is already in use or awaiting approval' using errcode = '23505';
  end if;
  insert into public.category_proposals (id, slug, name_ar, name_en, proposed_by)
  values (proposal_id, p_slug, btrim(p_name_ar), btrim(p_name_en), (select auth.uid()));
  return proposal_id;
end;
$$;
revoke all on function public.propose_category(text, text, text) from public;
grant execute on function public.propose_category(text, text, text) to authenticated;

create function public.list_category_proposals()
returns table (
  proposal_id uuid, slug text, name_ar text, name_en text, status text,
  proposer_email text, reviewer_email text, created_at timestamptz, decided_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.admin_action_is_mfa_verified() or not public.is_platform_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select cp.id, cp.slug, cp.name_ar, cp.name_en, cp.status,
    proposer.email::text, reviewer.email::text, cp.created_at, cp.decided_at
  from public.category_proposals cp
  join auth.users proposer on proposer.id = cp.proposed_by
  left join auth.users reviewer on reviewer.id = cp.decided_by
  order by (cp.status = 'pending') desc, cp.created_at desc, cp.id desc limit 100;
end;
$$;
revoke all on function public.list_category_proposals() from public;
grant execute on function public.list_category_proposals() to authenticated;

create function public.review_category_proposal(p_proposal_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = '' as $$
declare proposal public.category_proposals%rowtype;
begin
  if not public.admin_action_is_mfa_verified() or not public.is_platform_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_proposal_id is null or p_decision is null or p_decision not in ('approve', 'reject') then
    raise exception 'invalid category decision' using errcode = '22023';
  end if;
  select * into proposal from public.category_proposals where id = p_proposal_id for update;
  if not found or proposal.status <> 'pending' then
    raise exception 'category proposal is no longer pending' using errcode = '22023';
  end if;
  if p_decision = 'approve' then
    if exists (select 1 from public.categories where slug = proposal.slug) then
      raise exception 'category slug is already active' using errcode = '23505';
    end if;
    insert into public.categories (slug, name_ar, name_en, status, sort_order)
    values (proposal.slug, proposal.name_ar, proposal.name_en, 'active',
      coalesce((select max(sort_order) + 10 from public.categories), 10));
  end if;
  update public.category_proposals set status = case p_decision when 'approve' then 'approved' else 'rejected' end,
    decided_by = (select auth.uid()), decided_at = now() where id = p_proposal_id;
end;
$$;
revoke all on function public.review_category_proposal(uuid, text) from public;
grant execute on function public.review_category_proposal(uuid, text) to authenticated;
