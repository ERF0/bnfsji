import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "202610220001_public_catalog.sql", "202610220002_catalog_price_filters.sql", "202610220003_catalog_rpc_bounds.sql",
  "202610220005_product_variants.sql", "202610220006_one_shop_per_seller.sql", "202610220007_generated_variant_sku.sql",
  "202610220008_seller_onboarding.sql", "202610220009_seller_catalog.sql", "202610220010_stock_adjustments.sql",
  "202610220011_category_approval.sql", "202610220012_edit_seller_product.sql", "202610220013_delivery_fees.sql",
  "202610220014_product_media.sql",
];
const sellerA = "00000000-0000-4000-8000-000000000001";
const sellerB = "00000000-0000-4000-8000-000000000002";
const buyer = "00000000-0000-4000-8000-000000000003";
const shopA = "10000000-0000-4000-8000-000000000001";
const shopB = "10000000-0000-4000-8000-000000000002";
const productA = "20000000-0000-4000-8000-000000000001";
const productB = "20000000-0000-4000-8000-000000000002";

test("product image uploads stay private until verified, are seller-scoped, capped, reorderable and deletable", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (id uuid primary key, email text unique);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select jsonb_build_object('aal', nullif(current_setting('request.jwt.claim.aal', true), ''))
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      grant execute on function auth.jwt() to anon, authenticated;
      create schema storage;
      create table storage.buckets (id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (
        id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null,
        owner_id text, metadata jsonb not null default '{}'::jsonb, unique (bucket_id, name)
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select on storage.objects to anon, authenticated;
      grant insert, delete on storage.objects to authenticated;
      insert into auth.users (id, email) values
        ('${sellerA}', 'seller-a@example.test'), ('${sellerB}', 'seller-b@example.test'), ('${buyer}', 'buyer@example.test');
    `);
    for (const migration of migrations) {
      const path = new URL(`../../../../supabase/migrations/${migration}`, import.meta.url);
      await db.exec(await readFile(path, "utf8"));
    }
    const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id='product-images'")).rows[0];
    assert.deepEqual(bucket, { public: false, file_size_limit: 10 * 1024 * 1024, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] });
    await db.exec(`
      insert into public.shops (id, owner_user_id, slug, name_ar, name_en, status) values
        ('${shopA}', '${sellerA}', 'shop-a', 'متجر أ', 'Shop A', 'active'),
        ('${shopB}', '${sellerB}', 'shop-b', 'متجر ب', 'Shop B', 'active');
      insert into public.products (id, shop_id, category_id, slug, title_ar, title_en, status, published_at)
      select '${productA}', '${shopA}', id, 'product-a', 'منتج أ', 'Product A', 'published', now()
      from public.categories where slug = 'clothing';
      insert into public.products (id, shop_id, category_id, slug, title_ar, title_en, status, published_at)
      select '${productB}', '${shopB}', id, 'product-b', 'منتج ب', 'Product B', 'published', now()
      from public.categories where slug = 'clothing';
    `);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${sellerA}';`);
    const firstId = "30000000-0000-4000-8000-000000000001";
    const first = (await db.query("select * from public.begin_seller_product_image_upload($1,$2,$3,$4)", [shopA, productA, firstId, "image/jpeg"])).rows[0];
    await assert.rejects(db.query("select * from public.begin_seller_product_image_upload($1,$2,$3,$4)", [shopA, productA, "30000000-0000-4000-8000-000000000098", "image/gif"]), /invalid product image/);
    assert.equal(first.storage_path, `${shopA}/${productA}/${firstId}.jpg`);
    assert.equal(first.sort_order, 0);
    await db.query("insert into storage.objects (bucket_id,name,owner_id,metadata) values ('product-images',$1,$2,$3::jsonb)", [
      first.storage_path, sellerA, JSON.stringify({ size: 1024, mimetype: "image/jpeg" }),
    ]);
    assert.equal((await db.query("select id from storage.objects where bucket_id='product-images' and name=$1", [first.storage_path])).rows.length, 1,
      "the uploader can inspect its pending photo for image validation");
    await assert.rejects(db.query("select * from public.begin_seller_product_image_upload($1,$2,$3,$4)", [shopB, productB, "30000000-0000-4000-8000-000000000099", "image/png"]), /not authorized/);
    await db.exec(`set request.jwt.claim.sub = '${sellerB}';`);
    await assert.rejects(db.query("insert into storage.objects (bucket_id,name,owner_id) values ('product-images',$1,$2)", [first.storage_path, sellerB]), /row-level security policy/);
    assert.equal((await db.query("select id from public.product_images where product_id=$1", [productA])).rows.length, 0);
    await db.exec(`set role anon;`);
    assert.equal((await db.query("select id from public.product_images where product_id=$1", [productA])).rows.length, 0,
      "pending images are invisible to buyers");
    assert.equal((await db.query("select id from storage.objects where bucket_id='product-images' and name=$1", [first.storage_path])).rows.length, 0,
      "pending storage objects cannot be downloaded by buyers");

    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${sellerA}';`);
    await db.query("select public.activate_seller_product_image($1,$2)", [shopA, firstId]);
    await db.exec("reset role; set role anon;");
    assert.equal((await db.query("select id from public.product_images where product_id=$1", [productA])).rows.length, 1);
    assert.equal((await db.query("select id from storage.objects where bucket_id='product-images' and name=$1", [first.storage_path])).rows.length, 1,
      "buyers can fetch only the activated photo attached to a published product");

    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${sellerA}';`);
    const imageIds = [firstId];
    for (let index = 2; index <= 10; index += 1) {
      const imageId = `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
      await db.query("select * from public.begin_seller_product_image_upload($1,$2,$3,$4)", [shopA, productA, imageId, "image/webp"]);
      await db.query("select public.activate_seller_product_image($1,$2)", [shopA, imageId]);
      imageIds.push(imageId);
    }
    await db.exec("reset role;");
    await assert.rejects(
      db.query("select * from public.begin_seller_product_image_upload($1,$2,$3,$4)", [shopA, productA, "30000000-0000-4000-8000-000000000011", "image/png"]),
      /image limit reached/,
    );
    const reversed = [...imageIds].reverse();
    await db.query("select public.reorder_seller_product_images($1,$2,$3)", [shopA, productA, reversed]);
    assert.deepEqual((await db.query("select id from public.product_images where product_id=$1 order by sort_order", [productA])).rows.map(({ id }) => id), reversed);
    await db.query("select public.begin_seller_product_image_delete($1,$2)", [shopA, firstId]);
    await db.exec("set role anon;");
    assert.equal((await db.query("select id from storage.objects where bucket_id='product-images' and name=$1", [first.storage_path])).rows.length, 0,
      "a deleting photo immediately stops resolving for buyers");
    await db.exec("reset role;");
    await db.query("delete from storage.objects where bucket_id='product-images' and name=$1", [first.storage_path]);
    await db.query("select public.complete_seller_product_image_delete($1,$2)", [shopA, firstId]);
    const remaining = (await db.query("select sort_order from public.product_images where product_id=$1 order by sort_order", [productA])).rows;
    assert.equal(remaining.length, 9);
    assert.deepEqual(remaining.map(({ sort_order }) => sort_order), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await assert.rejects(
      db.query("insert into public.product_images (id,shop_id,product_id,storage_path,content_type,sort_order) values ($1,$2,$3,$4,$5,$6)", [
        "40000000-0000-4000-8000-000000000001", shopA, productB,
        `${shopA}/${productB}/40000000-0000-4000-8000-000000000001.jpg`, "image/jpeg", 0,
      ]),
      /foreign key constraint/,
      "a product image cannot pair one seller's shop with another seller's product",
    );
  } finally {
    await db.close();
  }
});
