import { normalizeLocale } from "./catalog.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";

export async function loader({ params, context, request }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  if (import.meta.env?.MODE === "development" && new URL(request.url).searchParams.get("showcase") === "1") {
    const demo = await import("./showcase-data.js");
    return { locale, userId: null, state: "showcase", metrics: demo.showcaseMetrics, sales: demo.showcaseSales, recentOrders: demo.showcaseRecentOrders, products: demo.showcaseProducts.slice(0, 3) };
  }
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, userId: null, state: "signed-out" };
  if (!supabase) return { locale, userId: claims.sub, state: "unconfigured" };

  const [{ data: shops, error: shopsError }, { data: owned, error: ownedError }] = await Promise.all([
    supabase.rpc("list_catalog_shops"),
    supabase.rpc("get_owned_shop"),
  ]);
  if (shopsError || ownedError) return { locale, userId: claims.sub, state: "unavailable" };

  const shop = shops?.[0] ?? null;
  if (shop) {
    const [{ data: products, error: productsError }, { data: delivery, error: deliveryError }] = await Promise.all([
      supabase.rpc("list_shop_catalog", { p_shop_id: shop.shop_id }),
      owned?.length ? supabase.rpc("get_my_delivery_settings") : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsError || deliveryError) return { locale, userId: claims.sub, state: "unavailable" };
    const setting = delivery?.find((row) => row.shop_id === shop.shop_id);
    return {
      locale, userId: claims.sub, state: "shop", shop, isOwner: owned?.some((item) => item.shop_id === shop.shop_id) ?? false,
      productCount: products?.length ?? 0, deliveryConfigured: setting?.seller_fee_fils != null,
    };
  }

  const { data: application, error: applicationError } = await supabase.from("seller_applications")
    .select("id,status,rejection_reason").eq("applicant_user_id", claims.sub).maybeSingle();
  if (applicationError) return { locale, userId: claims.sub, state: "unavailable" };
  return { locale, userId: claims.sub, state: "application", application: application ?? null };
}
