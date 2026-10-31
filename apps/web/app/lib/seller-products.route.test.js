import assert from "node:assert/strict";
import test from "node:test";
import { cloudflareContext } from "../lib/cloudflare-context.server.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server.js";
import { action, loader } from "./seller-products.server.js";

const shopId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-000000000002";
const productId = "00000000-0000-4000-8000-000000000003";

function contextFor(supabase) {
  return new Map([
    [supabaseAuthContext, supabase],
    [supabaseClaimsContext, { sub: "00000000-0000-4000-8000-000000000004" }],
    [cloudflareContext, { env: { PUBLIC_SITE_URL: "https://shop.example.test" } }],
  ]);
}

function post(fields) {
  const body = new URLSearchParams({
    intent: "create-product",
    shop_id: shopId,
    category_id: categoryId,
    title_ar: "قميص",
    title_en: "Shirt",
    description_ar: "",
    description_en: "",
    variants_json: JSON.stringify([{ price: "12.500", supply_mode: "after_order", sku: "", stock_quantity: null, option_values: [] }]),
    ...fields,
  });
  return new Request("https://shop.example.test/en/seller/products", {
    method: "POST", headers: { Origin: "https://shop.example.test" }, body,
  });
}

test("seller catalog exposes owner navigation only for the selected owned shop", async () => {
  for (const ownedShopId of [shopId, "00000000-0000-4000-8000-000000000099", null]) {
    const supabase = {
      async rpc(name) {
        if (name === "list_catalog_shops") return { data: [{ shop_id: shopId }], error: null };
        if (name === "get_owned_shop") return { data: ownedShopId ? [{ shop_id: ownedShopId }] : [], error: null };
        if (name === "list_shop_catalog" || name === "list_shop_stock_adjustments") return { data: [], error: null };
        throw new Error(`Unexpected RPC: ${name}`);
      },
      from(table) {
        assert.equal(table, "categories");
        return { select() { return { eq() { return { order: async () => ({ data: [], error: null }) }; } }; } };
      },
    };
    const result = await loader({ request: new Request("https://shop.example.test/en/seller/products"), params: { locale: "en" }, context: contextFor(supabase) });
    assert.equal(result.state, "ready");
    assert.equal(result.ownerAccess, ownedShopId === shopId);
  }
});

test("seller product action sends validated integer-fils variants to the authorized shop RPC", async () => {
  const calls = [];
  const supabase = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === "list_catalog_shops") return { data: [{ shop_id: shopId }], error: null };
    if (name === "create_seller_product") return { data: productId, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const result = await action({ request: post({}), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { success: productId });
  assert.equal(calls[1][1].p_variants[0].price_fils, "12500");
  assert.equal(calls[1][1].p_shop_id, shopId);
});

test("seller product action rejects a shop absent from the caller's authorized shop list", async () => {
  let createCalls = 0;
  const supabase = { async rpc(name) {
    if (name === "list_catalog_shops") return { data: [], error: null };
    if (name === "create_seller_product") createCalls += 1;
    return { data: null, error: null };
  } };
  assert.deepEqual(await action({ request: post({}), params: { locale: "en" }, context: contextFor(supabase) }), { error: "failed" });
  assert.equal(createCalls, 0);
});

test("stock adjustment action validates input and calls the idempotent stock RPC", async () => {
  const adjustmentId = "00000000-0000-4000-8000-000000000005";
  const variantId = "00000000-0000-4000-8000-000000000006";
  const calls = [];
  const supabase = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === "list_catalog_shops") return { data: [{ shop_id: shopId }], error: null };
    if (name === "adjust_variant_stock") return { data: 12, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const result = await action({ request: post({
    intent: "adjust-stock", adjustment_id: adjustmentId, variant_id: variantId, delta: "2", reason: "Count correction",
  }), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { stockSuccess: true, quantity: 12, variantId, adjustmentId });
  assert.deepEqual(calls[1], ["adjust_variant_stock", {
    p_adjustment_id: adjustmentId, p_shop_id: shopId, p_variant_id: variantId, p_delta: 2, p_reason: "Count correction",
  }]);
  assert.deepEqual(await action({ request: post({
    intent: "adjust-stock", adjustment_id: adjustmentId, variant_id: variantId, delta: "0", reason: "invalid",
  }), params: { locale: "en" }, context: contextFor(supabase) }), { error: "invalid" });
});

test("seller product edit keeps variant identity and sends integer-fils updates to the scoped RPC", async () => {
  const variantId = "00000000-0000-4000-8000-000000000007";
  const calls = [];
  const supabase = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === "list_catalog_shops") return { data: [{ shop_id: shopId }], error: null };
    if (name === "update_seller_product") return { data: productId, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  } };
  const result = await action({ request: post({
    intent: "update-product", product_id: productId,
    variants_json: JSON.stringify([{ variant_id: variantId, sku: "SKU-EDIT", price: "15.250", supply_mode: "after_order", stock_quantity: null, option_values: [] }]),
  }), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { updated: productId });
  assert.equal(calls[1][0], "update_seller_product");
  assert.equal(calls[1][1].p_product_id, productId);
  assert.deepEqual(calls[1][1].p_variants[0], {
    variant_id: variantId, sku: "SKU-EDIT", price_fils: "15250", supply_mode: "after_order", stock_quantity: null, option_values: [],
  });
});
