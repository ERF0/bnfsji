import { normalizeLocale, parseJodPriceFilter } from "./catalog.js";
import { sameOriginPost } from "./auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { cloudflareContext } from "./cloudflare-context.server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function localeOf(params) { return normalizeLocale(params.locale) ?? "ar"; }
function inputValue(fils) {
  if (!Number.isSafeInteger(Number(fils)) || Number(fils) < 0) return "";
  const amount = Number(fils);
  const fraction = String(amount % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${Math.floor(amount / 1000)}${fraction ? `.${fraction}` : ""}`;
}

async function ownedShop(supabase) {
  const { data, error } = await supabase.rpc("get_owned_shop");
  return error ? { error: true } : { shop: data?.[0] ?? null };
}

export async function sellerDeliveryLoader({ params, context }) {
  const locale = localeOf(params);
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out" };
  if (!supabase) return { locale, state: "unconfigured" };
  const result = await ownedShop(supabase);
  if (result.error) return { locale, state: "unavailable" };
  if (!result.shop) return { locale, state: "no-shop" };
  const { data, error } = await supabase.rpc("get_my_delivery_settings");
  const setting = data?.find((entry) => entry.shop_id === result.shop.shop_id);
  if (error || !setting) return { locale, state: "unavailable" };
  const { data: history, error: historyError } = await supabase.rpc("list_delivery_fee_events", { p_scope: "seller", p_shop_id: result.shop.shop_id });
  if (historyError) return { locale, state: "unavailable" };
  return { locale, state: "ready", shop: result.shop, fee: setting.seller_fee_fils, input: inputValue(setting.seller_fee_fils), history: history ?? [] };
}

export async function sellerDeliveryAction({ request, params, context }) {
  if (!normalizeLocale(params.locale)) return { error: "failed" };
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  let form;
  try { form = await request.formData(); } catch { return { error: "invalid" }; }
  const shopId = form.get("shop_id");
  const rawFee = form.get("fee_jod");
  if (form.get("intent") !== "save-seller-fee" || typeof shopId !== "string" || !UUID.test(shopId) || typeof rawFee !== "string") return { error: "invalid" };
  let fee;
  try { fee = parseJodPriceFilter(rawFee); } catch { return { error: "invalid" }; }
  const owned = await ownedShop(supabase);
  if (owned.error || owned.shop?.shop_id !== shopId) return { error: "failed" };
  const { error } = await supabase.rpc("set_shop_delivery_fee", { p_shop_id: shopId, p_fee_fils: fee });
  return error ? { error: "failed" } : { saved: true };
}

export async function ownerDeliveryLoader({ params, context }) {
  const locale = localeOf(params);
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out" };
  if (!supabase) return { locale, state: "unconfigured" };
  const { data: isOwner, error: roleError } = await supabase.rpc("is_platform_owner");
  if (roleError) return { locale, state: "unavailable" };
  if (!isOwner) return { locale, state: "denied" };
  if (claims.aal !== "aal2") return { locale, state: "mfa" };
  const [{ data, error }, { data: history, error: historyError }] = await Promise.all([
    supabase.rpc("get_platform_delivery_settings"),
    supabase.rpc("list_delivery_fee_events", { p_scope: "platform", p_shop_id: null }),
  ]);
  if (error || historyError || !data?.[0]) return { locale, state: "unavailable" };
  return { locale, state: "ready", fee: data[0].fee_fils, input: inputValue(data[0].fee_fils), history: history ?? [] };
}

export async function ownerDeliveryAction({ request, params, context }) {
  if (!normalizeLocale(params.locale)) return { error: "failed" };
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  if (claims.aal !== "aal2") return { error: "mfa" };
  const { data: isOwner, error: roleError } = await supabase.rpc("is_platform_owner");
  if (roleError || !isOwner) return { error: "denied" };
  let form;
  try { form = await request.formData(); } catch { return { error: "invalid" }; }
  const rawFee = form.get("fee_jod");
  if (form.get("intent") !== "save-platform-fee" || typeof rawFee !== "string") return { error: "invalid" };
  let fee;
  try { fee = parseJodPriceFilter(rawFee); } catch { return { error: "invalid" }; }
  const { error } = await supabase.rpc("set_platform_delivery_fee", { p_fee_fils: fee });
  return error ? { error: "failed" } : { saved: true };
}
