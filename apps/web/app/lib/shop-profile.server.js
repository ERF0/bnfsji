import { normalizeLocale } from "./catalog.js";
import { sameOriginPost } from "./auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { cloudflareContext } from "./cloudflare-context.server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function profileFields(form) {
  const fields = {};
  for (const [key, max] of [["name_ar", 120], ["name_en", 120], ["description_ar", 1000], ["description_en", 1000]]) {
    const value = form.get(key);
    if (typeof value !== "string" || value.length > max + 20) return null;
    fields[key] = value.trim();
    if (fields[key].length > max) return null;
  }
  return fields.name_ar.length >= 2 && fields.name_en.length >= 2 ? fields : null;
}

export async function loader({ params, context }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out", shop: null };
  if (!supabase) return { locale, state: "unconfigured", shop: null };
  const { data, error } = await supabase.rpc("get_my_shop_profile");
  if (error) return { locale, state: "unavailable", shop: null };
  const shop = data?.[0] ?? null;
  if (!shop) return { locale, state: "no-shop", shop: null };
  return { locale, state: shop.status === "active" ? "ready" : "inactive", shop };
}

export async function action({ request, params, context }) {
  if (!normalizeLocale(params.locale)) return { error: "invalid" };
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  if (Number(request.headers.get("Content-Length")) > 5000) return { error: "invalid" };
  let form;
  try { form = await request.formData(); } catch { return { error: "invalid" }; }
  const shopId = form.get("shop_id");
  const fields = profileFields(form);
  if (form.get("intent") !== "save" || typeof shopId !== "string" || !UUID.test(shopId) || !fields) return { error: "invalid" };
  const { data: owned, error: ownedError } = await supabase.rpc("get_my_shop_profile");
  if (ownedError || owned?.[0]?.shop_id !== shopId || owned[0].status !== "active") return { error: "failed" };
  const { data, error } = await supabase.rpc("update_my_shop_profile", {
    p_shop_id: shopId, p_name_ar: fields.name_ar, p_name_en: fields.name_en,
    p_description_ar: fields.description_ar, p_description_en: fields.description_en,
  });
  return error || data !== shopId ? { error: "failed" } : { saved: true };
}
