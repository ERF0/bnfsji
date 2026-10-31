import { sameOriginPost } from "./auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { cloudflareContext } from "./cloudflare-context.server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loader({ params, context }) {
  const locale = params.locale === "en" ? "en" : params.locale === "ar" ? "ar" : null;
  if (!locale) throw new Response("Not found", { status: 404 });
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out", proposals: [], isOwner: false };
  if (!supabase) return { locale, state: "unconfigured", proposals: [], isOwner: false };
  if (claims.aal !== "aal2") return { locale, state: "mfa", proposals: [], isOwner: false };
  const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_platform_owner"), supabase.rpc("is_platform_admin"),
  ]);
  if (isOwner !== true && isAdmin !== true) return { locale, state: "denied", proposals: [], isOwner: false };
  if (isOwner !== true) return { locale, state: "ready", proposals: [], isOwner: false };
  const { data, error } = await supabase.rpc("list_category_proposals");
  return { locale, state: error ? "unavailable" : "ready", proposals: data ?? [], isOwner: true };
}

export async function action({ request, params, context }) {
  if (params.locale !== "en" && params.locale !== "ar") return { error: "failed" };
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || claims.aal !== "aal2" || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "propose") {
    const slug = form.get("slug");
    const nameAr = form.get("name_ar");
    const nameEn = form.get("name_en");
    if (typeof slug !== "string" || slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
      || typeof nameAr !== "string" || nameAr.trim().length < 1 || nameAr.trim().length > 100
      || typeof nameEn !== "string" || nameEn.trim().length < 1 || nameEn.trim().length > 100) return { error: "failed" };
    const { error } = await supabase.rpc("propose_category", { p_slug: slug, p_name_ar: nameAr.trim(), p_name_en: nameEn.trim() });
    return error ? { error: "failed" } : { proposed: true };
  }
  const proposalId = form.get("proposal_id");
  const decision = intent === "approve-category" ? "approve" : intent === "reject-category" ? "reject" : null;
  if (!decision || typeof proposalId !== "string" || !UUID.test(proposalId)) return { error: "failed" };
  const { error } = await supabase.rpc("review_category_proposal", { p_proposal_id: proposalId, p_decision: decision });
  return error ? { error: "failed" } : { reviewed: true };
}
