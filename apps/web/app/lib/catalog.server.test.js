import test from "node:test";
import assert from "node:assert/strict";
import { formatJod, normalizeLocale, parseJodPriceFilter, productHref, shopHref } from "./catalog.js";
import { loadCartVariants, loadCatalog, loadProduct, loadProductsByIds, loadShop } from "./catalog.server.js";

test("locale parsing accepts only supported storefront locales", () => {
  assert.equal(normalizeLocale("ar"), "ar");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), null);
});

test("catalog prices are formatted from integer fils", () => {
  assert.match(formatJod(1234, "en"), /1\.234/);
  assert.throws(() => formatJod(1.25, "en"), /integer fils/);
  assert.throws(() => formatJod(-1, "ar"), /integer fils/);
});

test("JOD price filters parse exact fils and reject ambiguous or unsafe values", () => {
  assert.equal(parseJodPriceFilter(null), null);
  assert.equal(parseJodPriceFilter(""), null);
  assert.equal(parseJodPriceFilter("1.25"), 1250);
  assert.equal(parseJodPriceFilter("0.001"), 1);
  assert.throws(() => parseJodPriceFilter("-1"), /non-negative JOD/);
  assert.throws(() => parseJodPriceFilter("1.0001"), /up to three decimals/);
  assert.throws(() => parseJodPriceFilter("9007199254741"), /supported range/);
});

test("product links include the owning shop so seller slugs may repeat", () => {
  assert.equal(productHref("ar", "shop-one", "linen-shirt"), "/ar/p/shop-one/linen-shirt");
  assert.equal(productHref("en", "shop-two", "linen-shirt"), "/en/p/shop-two/linen-shirt");
  assert.equal(productHref("fr", "shop-one", "linen-shirt"), null);
  assert.equal(shopHref("ar", "shop-one"), "/ar/s/shop-one");
  assert.equal(shopHref("en", "shop-two"), "/en/s/shop-two");
});

test("product lookup scopes a seller-local product slug to its shop", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/product_images")) return new Response("[]", { headers: { "content-type": "application/json" } });
    requestUrl = url;
    return new Response(JSON.stringify({
      slug: "linen-shirt",
      title_ar: "قميص كتان",
      title_en: "Linen shirt",
      description_ar: "",
      description_en: "",
      currency: "JOD",
      product_variants: [{ id: "c0000000-0000-4000-8000-000000000001", price_fils: 12000, option_values: [], supply_mode: "after_order", sort_order: 0 }],
      shops: { slug: "shop-two", name_ar: "المتجر الثاني", name_en: "Shop Two" },
      categories: { slug: "clothing", name_ar: "ملابس", name_en: "Clothing" },
    }), { headers: { "content-type": "application/json" } });
  };
  try {
    const result = await loadProduct({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    }, "shop-two", "linen-shirt");
    assert.equal(result.state, "ready");
    assert.equal(result.product.shops.slug, "shop-two");
    assert.equal(requestUrl.searchParams.get("slug"), "eq.linen-shirt");
    assert.equal(requestUrl.searchParams.get("shops.slug"), "eq.shop-two");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("shop lookup exposes only active shops and pages their published products", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    requests.push({ url, init });
    if (url.pathname.endsWith("/shops")) {
      return new Response(JSON.stringify({ id: "shop-id", slug: "shop-two", name_ar: "المتجر الثاني", name_en: "Shop Two" }), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname.endsWith("/product_images")) return new Response("[]", { headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify([{ id: "product-id", slug: "linen-shirt", title_ar: "قميص كتان", title_en: "Linen shirt", price_fils: 12000, currency: "JOD" }]), {
      headers: { "content-type": "application/json", "content-range": "0-23/1" },
    });
  };
  try {
    const result = await loadShop({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    }, "shop-two", 2);

    assert.equal(result.state, "ready");
    assert.equal(result.shop.slug, "shop-two");
    assert.match(requests[0].url.searchParams.get("select"), /description_ar,description_en/);
    assert.equal(result.total, 1);
    assert.equal(result.page, 2);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].url.searchParams.get("status"), "eq.active");
    assert.equal(requests[1].url.searchParams.get("shop_id"), "eq.shop-id");
    assert.equal(requests[1].url.searchParams.get("status"), "eq.published");
    assert.equal(requests[1].url.searchParams.get("offset"), "24");
    assert.equal(requests[1].url.searchParams.get("limit"), "24");
    assert.match(requests[1].url.searchParams.get("select"), /product_variants!inner\(price_fils\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog search bounds query input, preserves filters, and aborts all Supabase reads", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: new URL(input), init });
    return new Response(JSON.stringify(new URL(input).pathname.endsWith("/rpc/catalog_filter_options") ? { shops: [], attributes: [] } : []), { headers: { "content-type": "application/json" } });
  };
  try {
    const result = await loadCatalog({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    }, { query: `  ${"a".repeat(120)}  `, category: "clothing", sort: "price_low", page: 2, minPriceFils: 1000, maxPriceFils: 9000, shop: "shop-a", fulfillment: "stocked", optionFilters: [{ label_ar: "Size", label_en: "Size", value_ar: "Large", value_en: "Large" }], signal: controller.signal });

    assert.equal(result.state, "ready");
    assert.equal(requests.length, 3);
    assert.ok(requests.every(({ init }) => init.signal === controller.signal));
    const rpc = requests.find(({ url }) => url.pathname.endsWith("/rpc/search_public_catalog"));
    assert.ok(rpc);
    const body = JSON.parse(rpc.init.body);
    assert.equal(body.p_query, "a".repeat(100));
    assert.equal(body.p_category_slug, "clothing");
    assert.equal(body.p_sort, "price_low");
    assert.equal(body.p_limit, 24);
    assert.equal(body.p_offset, 24);
    assert.equal(body.p_min_price_fils, 1000);
    assert.equal(body.p_max_price_fils, 9000);
    assert.equal(body.p_shop_slug, "shop-a");
    assert.equal(body.p_fulfillment, "stocked");
    assert.equal(body.p_options[0].value_en, "Large");
    const facets = requests.find(({ url }) => url.pathname.endsWith("/rpc/catalog_filter_options"));
    assert.ok(facets);
    assert.equal(JSON.parse(facets.init.body).p_category_slug, "clothing");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cart lookup refreshes an exact active variant and its current product", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/product_images")) return new Response("[]", { headers: { "content-type": "application/json" } });
    if (url.pathname.endsWith("/product_variants")) requestUrl = url;
    return new Response(JSON.stringify([{
      id: "c0000000-0000-4000-8000-000000000001",
      product_id: "a0000000-0000-4000-8000-000000000001",
      price_fils: 1250,
      option_values: [],
      supply_mode: "stocked",
      products: { id: "a0000000-0000-4000-8000-000000000001", slug: "shirt", title_ar: "Shirt", title_en: "Shirt", shops: { slug: "shop-a", name_ar: "Shop A", name_en: "Shop A" } },
    }]), { headers: { "content-type": "application/json" } });
  };
  try {
    const result = await loadCartVariants({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    }, ["c0000000-0000-4000-8000-000000000001"]);
    assert.equal(result.state, "ready");
    assert.equal(result.variants[0].price_fils, 1250);
    assert.equal(result.variants[0].variant_id, "c0000000-0000-4000-8000-000000000001");
    assert.equal(requestUrl.pathname.endsWith("/product_variants"), true);
    assert.equal(requestUrl.searchParams.get("id"), "in.(c0000000-0000-4000-8000-000000000001)");
    assert.match(requestUrl.searchParams.get("select"), /products!inner/);
    assert.equal(result.variants[0].variant_id, "c0000000-0000-4000-8000-000000000001");
    assert.equal(requestUrl.pathname.endsWith("/product_variants"), true);
    assert.equal(requestUrl.searchParams.get("id"), "in.(c0000000-0000-4000-8000-000000000001)");
    assert.match(requestUrl.searchParams.get("select"), /products!inner/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cart lookup rejects malformed or oversized variant ID lists before querying", async () => {
  const result = await loadCartVariants({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-public-key",
  }, ["not-a-uuid"]);
  assert.deepEqual(result, { state: "invalid", variants: [], quote: null });
});

test("cart quote groups refreshed lines by seller and applies the platform Amman fee to a multi-seller order", async () => {
  const originalFetch = globalThis.fetch;
  let quoteRequest;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/product_images")) return new Response("[]", { headers: { "content-type": "application/json" } });
    if (url.pathname.endsWith("/rpc/get_buyer_delivery_fee")) return new Response(JSON.stringify([{ delivery_mode: "platform", fee_fils: 3000 }]), { headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify([{
      id: "c0000000-0000-4000-8000-000000000001", product_id: "a0000000-0000-4000-8000-000000000001",
      price_fils: 1250, option_values: [], supply_mode: "after_order",
      products: { id: "a0000000-0000-4000-8000-000000000001", shop_id: "b0000000-0000-4000-8000-000000000001", slug: "shirt", title_ar: "قميص", title_en: "Shirt", shops: { slug: "shop-a", name_ar: "متجر", name_en: "Shop A" } },
    }, {
      id: "c0000000-0000-4000-8000-000000000002", product_id: "a0000000-0000-4000-8000-000000000002",
      price_fils: 2000, option_values: [], supply_mode: "after_order",
      products: { id: "a0000000-0000-4000-8000-000000000002", shop_id: "b0000000-0000-4000-8000-000000000002", slug: "bag", title_ar: "حقيبة", title_en: "Bag", shops: { slug: "shop-b", name_ar: "متجر ب", name_en: "Shop B" } },
    }]), { headers: { "content-type": "application/json" } });
  };
  const quoteResponse = {
    currency: "JOD", item_subtotal_fils: 7750, commission_fils: 543, delivery_charge_fils: 3000, buyer_total_fils: 10750,
    sellers: [
      { seller_id: "b0000000-0000-4000-8000-000000000001", discounted_item_subtotal_fils: 3750, commission_fils: 263, delivery_allocation_fils: 1451, item_proceeds_fils: 3487 },
      { seller_id: "b0000000-0000-4000-8000-000000000002", discounted_item_subtotal_fils: 4000, commission_fils: 280, delivery_allocation_fils: 1549, item_proceeds_fils: 3720 },
    ],
  };
  const env = {
    SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    QUOTE_SERVICE: { async fetch(request) { quoteRequest = await request.json(); return Response.json(quoteResponse); } },
  };
  try {
    const result = await loadCartVariants(env, ["c0000000-0000-4000-8000-000000000001", "c0000000-0000-4000-8000-000000000002"], [3, 2]);
    assert.equal(result.state, "ready");
    assert.equal(result.quote_state, "ready");
    assert.equal(result.quote.buyer_total_fils, 10750);
    assert.equal(result.delivery_mode, "platform");
    assert.deepEqual(quoteRequest, {
      version: 1, currency: "JOD", delivery_charge_fils: 3000,
      sellers: [
        { seller_id: "b0000000-0000-4000-8000-000000000001", discounted_item_subtotal_fils: 3750, plan: "standard" },
        { seller_id: "b0000000-0000-4000-8000-000000000002", discounted_item_subtotal_fils: 4000, plan: "standard" },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("wishlist product refresh uses the lowest active variant price", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/product_images")) return new Response("[]", { headers: { "content-type": "application/json" } });
    requestUrl = url;
    return new Response(JSON.stringify([{
      id: "a0000000-0000-4000-8000-000000000001",
      slug: "shirt",
      title_en: "Shirt",
      product_variants: [{ price_fils: 5000 }, { price_fils: 4200 }],
      shops: { slug: "shop-a", name_en: "Shop A" },
    }]), { headers: { "content-type": "application/json" } });
  };
  try {
    const result = await loadProductsByIds({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    }, ["a0000000-0000-4000-8000-000000000001"]);
    assert.equal(result.products[0].price_fils, 4200);
    assert.equal(requestUrl.pathname.endsWith("/products"), true);
    assert.match(requestUrl.searchParams.get("select"), /product_variants\(price_fils\)/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
