import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationNames = [
  "202610220001_public_catalog.sql", "202610220002_catalog_price_filters.sql", "202610220003_catalog_rpc_bounds.sql",
  "202610220005_product_variants.sql", "202610220006_one_shop_per_seller.sql", "202610220007_generated_variant_sku.sql",
  "202610220008_seller_onboarding.sql", "202610220009_seller_catalog.sql", "202610220010_stock_adjustments.sql",
  "202610220011_category_approval.sql", "202610220012_edit_seller_product.sql", "202610220013_delivery_fees.sql", "202610220015_buyer_delivery_quote.sql",
];
const seller = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000003";
const owner = "00000000-0000-4000-8000-000000000004";
const shop = "00000000-0000-4000-8000-000000000005";

test("delivery fee settings enforce seller ownership, owner MFA, fils bounds and audit history", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create schema auth;
      create table auth.users (id uuid primary key, email text unique);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal', nullif(current_setting('request.jwt.claim.aal', true), '')) $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      grant execute on function auth.jwt() to anon, authenticated;
      create schema storage;
      create table storage.buckets (id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null, owner_id text, metadata jsonb not null default '{}'::jsonb, unique (bucket_id, name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select, insert on storage.objects to authenticated;
      insert into auth.users (id, email) values
        ('${seller}', 'seller@example.test'), ('${other}', 'other@example.test'),
        ('${admin}', 'admin@example.test'), ('${owner}', 'owner@example.test');
    `);
    for (const name of migrationNames) {
      const path = new URL(`../../../../supabase/migrations/${name}`, import.meta.url);
      await db.exec(await readFile(path, "utf8"));
    }
    await db.exec(`
      insert into public.shops (id, owner_user_id, slug, name_ar, name_en, status)
      values ('${shop}', '${seller}', 'seller-shop', 'متجر', 'Seller shop', 'active');
      insert into public.shops (id, owner_user_id, slug, name_ar, name_en, status)
        values ('00000000-0000-4000-8000-000000000006', '${other}', 'other-shop', 'متجر آخر', 'Other shop', 'active');
      select public.bootstrap_platform_owner('${owner}');
      insert into public.platform_staff (user_id, role, created_by) values ('${admin}', 'admin', '${owner}');
    `);

    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${seller}';`);
    const [settings] = (await db.query("select * from public.get_my_delivery_settings()")).rows;
    assert.equal(settings.seller_fee_fils, null);
    assert.equal(settings.platform_fee_fils, null);
    assert.equal((await db.query("select public.set_shop_delivery_fee($1, $2)", [shop, 2750])).rows[0].set_shop_delivery_fee, 2750);
    assert.equal((await db.query("select seller_delivery_fee_fils from public.shops where id = $1", [shop])).rows[0].seller_delivery_fee_fils, 2750);
    await db.query("select public.set_shop_delivery_fee($1, $2)", [shop, 2750]);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as n from public.delivery_fee_events where scope = 'seller' and shop_id = $1", [shop])).rows[0].n, 1,
      "an unchanged fee does not create a duplicate audit record");
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${seller}';`);
    await assert.rejects(db.query("select public.set_shop_delivery_fee($1, $2)", [shop, -1]), /invalid delivery fee/);
    await assert.rejects(db.query("select public.set_shop_delivery_fee($1, $2)", [shop, 9007199254740992n]), /invalid delivery fee/);
    await assert.rejects(db.query("update public.shops set seller_delivery_fee_fils = 1 where id = $1", [shop]), /permission denied/);
    const sellerHistory = await db.query("select scope, fee_before_fils, fee_after_fils, actor_email from public.list_delivery_fee_events('seller', $1)", [shop]);
    assert.deepEqual(sellerHistory.rows, [{ scope: "seller", fee_before_fils: null, fee_after_fils: 2750, actor_email: "seller@example.test" }]);
    await assert.rejects(db.query("select * from public.delivery_fee_events"), /permission denied/);
    await db.exec(`set request.jwt.claim.sub = '${other}';`);
    await assert.rejects(db.query("select public.set_shop_delivery_fee($1, 1)", [shop]), /not authorized/,
      "a seller cannot change another shop's fee");

    await db.exec(`set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal1';`);
    await assert.rejects(db.query("select public.set_platform_delivery_fee(3000)"), /not authorized/,
      "owner actions require MFA");
    await db.exec("set request.jwt.claim.aal = 'aal2';");
    await db.query("select public.set_platform_delivery_fee(3000)");
    assert.equal((await db.query("select fee_fils from public.get_platform_delivery_settings()")).rows[0].fee_fils, 3000);
    assert.equal((await db.query("select count(*)::int as n from public.list_delivery_fee_events('platform')")).rows[0].n, 1);
    await db.exec("reset role");
    assert.equal((await db.query("select count(*)::int as n from public.delivery_fee_events where scope = 'platform'")).rows[0].n, 1);
    await db.exec("set role anon;");
    assert.deepEqual((await db.query("select * from public.get_buyer_delivery_fee(array[$1::uuid])", [shop])).rows,
      [{ delivery_mode: "seller", fee_fils: 2750 }]);
    assert.deepEqual((await db.query("select * from public.get_buyer_delivery_fee(array[$1::uuid, $2::uuid])", [shop, "00000000-0000-4000-8000-000000000006"])).rows,
      [{ delivery_mode: "platform", fee_fils: 3000 }]);
    await assert.rejects(db.query("select * from public.get_buyer_delivery_fee(array[$1::uuid, $1::uuid])", [shop]), /duplicate shop IDs/);
    await assert.rejects(db.query("select * from public.get_buyer_delivery_fee(array['00000000-0000-4000-8000-000000000099'::uuid])"), /shop is unavailable/);
    await assert.rejects(db.query("select * from public.platform_delivery_settings"), /permission denied/);
    await db.exec("reset role;");
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal2';`);

    await db.exec(`set request.jwt.claim.sub = '${admin}'; set request.jwt.claim.aal = 'aal2';`);
    await assert.rejects(db.query("select public.set_platform_delivery_fee(4000)"), /not authorized/,
      "platform admins cannot change founder-controlled delivery pricing");
  } finally {
    await db.close();
  }
});
