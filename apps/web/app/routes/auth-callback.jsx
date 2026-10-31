import { redirect } from "react-router";
import { supabaseAuthContext } from "../lib/auth-context.server";

export async function loader({ request, context }) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "ar";
  const flow = url.searchParams.get("flow");
  const code = url.searchParams.get("code");
  const supabase = context.get(supabaseAuthContext);
  if (!code || !supabase) throw new Response("Authentication callback is not configured", { status: 503 });
  let error;
  try {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } catch {
    throw new Response("Sign-in could not be completed. Please try again.", { status: 400 });
  }
  if (error) throw new Response("Sign-in could not be completed. Please try again.", { status: 400 });
  return redirect(flow === "recovery" ? `/${locale}/account/reset-password` : `/${locale}/account`, { headers: { "Cache-Control": "private, no-store" } });
}

export default function AuthCallbackRoute() { return null; }
