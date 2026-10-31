create table public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index wishlist_items_user_created_idx
  on public.wishlist_items (user_id, created_at desc, product_id);

alter table public.wishlist_items enable row level security;

create policy "buyers read their own wishlist" on public.wishlist_items
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "buyers save public products to their own wishlist" on public.wishlist_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.products p
      where p.id = wishlist_items.product_id
    )
  );

create policy "buyers remove their own wishlist items" on public.wishlist_items
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.wishlist_items from public, anon, authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;
