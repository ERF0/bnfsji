import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { sameOriginPost } from "../lib/auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";

const copy = {
  en: { title: "Platform administrators", intro: "Find an existing marketplace account and grant platform administrator access.", email: "Account email", search: "Search accounts", add: "Make administrator", remove: "Remove access", admins: "Current administrators", none: "No administrators have been added.", audit: "Recent administrator changes", granted: "Access granted", revoked: "Access revoked", back: "Back to marketplace", signIn: "Sign in as the platform owner.", mfa: "Verify two-step authentication to continue.", denied: "Only the platform owner can manage administrators.", failed: "The request could not be completed.", noMatches: "No matching accounts.", saved: "Administrator access updated." },
  ar: { title: "مسؤولو المنصة", intro: "إدارة صلاحيات مسؤولي المنصة.", email: "البريد الإلكتروني", search: "بحث", add: "إضافة مسؤول", remove: "إزالة", admins: "المسؤولون", none: "لا يوجد مسؤولون.", audit: "سجل التغييرات", granted: "تمت الإضافة", revoked: "تمت الإزالة", back: "عودة للسوق", signIn: "سجل الدخول.", mfa: "تحقق بخطوتين.", denied: "غير مصرح لك.", failed: "تعذر إكمال الطلب.", noMatches: "لا توجد نتائج.", saved: "تم التحديث." },
};

function localePath(value) { return value === "en" ? "en" : "ar"; }

export function meta() {
  return [{ title: "Platform administrators | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}
async function isOwner(supabase) {
  const { data, error } = await supabase.rpc("is_platform_owner");
  return !error && data === true;
}

export async function loader({ params, context }) {
  const locale = localePath(params.locale);
  const supabase = context.get(supabaseAuthContext);
  const claims = context.get(supabaseClaimsContext);
  if (!claims?.sub) return { locale, state: "signed-out", admins: [] };
  if (!supabase) return { locale, state: "unconfigured", admins: [] };
  if (claims.aal !== "aal2") return { locale, state: "mfa", admins: [] };
  if (!await isOwner(supabase)) return { locale, state: "denied", admins: [] };
  const [{ data: admins, error }, { data: audit, error: auditError }] = await Promise.all([
    supabase.rpc("list_platform_admins"),
    supabase.rpc("list_platform_admin_events"),
  ]);
  return { locale, state: error || auditError ? "unavailable" : "ready", admins: admins ?? [], audit: audit ?? [] };
}

export async function action({ request, params, context }) {
  const supabase = context.get(supabaseAuthContext);
  const claims = context.get(supabaseClaimsContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  if (claims.aal !== "aal2") return { error: "mfa" };
  if (!await isOwner(supabase)) return { error: "denied" };
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "search") {
    const email = form.get("email");
    if (typeof email !== "string" || email.trim().length < 3 || email.length > 254) return { error: "failed" };
    const { data, error } = await supabase.rpc("search_existing_accounts", { p_email: email.trim() });
    return error ? { error: "failed" } : { accounts: data ?? [] };
  }
  if (intent === "add-admin") {
    const userId = form.get("user_id");
    if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) return { error: "failed" };
    const { error } = await supabase.rpc("provision_platform_admin", { p_user_id: userId });
    return error ? { error: "failed" } : { success: true };
  }
  if (intent === "remove-admin") {
    const userId = form.get("user_id");
    if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) return { error: "failed" };
    const { error } = await supabase.rpc("revoke_platform_admin", { p_user_id: userId });
    return error ? { error: "failed" } : { success: true };
  }
  return { error: "failed" };
}

export default function OwnerAdminsRoute() {
  const { locale, state, admins, audit = [] } = useLoaderData();
  const actionData = useActionData();
  const busy = useNavigation().state !== "idle";
  const text = copy[locale];
  const rtl = locale === "ar";
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={locale} section="owner" current="/owner/admins" />
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI OWNER</p><h1>{text.title}</h1><p>{text.intro}</p><p><Link to={`/${locale}/admin/categories`}>{locale === "ar" ? "مراجعة مقترحات الفئات" : "Review category proposals"}</Link> &middot; <Link to={`/${locale}/owner/delivery`}>{locale === "ar" ? "\u0631\u0633\u0648\u0645 \u062a\u0648\u0635\u064a\u0644 \u0627\u0644\u0645\u0646\u0635\u0629" : "Platform delivery fee"}</Link></p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{text.signIn}</Link></p> : state === "mfa" ? <p role="status"><Link to={`/${locale}/account/mfa?returnTo=${encodeURIComponent(`/${locale}/owner/admins`)}`}>{text.mfa}</Link></p> : state === "denied" ? <p role="alert">{text.denied}</p> : state !== "ready" ? <p role="status">{state === "unconfigured" ? (rtl ? "هذه الخدمة غير متاحة حالياً." : "This service is currently unavailable.") : text.failed}</p> : <>
        <Form method="post" className="account-form"><label>{text.email}<input name="email" type="email" autoComplete="email" minLength={3} maxLength={254} required /></label><button className="button button-secondary" name="intent" value="search" disabled={busy}>{text.search}</button></Form>
        {actionData?.accounts?.length ? <ul className="account-results">{actionData.accounts.map((account) => <li key={account.user_id}><span dir="ltr">{account.email}</span><Form method="post"><input type="hidden" name="user_id" value={account.user_id} /><button className="button button-primary" name="intent" value="add-admin" disabled={busy}>{text.add}</button></Form></li>)}</ul> : actionData?.accounts ? <p>{text.noMatches}</p> : null}
        {actionData?.success && <p role="status">{text.saved}</p>}
        {actionData?.error && <p role="alert">{actionData.error === "denied" ? text.denied : actionData.error === "mfa" ? text.mfa : text.failed}</p>}
        <h2>{text.admins}</h2>{admins.length ? <ul className="account-results">{admins.map((admin) => <li key={admin.user_id}><span dir="ltr">{admin.email}</span><Form method="post"><input type="hidden" name="user_id" value={admin.user_id} /><button className="button button-secondary" name="intent" value="remove-admin" disabled={busy}>{text.remove}</button></Form></li>)}</ul> : <p>{text.none}</p>}
        <h2>{text.audit}</h2><ol className="account-results">{audit.map((event, index) => <li key={`${event.created_at}-${index}`}><span dir="ltr">{event.actor_email} → {event.target_email}</span><span>{event.action === "granted" ? text.granted : text.revoked}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(locale === "ar" ? "ar-JO" : "en-JO")}</time></li>)}</ol>
      </>}
    </section>
  </main>;
}
