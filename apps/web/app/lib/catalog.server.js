import { createClient } from "@supabase/supabase-js";
import { signProductImages } from "./product-images.server.js";
import { calculateTrustedQuote } from "./quote.server.js";

function publicClient(env) {
  if (!env?.SUPABASE_URL || !env?.SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function queryFailure(error) {
  return { code: "CATALOG_UNAVAILABLE", cause: error?.code ?? "query_failed" };
}

async function attachProductImages(supabase, products, idField, width, signal) {
  if (!products.length) return products;
  const productIds = products.map((product) => product[idField]);
  let query = supabase.from("product_images")
    .select("id,product_id,storage_path,sort_order,status")
    .in("product_id", productIds).eq("status", "active").order("sort_order").order("id");
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error || !data?.length) return products.map((product) => ({ ...product, images: [] }));
  const signed = await signProductImages(supabase, data, width);
  if (!signed.ok) return products.map((product) => ({ ...product, images: [] }));
  return products.map((product) => ({ ...product, images: signed.byProduct.get(product[idField]) ?? [] }));
}

export async function loadCatalog(env, { query = "", category = null, sort = "newest", page = 1, minPriceFils = null, maxPriceFils = null, shop = "", fulfillment = "", optionFilters = [], signal } = {}) {
  const supabase = publicClient(env);
  if (!supabase) return { state: "unconfigured", categories: [], products: [], facets: { shops: [], attributes: [] }, total: 0, page: 1 };

  const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, 1000)) : 1;
  let categoriesQuery = supabase.from("categories").select("slug, name_ar, name_en")
    .eq("status", "active").order("sort_order").order("slug");
  let productsQuery = supabase.rpc("search_public_catalog", {
    p_query: query.trim().slice(0, 100),
    p_category_slug: category,
    p_sort: ["newest", "price_low", "price_high"].includes(sort) ? sort : "newest",
    p_min_price_fils: minPriceFils,
    p_max_price_fils: maxPriceFils,
    p_shop_slug: shop || null,
    p_fulfillment: fulfillment || null,
    p_options: optionFilters,
    p_limit: 24,
    p_offset: (safePage - 1) * 24,
  });
  let facetsQuery = supabase.rpc("catalog_filter_options", {
    p_query: query.trim().slice(0, 100),
    p_category_slug: category,
  });
  if (signal) {
    categoriesQuery = categoriesQuery.abortSignal(signal);
    productsQuery = productsQuery.abortSignal(signal);
    facetsQuery = facetsQuery.abortSignal(signal);
  }
  const [categoryResult, productResult, facetResult] = await Promise.all([categoriesQuery, productsQuery, facetsQuery]);

  if (categoryResult.error || productResult.error || facetResult.error) {
    return { state: "unavailable", error: queryFailure(categoryResult.error ?? productResult.error ?? facetResult.error), categories: [], products: [], facets: { shops: [], attributes: [] }, total: 0, page: safePage };
  }
  const products = await attachProductImages(supabase, productResult.data ?? [], "product_id", 400, signal);
  return {
    state: "ready",
    categories: categoryResult.data ?? [],
    facets: facetResult.data ?? { shops: [], attributes: [] },
    products,
    total: Number(productResult.data?.[0]?.total_count ?? 0),
    page: safePage,
  };
}

export async function loadProduct(env, shopSlug, slug) {
  const supabase = publicClient(env);
  if (!supabase) return { state: "unconfigured", product: null };
  let { data, error } = await supabase.from("products")
    .select("id, slug, title_ar, title_en, description_ar, description_en, currency, product_variants(id, price_fils, option_values, supply_mode, sort_order), shops!inner(slug, name_ar, name_en), categories!inner(slug, name_ar, name_en)")
    .eq("slug", slug).eq("status", "published")
    .eq("shops.slug", shopSlug).eq("shops.status", "active").eq("categories.status", "active").maybeSingle();
  if (error) return { state: "unavailable", product: null, error: queryFailure(error) };
  if (data) {
    data.product_variants = (data.product_variants ?? []).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
    [data] = await attachProductImages(supabase, [data], "id", 1600);
  }
  return { state: data ? "ready" : "missing", product: data };
}

export async function loadShop(env, slug, page = 1) {
  const supabase = publicClient(env);
  if (!supabase) return { state: "unconfigured", shop: null, products: [], total: 0, page: 1 };

  const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, 1000)) : 1;
  const { data: shop, error: shopError } = await supabase.from("shops")
    .select("id, slug, name_ar, name_en, description_ar, description_en").eq("slug", slug).eq("status", "active").maybeSingle();
  if (shopError) return { state: "unavailable", shop: null, products: [], total: 0, page: safePage, error: queryFailure(shopError) };
  if (!shop) return { state: "missing", shop: null, products: [], total: 0, page: safePage };

  const { data, error, count } = await supabase.from("products")
    .select("id, slug, title_ar, title_en, currency, product_variants!inner(price_fils)", { count: "exact" })
    .eq("shop_id", shop.id).eq("status", "published")
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((safePage - 1) * 24, safePage * 24 - 1);
  if (error) return { state: "unavailable", shop: null, products: [], total: 0, page: safePage, error: queryFailure(error) };
  const products = (data ?? []).map((product) => ({
    ...product,
    price_fils: product.product_variants?.length ? product.product_variants.reduce((lowest, variant) => Math.min(lowest, variant.price_fils), Number.MAX_SAFE_INTEGER) : null,
  }));
  return { state: "ready", shop, products: await attachProductImages(supabase, products, "id", 400), total: count ?? 0, page: safePage };
}

export async function loadCartVariants(env, variantIds, quantities = variantIds.map(() => 1)) {
  const ids = [...new Set(variantIds)];
  if (ids.length > 100 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return { state: "invalid", variants: [], quote: null };
  }
  if (!Array.isArray(quantities) || quantities.length !== variantIds.length ||
      quantities.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 1) ||
      new Set(variantIds).size !== variantIds.length) {
    return { state: "invalid", variants: [], quote: null };
  }
  if (ids.length === 0) return { state: "ready", variants: [], quote: null };
  const supabase = publicClient(env);
  if (!supabase) return { state: "unconfigured", variants: [], quote: null };
  const { data, error } = await supabase.from("product_variants")
    .select("id, product_id, price_fils, option_values, supply_mode, products!inner(id, shop_id, slug, title_ar, title_en, shops!inner(slug, name_ar, name_en))")
    .in("id", ids);
  if (error) return { state: "unavailable", variants: [], quote: null, error: queryFailure(error) };
  const variants = (data ?? []).map((variant) => ({
    ...variant.products,
    variant_id: variant.id,
    price_fils: variant.price_fils,
    option_values: variant.option_values,
    supply_mode: variant.supply_mode,
  }));
  let quote = null;
  let quote_state = "unavailable";
  let delivery_mode = null;
  if (variants.length === ids.length) {
    const shopIds = [...new Set(variants.map((variant) => variant.shop_id))];
    const { data: fees, error: feeError } = await supabase.rpc("get_buyer_delivery_fee", { p_shop_ids: shopIds });
    if (!feeError && fees?.length === 1 && ["seller", "platform"].includes(fees[0].delivery_mode) && Number.isSafeInteger(fees[0].fee_fils) && fees[0].fee_fils >= 0) {
      const byId = new Map(variants.map((variant) => [variant.variant_id, variant]));
      const sellerTotals = new Map();
      for (let index = 0; index < variantIds.length; index += 1) {
        const variant = byId.get(variantIds[index]);
        const sellerTotal = (sellerTotals.get(variant.shop_id) ?? 0n) + BigInt(variant.price_fils) * BigInt(quantities[index]);
        sellerTotals.set(variant.shop_id, sellerTotal);
      }
      if ([...sellerTotals.values()].every((value) => value <= BigInt(Number.MAX_SAFE_INTEGER))) {
        try {
          quote = await calculateTrustedQuote(env, {
            version: 1,
            currency: "JOD",
            delivery_charge_fils: fees[0].fee_fils,
            sellers: [...sellerTotals.entries()].map(([seller_id, subtotal]) => ({
              seller_id,
              discounted_item_subtotal_fils: Number(subtotal),
              plan: "standard",
            })),
          });
          quote_state = "ready";
          delivery_mode = fees[0].delivery_mode;
        } catch {
          quote = null;
        }
      }
    }
  }
  const withImages = await attachProductImages(supabase, variants, "id", 320);
  return { state: "ready", variants: withImages, quote, quote_state, delivery_mode };
}

export async function loadProductsByIds(env, productIds) {
  const ids = [...new Set(productIds)];
  if (ids.length > 100 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return { state: "invalid", products: [] };
  }
  if (ids.length === 0) return { state: "ready", products: [] };
  const supabase = publicClient(env);
  if (!supabase) return { state: "unconfigured", products: [] };
  const { data, error } = await supabase.from("products")
    .select("id, slug, title_ar, title_en, product_variants(price_fils), shops!inner(slug, name_ar, name_en)")
    .in("id", ids);
  if (error) return { state: "unavailable", products: [], error: queryFailure(error) };
  const products = (data ?? []).map((product) => ({
    ...product,
    price_fils: (product.product_variants ?? []).reduce((lowest, variant) => Math.min(lowest, variant.price_fils), Number.MAX_SAFE_INTEGER),
  })).filter((product) => product.price_fils !== Number.MAX_SAFE_INTEGER);
  return { state: "ready", products: await attachProductImages(supabase, products, "id", 320) };
}
