create table public.buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient text not null check (char_length(btrim(recipient)) between 2 and 100),
  phone text not null check (phone ~ '^\+?[0-9 ]{8,20}$'),
  city text not null default 'Amman' check (city = 'Amman'),
  area text not null check (char_length(btrim(area)) between 2 and 100),
  street text not null check (char_length(btrim(street)) between 2 and 160),
  building text not null default '' check (char_length(building) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_addresses_user_created_idx on public.buyer_addresses (user_id, created_at desc, id);
alter table public.buyer_addresses enable row level security;
create policy "buyers read their own addresses" on public.buyer_addresses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "buyers add their own addresses" on public.buyer_addresses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "buyers edit their own addresses" on public.buyer_addresses
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "buyers remove their own addresses" on public.buyer_addresses
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.buyer_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.buyer_addresses to authenticated;
