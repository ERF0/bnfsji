-- A seller account owns at most one shop, regardless of shop review status.
create unique index shops_one_shop_per_seller_idx on public.shops (owner_user_id);
