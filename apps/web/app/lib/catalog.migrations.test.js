import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationPaths = [
  new URL("../../../../supabase/migrations/202610220001_public_catalog.sql", import.meta.url),
  new URL("../../../../supabase/migrations/202610220002_catalog_price_filters.sql", import.meta.url),
  new URL("../../../../supabase/migrations/202610220003_catalog_rpc_bounds.sql", import.meta.url),
  new URL("../../../../supabase/migrations/202610220005_product_variants.sql", import.meta.url),
  new URL("../../../../supabase/migrations/202610260001_catalog_search_normalization.sql", import.meta.url),
  new URL("../../../../supabase/migrations/202610260002_live_catalog_facets.sql", import.meta.url),
];

test("catalog migrations apply on PostgreSQL and enforce public RLS and price filters", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001');
    `);
    for (const path of migrationPaths.slice(0, 3)) await db.exec(await readFile(path, "utf8"));

    await db.exec(`
      insert into public.categories (slug, name_ar, name_en, status) values
        ('pending-test', 'تجريبي', 'Pending test', 'pending_approval');
      insert into public.shops (owner_user_id, slug, name_ar, name_en, status) values
        ('00000000-0000-4000-8000-000000000001', 'active-shop', 'متجر', 'Active shop', 'active'),
        ('00000000-0000-4000-8000-000000000001', 'pending-shop', 'متجر قيد المراجعة', 'Pending shop', 'pending_review');
      insert into public.products (shop_id, category_id, slug, title_ar, title_en, price_fils, status)
      select s.id, c.id, v.slug, v.title_ar, v.title_en, v.price_fils, v.status
      from (values
        ('active-shop', 'clothing', 'visible-low', 'منتج منخفض', 'Visible low', 4000::bigint, 'published'),
        ('active-shop', 'clothing', 'visible-high', 'منتج مرتفع', 'Visible high', 9000::bigint, 'published'),
        ('active-shop', 'clothing', 'draft-item', 'مسودة', 'Draft', 7000::bigint, 'draft'),
        ('active-shop', 'pending-test', 'pending-category-item', 'فئة معلقة', 'Pending category', 10000::bigint, 'published'),
        ('pending-shop', 'clothing', 'pending-shop-item', 'متجر معلق', 'Pending shop', 11000::bigint, 'published')
      ) as v(shop_slug, category_slug, slug, title_ar, title_en, price_fils, status)
      join public.shops s on s.slug = v.shop_slug
      join public.categories c on c.slug = v.category_slug;
    `);
    await db.exec(await readFile(migrationPaths[3], "utf8"));

    await db.exec(`
      insert into public.products (shop_id, category_id, slug, title_ar, title_en, status)
      select s.id, c.id, 'sold-out', 'Out', 'Sold out', 'published'
      from public.shops s, public.categories c where s.slug = 'active-shop' and c.slug = 'clothing';
      update public.product_variants v set status = 'inactive'
      from public.products p where v.product_id = p.id and p.slug = 'sold-out';
      insert into public.product_variants (product_id, sku, price_fils, option_values, supply_mode, stock_quantity)
      select id, 'zero-stock', 5000, '[]'::jsonb, 'stocked', 0 from public.products where slug = 'sold-out';
    `);
    await db.exec(await readFile(migrationPaths[4], "utf8"));
    await db.exec(await readFile(migrationPaths[5], "utf8"));

    await db.exec("set role anon");
    const shops = await db.query("select slug from public.shops order by slug");
    assert.deepEqual(shops.rows.map((row) => row.slug), ["active-shop"]);
    const products = await db.query("select slug from public.products order by slug");
    assert.deepEqual(products.rows.map((row) => row.slug), ["sold-out", "visible-high", "visible-low"]);
    const visibleVariants = await db.query("select product_id, price_fils, supply_mode from public.product_variants order by product_id, price_fils");
    assert.equal(visibleVariants.rows.length, 2);
    await assert.rejects(db.query("select sku from public.product_variants"), /permission denied for table product_variants/);
    await assert.rejects(db.query("select stock_quantity from public.product_variants"), /permission denied for table product_variants/);

    const search = await db.query(`
      select product_slug, total_count from public.search_public_catalog('', null, 'newest', 24, 0, 5000, 10000)
    `);
    assert.deepEqual(search.rows, [{ product_slug: "visible-high", total_count: 1 }]);

    const lowPrice = await db.query(`
      select product_slug from public.search_public_catalog('', null, 'price_low', 24, 0, null, null)
    `);
    assert.deepEqual(lowPrice.rows.map((row) => row.product_slug), ["visible-low", "visible-high"]);

    await db.exec("reset role");
    await db.query("update public.products set title_ar = $1, title_en = $2 where slug = 'visible-low'", ["فُستان أزرق", "Visible low"]);
    await db.query("update public.products set title_ar = $1, title_en = $2 where slug = 'visible-high'", ["فستان أحمر", "Visible"]);
    await db.exec("set role anon");
    const arabic = await db.query("select product_slug from public.search_public_catalog($1)", ["فستان ازرق"]);
    assert.deepEqual(arabic.rows.map((row) => row.product_slug), ["visible-low"]);
    const ranked = await db.query("select product_slug from public.search_public_catalog('Visible')");
    assert.deepEqual(ranked.rows.map((row) => row.product_slug), ["visible-high", "visible-low"]);
    for (const literal of ["%", "_"]) {
      const result = await db.query("select product_slug from public.search_public_catalog($1)", [literal]);
      assert.deepEqual(result.rows, []);
    }
    await assert.rejects(
      db.query("select public.normalize_catalog_search('test')"),
      /permission denied for function normalize_catalog_search/,
    );

    const maxQuery = await db.query(`select * from public.search_public_catalog('${"x".repeat(100)}')`);
    assert.deepEqual(maxQuery.rows, []);
    const lastPage = await db.query("select * from public.search_public_catalog('', null, 'newest', 24, 23976, null, null)");
    assert.deepEqual(lastPage.rows, []);

    await assert.rejects(
      db.query(`select * from public.search_public_catalog('${"x".repeat(101)}')`),
      /p_query must not exceed 100 characters/,
    );
    await assert.rejects(
      db.query("select * from public.search_public_catalog('', null, 'newest', 24, -1, null, null)"),
      /p_offset must be between 0 and 23976/,
    );
    await assert.rejects(
      db.query("select * from public.search_public_catalog('', null, 'newest', 24, 23977, null, null)"),
      /p_offset must be between 0 and 23976/,
    );

    await assert.rejects(
      db.exec("insert into public.categories (slug, name_ar, name_en) values ('anon-write', 'ممنوع', 'No write')"),
      /permission denied for table categories/,
    );

    await db.exec("reset role");
    const options = JSON.stringify([{ label_ar: "المقاس", label_en: "Size", value_ar: "كبير", value_en: "Large" }]);
    await db.query("insert into public.product_variants (product_id, sku, price_fils, option_values, supply_mode, stock_quantity) select id, 'size-large', 4500, $1::jsonb, 'stocked', 2 from public.products where slug = 'visible-low'", [options]);
    await assert.rejects(
      db.query("insert into public.product_variants (product_id, sku, price_fils, option_values, supply_mode, stock_quantity) select id, 'size-large-copy', 4500, $1::jsonb, 'stocked', 2 from public.products where slug = 'visible-low'", [options]),
      /duplicate key value violates unique constraint/,
    );
    await assert.rejects(
      db.query(`insert into public.product_variants (product_id, sku, price_fils, option_values, supply_mode, stock_quantity) select id, 'invalid-options', 4500, '[{"label_en":"Size"}]'::jsonb, 'stocked', 2 from public.products where slug = 'visible-low'`),
      /violates check constraint/,
    );
    await db.exec("set role anon");
    const facets = await db.query("select public.catalog_filter_options() as value");
    assert.deepEqual(facets.rows[0].value.shops.map((item) => [item.slug, item.count]), [["active-shop", 2]]);
    assert.deepEqual(facets.rows[0].value.attributes.map((item) => [item.label_en, item.values[0].count]), [["Size", 1]]);
    const selected = await db.query(
      "select product_slug from public.search_public_catalog(p_shop_slug => 'active-shop', p_fulfillment => 'stocked', p_options => $1::jsonb)",
      [JSON.stringify([JSON.parse(options)[0]])],
    );
    assert.deepEqual(selected.rows.map((row) => row.product_slug), ["visible-low"]);
    const otherShop = await db.query("select product_slug from public.search_public_catalog(p_shop_slug => 'pending-shop')");
    assert.deepEqual(otherShop.rows, []);
    const noStock = await db.query("select product_slug from public.search_public_catalog(p_fulfillment => 'stocked')");
    assert.deepEqual(noStock.rows.map((row) => row.product_slug), ["visible-low"]);
    await assert.rejects(db.query("select * from public.search_public_catalog(p_options => '{}'::jsonb)"), /invalid options/);
  } finally {
    await db.close();
  }
});
