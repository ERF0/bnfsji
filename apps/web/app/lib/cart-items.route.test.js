import test from "node:test";
import assert from "node:assert/strict";
import { loader } from "../routes/cart-items.js";

test("cart item refresh requires exactly one bounded product or variant ID list", async () => {
  const context = { get: () => null };
  for (const search of ["", "?ids=", "?ids=not-a-uuid", "?ids=a0000000-0000-4000-8000-000000000001&variants=c0000000-0000-4000-8000-000000000001"]) {
    const response = await loader({ request: new Request(`https://shop.example/en/cart/items${search}`), context });
    assert.equal(response.status, 400, search);
    assert.equal((await response.json()).state, "invalid", search);
  }
});

test("cart variant refresh requires a bounded positive quantity for each variant", async () => {
  const context = { get: () => null };
  const id = "c0000000-0000-4000-8000-000000000001";
  for (const search of [`?variants=${id}`, `?variants=${id}&quantities=0`, `?variants=${id}&quantities=1,2`, `?variants=${id}&quantities=9007199254740992`]) {
    const response = await loader({ request: new Request(`https://shop.example/en/cart/items${search}`), context });
    assert.equal(response.status, 400, search);
  }
});

test("cart response exposes only buyer totals from the private Rust quote", async () => {
  const originalFetch = globalThis.fetch;
  const variantId = "c0000000-0000-4000-8000-000000000001";
  const shopId = "b0000000-0000-4000-8000-000000000001";
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/product_images")) return Response.json([]);
    if (url.pathname.endsWith("/rpc/get_buyer_delivery_fee")) return Response.json([{ delivery_mode: "seller", fee_fils: 600 }]);
    return Response.json([{
      id: variantId, product_id: "a0000000-0000-4000-8000-000000000001", price_fils: 1250,
      option_values: [], supply_mode: "after_order",
      products: { id: "a0000000-0000-4000-8000-000000000001", shop_id: shopId, slug: "shirt", title_ar: "قميص", title_en: "Shirt", shops: { slug: "seller-shop", name_ar: "متجر", name_en: "Shop" } },
    }]);
  };
  try {
    const context = { get: () => ({ env: {
      SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      QUOTE_SERVICE: { async fetch() { return Response.json({
        currency: "JOD", item_subtotal_fils: 2500, commission_fils: 175, delivery_charge_fils: 600, buyer_total_fils: 3100,
        sellers: [{ seller_id: shopId, discounted_item_subtotal_fils: 2500, commission_fils: 175, delivery_allocation_fils: 600, item_proceeds_fils: 2325 }],
      }); } },
    } }) };
    const response = await loader({ request: new Request(`https://shop.example/en/cart/items?variants=${variantId}&quantities=2`), context });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual(body.quote, { currency: "JOD", item_subtotal_fils: 2500, delivery_charge_fils: 600, buyer_total_fils: 3100 });
    assert.equal(Object.hasOwn(body.quote, "sellers"), false);
    assert.equal(body.delivery_mode, "seller");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
