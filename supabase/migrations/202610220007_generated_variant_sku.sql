-- Generate an editable, globally collision-resistant seller SKU when one is omitted.
alter table public.product_variants
  alter column sku set default ('SKU-' || upper(replace(gen_random_uuid()::text, '-', '')));
