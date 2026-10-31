import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationNames = [
  "202610220001_public_catalog.sql",
  "202610220002_catalog_price_filters.sql",
  "202610220003_catalog_rpc_bounds.sql",
  "202610220005_product_variants.sql",
  "202610220006_one_shop_per_seller.sql",
  "202610220007_generated_variant_sku.sql",
  "202610220008_seller_onboarding.sql",
  "202610220009_seller_catalog.sql",
  "202610220010_stock_adjustments.sql",
  "202610220011_category_approval.sql",
  "202610220012_edit_seller_product.sql",
];
const seller = "00000000-0000-4000-8000-000000000001";
const buyer = "00000000-0000-4000-8000-000000000002";
const admin = "00000000-0000-4000-8000-000000000003";
const owner = "00000000-0000-4000-8000-000000000004";

test("seller onboarding enforces applicant, assigned reviewer and owner boundaries", async () => {
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
      create table storage.buckets (
        id text primary key, name text not null, public boolean not null,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(), bucket_id text not null,
        name text not null, owner_id text, metadata jsonb not null default '{}'::jsonb,
        unique (bucket_id, name)
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select, insert on storage.objects to authenticated;
      insert into auth.users (id, email) values
        ('${seller}', 'seller@example.test'), ('${buyer}', 'buyer@example.test'),
        ('${admin}', 'admin@example.test'), ('${owner}', 'owner@example.test');
    `);
    for (const migration of migrationNames) {
      const path = new URL(`../../../../supabase/migrations/${migration}`, import.meta.url);
      await db.exec(await readFile(path, "utf8"));
    }

    await db.exec(`set role service_role; select public.bootstrap_platform_owner('${owner}'); reset role;`);
    await assert.rejects(db.exec(`set role service_role; select public.bootstrap_platform_owner('${buyer}');`), /already bootstrapped/);
    await db.exec(`insert into public.platform_staff (user_id, role) values ('${admin}', 'admin');`);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${seller}';`);
    const applicationId = (await db.query(`insert into public.seller_applications
      (applicant_user_id, store_name_ar, store_name_en, contact, address)
      values ('${seller}', 'متجر البائع', 'Seller Shop', '+962790000000', 'Amman') returning id`)).rows[0].id;
    const proofPath = `${applicationId}/00000000-0000-4000-8000-000000000099.pdf`;
    await db.query(`insert into storage.objects (bucket_id, name, owner_id, metadata)
      values ('seller-address-proofs', $1, $2, $3::jsonb)`, [
      proofPath, seller, JSON.stringify({ size: 2048, mimetype: "application/pdf" }),
    ]);
    await db.query("update public.seller_applications set proof_path = $1 where id = $2", [proofPath, applicationId]);
    await db.query("select public.submit_seller_application($1)", [applicationId]);
    assert.equal((await db.query("select status from public.seller_applications where id = $1", [applicationId])).rows[0].status, "submitted");
    assert.equal((await db.query("select id from storage.objects where name = $1", [proofPath])).rows.length, 0,
      "seller can upload proof but cannot read or download it");

    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    assert.equal((await db.query("select id from public.seller_applications where id = $1", [applicationId])).rows.length, 0);
    await assert.rejects(db.query("insert into storage.objects (bucket_id, name, owner_id) values ('seller-address-proofs', $1, $2)", [proofPath, buyer]), /row-level security policy/);

    await db.exec(`set request.jwt.claim.sub = '${admin}'; set request.jwt.claim.aal = 'aal1';`);
    await assert.rejects(db.query("select public.propose_category('home-goods', 'المنزل', 'Home goods')"), /not authorized/,
      "staff without MFA cannot propose a category");
    await db.exec(`set request.jwt.claim.aal = 'aal2';`);
    const categoryProposalId = (await db.query("select public.propose_category('home-goods', 'المنزل', 'Home goods') as id")).rows[0].id;
    assert.equal((await db.query("select id from public.categories where slug = 'home-goods'")).rows.length, 0,
      "proposed categories are not public or active before owner approval");
    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    await assert.rejects(db.query("select public.review_category_proposal($1, 'approve')", [categoryProposalId]), /not authorized/);
    await db.exec(`set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal2';`);
    assert.equal((await db.query("select count(*)::int as count from public.list_category_proposals()")).rows[0].count, 1);
    await db.query("select public.review_category_proposal($1, 'approve')", [categoryProposalId]);
    assert.equal((await db.query("select status from public.categories where slug = 'home-goods'")).rows[0].status, "active");
    const rejectedProposal = (await db.query("select public.propose_category('garden-tools', 'أدوات الحدائق', 'Garden tools') as id")).rows[0].id;
    await db.query("select public.review_category_proposal($1, 'reject')", [rejectedProposal]);
    assert.equal((await db.query("select id from public.categories where slug = 'garden-tools'")).rows.length, 0);

    await db.exec(`set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal2';`);
    await db.query("select public.assign_seller_reviewer($1, $2)", [applicationId, admin]);
    assert.equal((await db.query("select email from public.search_existing_accounts('seller@')")).rows[0].email, "seller@example.test");
    await db.query("select public.provision_platform_admin($1)", [buyer]);

    await db.exec(`set request.jwt.claim.sub = '${admin}'; set request.jwt.claim.aal = 'aal1';`);
    assert.equal((await db.query("select id from public.seller_applications where id = $1", [applicationId])).rows.length, 0,
      "AAL1 admin sessions cannot read seller application details");
    await assert.rejects(db.query("select public.review_seller_application($1, 'approve')", [applicationId]), /not authorized/);
    await db.exec(`set request.jwt.claim.sub = '${buyer}'; set request.jwt.claim.aal = 'aal2';`);
    assert.equal((await db.query("select id from public.seller_applications where id = $1", [applicationId])).rows.length, 0,
      "an unassigned administrator cannot read application details");
    assert.equal((await db.query("select id from storage.objects where name = $1", [proofPath])).rows.length, 0,
      "an unassigned administrator cannot read address proof");

    await db.exec(`set request.jwt.claim.sub = '${admin}'; set request.jwt.claim.aal = 'aal2';`);
    assert.equal((await db.query("select id from storage.objects where name = $1", [proofPath])).rows.length, 1,
      "only the assigned admin can access the address proof");
    await db.query("select public.review_seller_application($1, 'reject', 'Please provide a current address document.')", [applicationId]);

    await db.exec(`set request.jwt.claim.sub = '${seller}';`);
    assert.equal((await db.query("select status from public.seller_applications where id = $1", [applicationId])).rows[0].status, "rejected");
    await db.query("update public.seller_applications set contact = 'seller-updated@example.test' where id = $1", [applicationId]);
    const resubmittedProof = `${applicationId}/00000000-0000-4000-8000-000000000098.png`;
    await db.query(`insert into storage.objects (bucket_id, name, owner_id, metadata)
      values ('seller-address-proofs', $1, $2, $3::jsonb)`, [
      resubmittedProof, seller, JSON.stringify({ size: 3072, mimetype: "image/png" }),
    ]);
    await db.query("update public.seller_applications set proof_path = $1 where id = $2", [resubmittedProof, applicationId]);
    await db.query("select public.submit_seller_application($1)", [applicationId]);

    await db.exec(`set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal2';`);
    await db.query("select public.assign_seller_reviewer($1, $2)", [applicationId, admin]);
    await db.exec(`set request.jwt.claim.sub = '${admin}'; set request.jwt.claim.aal = 'aal2';`);
    assert.equal((await db.query("select id from storage.objects where name = $1", [resubmittedProof])).rows.length, 1);
    const shopId = (await db.query("select public.review_seller_application($1, 'approve') as shop_id", [applicationId])).rows[0].shop_id;
    assert.equal((await db.query("select status from public.shops where id = $1", [shopId])).rows[0].status, "active");

    await db.exec(`set request.jwt.claim.sub = '${seller}';`);
    const categoryId = (await db.query("select id from public.categories where slug = 'clothing'")).rows[0].id;
    const variants = [
      { price_fils: "1250", supply_mode: "stocked", stock_quantity: "3", option_values: [{ label_ar: "المقاس", label_en: "Size", value_ar: "صغير", value_en: "Small" }] },
      { sku: "BLUE-M", price_fils: "1350", supply_mode: "after_order", option_values: [{ label_ar: "المقاس", label_en: "Size", value_ar: "متوسط", value_en: "Medium" }] },
    ];
    const productId = (await db.query(`select public.create_seller_product($1, $2, $3, $4, '', '', $5::jsonb) as product_id`, [
      shopId, categoryId, "قميص", "Shirt", JSON.stringify(variants),
    ])).rows[0].product_id;
    assert.equal((await db.query("select status from public.products where id = $1", [productId])).rows[0].status, "published");
    const publicCard = await db.query("select product_id, price_fils from public.search_public_catalog('Shirt', 'clothing', 'newest', 24, 0, null, null)");
    assert.deepEqual(publicCard.rows.map(({ product_id, price_fils }) => [product_id, Number(price_fils)]), [[productId, 1250]],
      "the seller's committed variants appear in the public catalog at the lowest available price");
    const listed = (await db.query("select variants from public.list_shop_catalog($1) where product_id = $2", [shopId, productId])).rows[0].variants;
    assert.match(listed[0].sku, /^SKU-[A-F0-9]{32}$/);
    assert.equal(listed[0].stock_quantity, 3);
    const adjustmentId = "00000000-0000-4000-8000-000000000010";
    assert.equal((await db.query("select public.adjust_variant_stock($1, $2, $3, -2, 'Stock count correction') as quantity", [adjustmentId, shopId, listed[0].id])).rows[0].quantity, 1);
    assert.equal((await db.query("select public.adjust_variant_stock($1, $2, $3, -2, 'Stock count correction') as quantity", [adjustmentId, shopId, listed[0].id])).rows[0].quantity, 1,
      "replaying a matching idempotency key does not apply the stock delta twice");
    assert.equal((await db.query("select count(*)::int as count from public.list_shop_stock_adjustments($1)", [shopId])).rows[0].count, 1);
    await assert.rejects(db.query("select public.adjust_variant_stock($1, $2, $3, -1, 'Wrong retry')", [adjustmentId, shopId, listed[0].id]), /already used/);
    await assert.rejects(db.query("select public.adjust_variant_stock($1, $2, $3, -2, 'Excess removal')", ["00000000-0000-4000-8000-000000000011", shopId, listed[0].id]), /inventory bounds/);
    assert.equal(listed[1].sku, "BLUE-M");
    const editedId = (await db.query(`select public.update_seller_product($1, $2, $3, 'قميص معدّل', 'Updated shirt', '', '', $4::jsonb) as product_id`, [
      shopId, productId, categoryId, JSON.stringify([
        { variant_id: listed[0].id, sku: listed[0].sku, price_fils: "1450", supply_mode: "stocked", stock_quantity: 3, option_values: listed[0].option_values },
        { variant_id: listed[1].id, sku: listed[1].sku, price_fils: "1550", supply_mode: "after_order", stock_quantity: null, option_values: listed[1].option_values },
      ]),
    ])).rows[0].product_id;
    assert.equal(editedId, productId);
    assert.equal((await db.query("select title_en from public.products where id = $1", [productId])).rows[0].title_en, "Updated shirt");
    const editedListing = (await db.query("select variants from public.list_shop_catalog($1) where product_id = $2", [shopId, productId])).rows[0].variants;
    assert.equal(editedListing[0].stock_quantity, 1,
      "listing edits cannot change inventory outside the audited stock adjustment workflow");
    await assert.rejects(db.query(`select public.update_seller_product($1, $2, $3, 'Bad', 'Bad', '', '', $4::jsonb)`, [
      shopId, productId, categoryId, JSON.stringify([{ variant_id: listed[0].id, sku: listed[0].sku, price_fils: "1450", supply_mode: "stocked", option_values: listed[0].option_values }]),
    ]), /variant set cannot be added or removed/);
    await assert.rejects(db.query("select public.adjust_variant_stock($1, $2, $3, 1, 'Not stocked')", ["00000000-0000-4000-8000-000000000012", shopId, listed[1].id]), /only stocked variants/);
    assert.equal((await db.query("select count(*)::int as count from public.list_shop_stock_adjustments($1)", [shopId])).rows[0].count, 1);
    assert.deepEqual(listed[1].option_values[0], { label_ar: "المقاس", label_en: "Size", value_ar: "متوسط", value_en: "Medium" });
    await assert.rejects(db.query(`select public.create_seller_product($1, $2, 'Invalid', 'Invalid', '', '', $3::jsonb)`, [
      shopId, categoryId, JSON.stringify([
        { sku: "DUPLICATE", price_fils: "1000", supply_mode: "after_order", option_values: [] },
        { sku: "DUPLICATE", price_fils: "1100", supply_mode: "after_order", option_values: [] },
      ]),
    ]), /duplicate key/);
    assert.equal((await db.query("select count(*)::int as count from public.products where shop_id = $1", [shopId])).rows[0].count, 1,
      "a failed variant insert rolls back the published product too");
    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    await assert.rejects(db.query("select public.adjust_variant_stock($1, $2, $3, 1, 'Unauthorized')", ["00000000-0000-4000-8000-000000000013", shopId, listed[0].id]), /not authorized/);
    assert.equal((await db.query("select id from public.products where id = $1", [productId])).rows.length, 1,
      "published catalog records remain publicly readable");
    await assert.rejects(db.query("select * from public.list_shop_catalog($1)", [shopId]), /not authorized/,
      "unassigned marketplace accounts cannot read private SKU and stock data");
    await db.exec(`set request.jwt.claim.sub = '${seller}';`);

    await db.query("select public.set_shop_staff_access($1, $2, array['catalog', 'orders'])", [shopId, buyer]);
    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    assert.deepEqual((await db.query("select role from public.shop_members where shop_id = $1 order by role", [shopId])).rows.map(({ role }) => role), ["catalog", "orders"]);
    await assert.rejects(db.query("select * from public.list_shop_staff($1)", [shopId]), /not authorized/);
    await db.exec(`set request.jwt.claim.sub = '${seller}';`);
    assert.deepEqual((await db.query("select roles from public.list_shop_staff($1)", [shopId])).rows[0].roles, ["catalog", "orders"]);
    assert.equal((await db.query("select email from public.search_shop_staff_accounts($1, 'buyer@')", [shopId])).rows[0].email, "buyer@example.test");
    const staffProductId = (await db.query(`select public.create_seller_product($1, $2, 'منتج الموظف', 'Staff product', '', '', $3::jsonb) as product_id`, [
      shopId, categoryId, JSON.stringify([{ price_fils: "2500", supply_mode: "after_order", option_values: [] }]),
    ])).rows[0].product_id;
    assert.ok(staffProductId, "catalog staff can publish a product");
    await db.query("select public.set_shop_staff_access($1, $2, array['orders'])", [shopId, buyer]);
    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    await assert.rejects(db.query(`select public.create_seller_product($1, $2, 'Denied', 'Denied', '', '', $3::jsonb)`, [
      shopId, categoryId, JSON.stringify([{ price_fils: "1000", supply_mode: "after_order", option_values: [] }]),
    ]), /not authorized/);
    await db.exec(`set request.jwt.claim.sub = '${seller}';`);
    await db.query("select public.set_shop_staff_access($1, $2, array[]::text[])", [shopId, buyer]);
    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    assert.equal((await db.query("select role from public.shop_members where shop_id = $1", [shopId])).rows.length, 0,
      "an empty role selection removes both staff capabilities");
    await assert.rejects(db.query("select public.provision_platform_admin($1)", [seller]), /not authorized/);

    await db.exec(`set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal2';`);
    await db.query("select public.revoke_platform_admin($1)", [buyer]);
    await db.exec(`set request.jwt.claim.sub = '${buyer}';`);
    assert.equal((await db.query("select public.is_platform_admin() as is_admin")).rows[0].is_admin, false,
      "owner can revoke an admin through the audited security-definer function");
    await db.exec(`set request.jwt.claim.sub = '${owner}'; set request.jwt.claim.aal = 'aal2';`);
    const audit = await db.query("select actor_email, target_email, action from public.list_platform_admin_events()");
    assert.deepEqual(audit.rows.map(({ actor_email, target_email, action }) => [actor_email, target_email, action]), [
      ["owner@example.test", "buyer@example.test", "revoked"],
      ["owner@example.test", "buyer@example.test", "granted"],
    ]);
  } finally {
    await db.close();
  }
});
