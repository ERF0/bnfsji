import { normalizeLocale } from "./catalog.js";
import { sameOriginPost } from "./auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { cloudflareContext } from "./cloudflare-context.server.js";
import { readSellerProductForm, validateSellerProduct } from "./seller-catalog.server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loader({ request, params, context }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out", shops: [], shop: null, categories: [], products: [] };
  if (!supabase) return { locale, state: "unconfigured", shops: [], shop: null, categories: [], products: [] };
  const [{ data: shops, error: shopsError }, { data: owned, error: ownedError }] = await Promise.all([
    supabase.rpc("list_catalog_shops"),
    supabase.rpc("get_owned_shop"),
  ]);
  if (shopsError || ownedError) return { locale, state: "unavailable", shops: [], shop: null, categories: [], products: [] };
  if (!shops?.length) return { locale, state: "no-shop", shops: [], shop: null, categories: [], products: [] };
  const url = new URL(request.url);
  const requestedShopId = url.searchParams.get("shop_id");
  const shop = shops.find((candidate) => candidate.shop_id === requestedShopId) ?? (requestedShopId ? null : shops[0]);
  if (!shop) return { locale, state: "unavailable", shops, shop: null, categories: [], products: [] };
  const [{ data: categories, error: categoriesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("categories").select("id,name_ar,name_en").eq("status", "active").order("sort_order"),
    supabase.rpc("list_shop_catalog", { p_shop_id: shop.shop_id }),
  ]);
  const { data: stockAdjustments, error: stockError } = await supabase.rpc("list_shop_stock_adjustments", { p_shop_id: shop.shop_id });
  return {
    locale, state: categoriesError || productsError || stockError ? "unavailable" : "ready", shops, shop,
    ownerAccess: owned?.some((item) => item.shop_id === shop.shop_id) ?? false,
    categories: categories ?? [], products: (products ?? []).map((product) => ({
      ...product, variants: (product.variants ?? []).map((variant) => ({ ...variant, adjustment_id: crypto.randomUUID() })),
    })), stockAdjustments: stockAdjustments ?? [],
  };
}

export async function action({ request, params, context }) {
  if (!normalizeLocale(params.locale)) return { error: "failed" };
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  let form;
  try { form = await readSellerProductForm(request); } catch { return { error: "invalid" }; }
  if (!form) return { error: "invalid" };
  const shopId = form.get("shop_id");
  if (form.get("intent") === "adjust-stock") {
    const variantId = form.get("variant_id");
    const adjustmentId = form.get("adjustment_id");
    const deltaText = form.get("delta");
    const reason = form.get("reason");
    if (![shopId, variantId, adjustmentId].every((value) => typeof value === "string" && UUID.test(value))
        || typeof deltaText !== "string" || !/^-?[1-9][0-9]{0,9}$/.test(deltaText)
        || !Number.isSafeInteger(Number(deltaText)) || Number(deltaText) < -2147483647 || Number(deltaText) > 2147483647
        || typeof reason !== "string" || reason.trim().length < 1 || reason.trim().length > 300) return { error: "invalid" };
    const { data: shops, error: shopsError } = await supabase.rpc("list_catalog_shops");
    if (shopsError || !shops?.some((shop) => shop.shop_id === shopId)) return { error: "failed" };
    const { data: quantity, error } = await supabase.rpc("adjust_variant_stock", {
      p_adjustment_id: adjustmentId, p_shop_id: shopId, p_variant_id: variantId,
      p_delta: Number(deltaText), p_reason: reason.trim(),
    });
    if (error || quantity === null || quantity === undefined) return { error: "stock-failed" };
    return { stockSuccess: true, quantity, variantId, adjustmentId };
  }
  if (form.get("intent") === "update-product") {
    const productId = form.get("product_id");
    if (typeof shopId !== "string" || !UUID.test(shopId) || typeof productId !== "string" || !UUID.test(productId)) return { error: "invalid" };
    const product = validateSellerProduct(Object.fromEntries([
      "category_id", "title_ar", "title_en", "description_ar", "description_en", "variants_json",
    ].map((name) => [name, form.get(name)])));
    if (!product || product.variants.some((variant) => !variant.variant_id || !variant.sku)) return { error: "invalid" };
    const { data: shops, error: shopsError } = await supabase.rpc("list_catalog_shops");
    if (shopsError || !shops?.some((shop) => shop.shop_id === shopId)) return { error: "failed" };
    const { data: updatedId, error } = await supabase.rpc("update_seller_product", {
      p_shop_id: shopId, p_product_id: productId, p_category_id: product.category_id,
      p_title_ar: product.title_ar, p_title_en: product.title_en,
      p_description_ar: product.description_ar, p_description_en: product.description_en,
      p_variants: product.variants,
    });
    if (error || !updatedId) return { error: "failed" };
    return { updated: updatedId };
  }
  if (form.get("intent") !== "create-product") return { error: "invalid" };
  const product = validateSellerProduct(Object.fromEntries([
    "category_id", "title_ar", "title_en", "description_ar", "description_en", "variants_json",
  ].map((name) => [name, form.get(name)])));
  if (!product || typeof shopId !== "string" || !UUID.test(shopId)) return { error: "invalid" };
  const { data: shops, error: shopsError } = await supabase.rpc("list_catalog_shops");
  if (shopsError || !shops?.some((shop) => shop.shop_id === shopId)) return { error: "failed" };
  const { data: productId, error } = await supabase.rpc("create_seller_product", {
    p_shop_id: shopId,
    p_category_id: product.category_id,
    p_title_ar: product.title_ar,
    p_title_en: product.title_en,
    p_description_ar: product.description_ar,
    p_description_en: product.description_en,
    p_variants: product.variants,
  });
  if (error || !productId) return { error: "failed" };
  return { success: productId };
}
