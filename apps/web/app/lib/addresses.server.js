import { normalizeLocale } from "./catalog.js";
import { sameOriginPost } from "./auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { cloudflareContext } from "./cloudflare-context.server.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function addressFields(form) {
  const limits = { recipient: 100, phone: 20, area: 100, street: 160, building: 100 };
  const fields = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = form.get(key);
    if (typeof value !== "string" || value.length > limit + 20) return null;
    fields[key] = value.trim();
  }
  if (fields.recipient.length < 2 || fields.area.length < 2 || fields.street.length < 2 ||
      !/^\+?[0-9 ]{8,20}$/.test(fields.phone) ||
      Object.entries(limits).some(([key, limit]) => fields[key].length > limit)) return null;
  return { ...fields, city: "Amman" };
}

export async function loader({ params, context }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!supabase) return { locale, state: "unconfigured", addresses: [] };
  if (!claims?.sub) return { locale, state: "signed-out", addresses: [] };
  const { data, error } = await supabase.from("buyer_addresses")
    .select("id,recipient,phone,city,area,street,building")
    .eq("user_id", claims.sub).order("created_at", { ascending: false }).limit(20);
  return { locale, state: error ? "unavailable" : "ready", addresses: error ? [] : data ?? [] };
}

export async function action({ request, params, context }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!supabase || !claims?.sub) return { error: "signed-out" };
  if (!sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  const form = await request.formData();
  const intent = form.get("intent");
  const id = form.get("id");
  if (intent === "remove") {
    if (typeof id !== "string" || !uuid.test(id)) return { error: "invalid" };
    const { data, error } = await supabase.from("buyer_addresses").delete()
      .eq("id", id).eq("user_id", claims.sub).select("id").maybeSingle();
    return error || !data ? { error: "failed" } : { saved: "removed" };
  }
  if (intent !== "add" && intent !== "edit") return { error: "invalid" };
  const fields = addressFields(form);
  if (!fields || (intent === "edit" && (typeof id !== "string" || !uuid.test(id)))) return { error: "invalid" };
  if (intent === "add") {
    const { count, error: countError } = await supabase.from("buyer_addresses")
      .select("id", { count: "exact", head: true }).eq("user_id", claims.sub);
    if (countError) return { error: "failed" };
    if (count >= 10) return { error: "limit" };
    const { error } = await supabase.from("buyer_addresses").insert({ ...fields, user_id: claims.sub });
    return error ? { error: "failed" } : { saved: "added" };
  }
  const { data, error } = await supabase.from("buyer_addresses").update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", claims.sub).select("id").maybeSingle();
  return error || !data ? { error: "failed" } : { saved: "updated" };
}
