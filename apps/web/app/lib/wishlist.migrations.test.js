import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "202610220001_public_catalog.sql",
  "202610220002_catalog_price_filters.sql",
  "202610220003_catalog_rpc_bounds.sql",
  "202610220004_buyer_wishlist.sql",
];
const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";

test("wishlist migration applies and RLS isolates authenticated buyer records", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users (id) values ('${userA}'), ('${userB}');
    `);
    for (const migration of migrations) {
      const path = new URL(`../../../../supabase/migrations/${migration}`, import.meta.url);
      await db.exec(await readFile(path, "utf8"));
    }
    await db.exec(`
      insert into public.shops (owner_user_id, slug, name_ar, name_en, status)
      values ('${userA}', 'active-shop', 'متجر', 'Active shop', 'active');
      insert into public.products (shop_id, category_id, slug, title_ar, title_en, price_fils, status)
      select s.id, c.id, 'public-item', 'منتج', 'Public item', 1000, 'published'
      from public.shops s cross join public.categories c
      where s.slug = 'active-shop' and c.slug = 'clothing';
      insert into public.products (shop_id, category_id, slug, title_ar, title_en, price_fils, status)
      select s.id, c.id, 'draft-item', 'مسودة', 'Draft item', 1000, 'draft'
      from public.shops s cross join public.categories c
      where s.slug = 'active-shop' and c.slug = 'clothing';
    `);
    const productId = (await db.query("select id from public.products where slug = 'public-item'")).rows[0].id;
    const draftId = (await db.query("select id from public.products where slug = 'draft-item'")).rows[0].id;

    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userA}';`);
    await db.query("insert into public.wishlist_items (user_id, product_id) values ($1, $2)", [userA, productId]);
    assert.equal((await db.query("select product_id from public.wishlist_items")).rows.length, 1);
    await assert.rejects(
      db.query("insert into public.wishlist_items (user_id, product_id) values ($1, $2)", [userB, productId]),
      /row-level security policy/,
    );
    await assert.rejects(
      db.query("insert into public.wishlist_items (user_id, product_id) values ($1, $2)", [userA, draftId]),
      /row-level security policy/,
    );

    await db.exec(`set request.jwt.claim.sub = '${userB}';`);
    assert.equal((await db.query("select product_id from public.wishlist_items")).rows.length, 0);
    await db.query("delete from public.wishlist_items where product_id = $1", [productId]);
    await db.exec(`set request.jwt.claim.sub = '${userA}';`);
    assert.equal((await db.query("select product_id from public.wishlist_items")).rows.length, 1);
    await db.query("delete from public.wishlist_items where product_id = $1", [productId]);
    assert.equal((await db.query("select product_id from public.wishlist_items")).rows.length, 0);
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select product_id from public.wishlist_items"), /permission denied/);
    await assert.rejects(db.query("insert into public.wishlist_items (user_id, product_id) values ($1, $2)", [userB, productId]), /permission denied/);
  } finally {
    await db.close();
  }
});
