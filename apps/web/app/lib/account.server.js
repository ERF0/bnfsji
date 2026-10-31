import { authConfigured, publicSiteUrl, sameOriginPost } from "./auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { cloudflareContext } from "./cloudflare-context.server.js";

export async function loader({ params, context }) {
  const locale = params.locale === "en" ? "en" : "ar";
  const env = context.get(cloudflareContext)?.env;
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  let sellerSetup = null;
  if (claims?.sub && supabase) {
    const { data, error } = await supabase.from("seller_applications").select("status")
      .eq("applicant_user_id", claims.sub).maybeSingle();
    sellerSetup = error ? { state: "unavailable" } : { state: "ready", status: data?.status ?? null };
  }
  return { locale, configured: authConfigured(env), oauthConfigured: Boolean(publicSiteUrl(env?.PUBLIC_SITE_URL)), email: claims?.email ?? null, sellerSetup };
}


export async function action({ request, params, context }) {
  const locale = params.locale === "en" ? "en" : "ar";
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!supabase || !authConfigured(env)) return { error: "unconfigured" };
  if (!sameOriginPost(request, env.PUBLIC_SITE_URL)) return { error: "failed" };

  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "sign-out") {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { error: "failed" };
    } catch {
      return { error: "failed" };
    }
    return new Response(null, { status: 303, headers: { Location: `/${locale}/account`, "Cache-Control": "private, no-store" } });
  }

  if (intent === "oauth") {
    const provider = form.get("provider");
    if (provider !== "google" && provider !== "apple") return { error: "invalid" };
    const origin = publicSiteUrl(env.PUBLIC_SITE_URL);
    if (!origin) return { error: "unconfigured" };
    const callback = new URL("/auth/callback", origin);
    callback.searchParams.set("locale", locale);
    let data;
    let error;
    try {
      ({ data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString(), skipBrowserRedirect: true } }));
    } catch {
      return { error: "failed" };
    }
    if (error || !data?.url) return { error: "failed" };
    return new Response(null, { status: 303, headers: { Location: data.url, "Cache-Control": "private, no-store" } });
  }

  if (intent === "request-reset") {
    const emailValue = form.get("email");
    if (typeof emailValue !== "string" || emailValue.length > 254) return { error: "invalid" };
    const email = emailValue.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalid" };
    const callback = new URL("/auth/callback", publicSiteUrl(env.PUBLIC_SITE_URL));
    callback.searchParams.set("locale", locale);
    callback.searchParams.set("flow", "recovery");
    try {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
    } catch {
      // Keep the response the same to avoid confirming whether an address has an account.
    }
    return { success: "reset-requested" };
  }

  if (intent !== "sign-in" && intent !== "sign-up") return { error: "invalid" };
  const emailValue = form.get("email");
  const passwordValue = form.get("password");
  if (typeof emailValue !== "string" || typeof passwordValue !== "string" || emailValue.length > 254 || passwordValue.length < 8 || passwordValue.length > 128) {
    return { error: "invalid" };
  }
  const email = emailValue.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "invalid" };

  let result;
  try {
    result = intent === "sign-in"
      ? await supabase.auth.signInWithPassword({ email, password: passwordValue })
      : await supabase.auth.signUp({ email, password: passwordValue });
  } catch {
    return { error: "failed" };
  }
  if (result.error) return { error: "failed" };
  if (intent === "sign-up" && !result.data.session) return { success: "created" };
  return new Response(null, { status: 303, headers: { Location: `/${locale}/account`, "Cache-Control": "private, no-store" } });
}
