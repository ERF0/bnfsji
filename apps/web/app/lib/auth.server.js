import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { cloudflareContext } from "./cloudflare-context.server";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server";
import { authConfigured } from "./auth-config.js";

export async function supabaseAuthMiddleware({ request, context }, next) {
  const env = context.get(cloudflareContext)?.env;
  if (!authConfigured(env)) {
    context.set(supabaseAuthContext, null);
    return next();
  }

  const cookiesToSet = [];
  const cookieHeaders = {};
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get("Cookie") ?? ""),
      setAll(cookies, headers) {
        cookiesToSet.push(...cookies);
        Object.assign(cookieHeaders, headers);
      },
    },
  });

  // Validate/refresh before route code. An Auth outage must not take down public catalog reads.
  let claims = null;
  try {
    const result = await supabase.auth.getClaims();
    if (!result.error) claims = result.data?.claims ?? null;
  } catch {
    // Private routes see no verified identity; public routes remain available.
  }
  context.set(supabaseAuthContext, supabase);
  context.set(supabaseClaimsContext, claims);
  const response = await next();
  const headers = new Headers(response.headers);
  for (const { name, value, options } of cookiesToSet) {
    headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
  }
  for (const [name, value] of Object.entries(cookieHeaders)) headers.set(name, value);

  const path = new URL(request.url).pathname;
  if (claims?.sub || cookiesToSet.length || /^\/(?:en|ar)\/(?:account|wishlist)(?:\/|$)/.test(path) || path === "/auth/callback") {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
