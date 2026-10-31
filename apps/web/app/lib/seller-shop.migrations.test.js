import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "202610220001_public_catalog.sql",
  "202610220002_catalog_price_filters.sql",
  "202610220003_catalog_rpc_bounds.sql",
  "202610220005_product_variants.sql",
  "202610220006_one_shop_per_seller.sql",
  "202610220007_generated_variant_sku.sql",
];

test("seller account can own only one shop", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users (id) values
        ('00000000-0000-4000-8000-000000000001'),
        ('00000000-0000-4000-8000-000000000002');
    `);
    for (const migration of migrations) {
      const path = new URL(`../../../../supabase/migrations/${migration}`, import.meta.url);
      await db.exec(await readFile(path, "utf8"));
    }
    await db.exec(`
      insert into public.shops (owner_user_id, slug, name_ar, name_en, status) values
        ('00000000-0000-4000-8000-000000000001', 'first-shop', 'Ù…ØªØ¬Ø±', 'First shop', 'pending_review'),
        ('00000000-0000-4000-8000-000000000002', 'second-seller-shop', 'Ù…ØªØ¬Ø± Ø¢Ø®Ø±', 'Second seller shop', 'active');
    `);
    await assert.rejects(
      db.query("insert into public.shops (owner_user_id, slug, name_ar, name_en) values ('00000000-0000-4000-8000-000000000001', 'duplicate-shop', 'Ù…ØªØ¬Ø± Ø«Ø§Ù†ÙŠ', 'Duplicate shop')"),
      /duplicate key value violates unique constraint/,
    );
    const productId = (await db.query("insert into public.products (shop_id, category_id, slug, title_ar, title_en) select s.id, c.id, 'sku-test', 'Ù…Ù†ØªØ¬', 'SKU test' from public.shops s cross join public.categories c where s.slug = 'second-seller-shop' and c.slug = 'clothing' returning id")).rows[0].id;
    const skus = await db.query(`
      insert into public.product_variants (product_id, price_fils, option_values, supply_mode) values
        ($1, 1000, '[{"label_ar":"المقاس","label_en":"Size","value_ar":"صغير","value_en":"Small"}]', 'after_order'),
        ($1, 1200, '[{"label_ar":"المقاس","label_en":"Size","value_ar":"كبير","value_en":"Large"}]', 'after_order')
      returning sku
    `, [productId]);
    assert.equal(skus.rows.length, 2);
    assert.ok(skus.rows.every(({ sku }) => /^SKU-[0-9A-F]{32}$/.test(sku)));
    assert.notEqual(skus.rows[0].sku, skus.rows[1].sku);
    await db.query("update public.product_variants set sku = 'seller-edited-sku' where product_id = $1 and sku = $2", [productId, skus.rows[0].sku]);
    assert.equal((await db.query("select sku from public.product_variants where product_id = $1 and sku = 'seller-edited-sku'", [productId])).rows.length, 1);
    assert.equal((await db.query("select count(*)::int as count from public.shops")).rows[0].count, 2);
  } finally {
    await db.close();
  }
});
