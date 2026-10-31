import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { sameOriginPost } from "../lib/auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";

const text = {
  en: { title: "Shop staff", intro: "Assign catalog and order access to existing marketplace accounts. One person can hold both roles.", email: "Account email", search: "Find account", catalog: "Catalog", orders: "Orders", save: "Save access", remove: "Remove all access", staff: "Current staff", none: "No staff access is assigned.", back: "Back to marketplace", signIn: "Sign in to manage your shop staff.", noShop: "An approved shop is required before staff can be assigned.", failed: "The request could not be completed.", noMatches: "No matching accounts.", saved: "Staff access updated." },
  ar: { title: "فريق المتجر", intro: "امنح صلاحيات المنتجات والطلبات لحسابات موجودة في السوق. يمكن للشخص الواحد امتلاك الصلاحيتين.", email: "البريد الإلكتروني للحساب", search: "البحث عن حساب", catalog: "المنتجات", orders: "الطلبات", save: "حفظ الصلاحيات", remove: "إزالة جميع الصلاحيات", staff: "الفريق الحالي", none: "لا توجد صلاحيات لفريق المتجر.", back: "العودة إلى السوق", signIn: "سجّل الدخول لإدارة فريق متجرك.", noShop: "يلزم وجود متجر معتمد قبل تعيين الفريق.", failed: "تعذر إكمال الطلب.", noMatches: "لم نعثر على حسابات مطابقة.", saved: "تم تحديث صلاحيات الفريق." },
};

function localePath(value) { return value === "en" ? "en" : "ar"; }

export function meta() {
  return [{ title: "Shop staff | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}

export async function loader({ params, context }) {
  const locale = localePath(params.locale);
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out", shop: null, staff: [] };
  if (!supabase) return { locale, state: "unconfigured", shop: null, staff: [] };
  const { data: shops, error } = await supabase.rpc("get_owned_shop");
  if (error) return { locale, state: "unavailable", shop: null, staff: [] };
  const shop = shops?.[0];
  if (!shop) return { locale, state: "no-shop", shop: null, staff: [] };
  const { data: staff, error: staffError } = await supabase.rpc("list_shop_staff", { p_shop_id: shop.shop_id });
  return { locale, state: staffError ? "unavailable" : "ready", shop, staff: staff ?? [] };
}

export async function action({ request, params, context }) {
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  const form = await request.formData();
  const { data: shops, error } = await supabase.rpc("get_owned_shop");
  if (error || !shops?.[0]) return { error: "failed" };
  const shopId = shops[0].shop_id;
  const intent = form.get("intent");
  if (intent === "search") {
    const email = form.get("email");
    if (typeof email !== "string" || email.trim().length < 3 || email.length > 254) return { error: "failed" };
    const { data, error: searchError } = await supabase.rpc("search_shop_staff_accounts", { p_shop_id: shopId, p_email: email.trim() });
    return searchError ? { error: "failed" } : { accounts: data ?? [] };
  }
  if (intent === "save") {
    const userId = form.get("user_id");
    if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) return { error: "failed" };
    const roles = [form.has("catalog") && "catalog", form.has("orders") && "orders"].filter(Boolean);
    const { error: saveError } = await supabase.rpc("set_shop_staff_access", { p_shop_id: shopId, p_user_id: userId, p_roles: roles });
    return saveError ? { error: "failed" } : { success: true };
  }
  return { error: "failed" };
}

export default function SellerStaffRoute() {
  const { locale, state, shop, staff } = useLoaderData();
  const data = useActionData();
  const busy = useNavigation().state !== "idle";
  const copy = text[locale];
  const rtl = locale === "ar";
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{copy.back}</Link>
    <PortalNavigation locale={locale} section="seller" current="/seller/staff" ownerAccess={state === "ready"} />
    <section className="account-card seller-application-card"><h1>{copy.title}</h1><p>{copy.intro}</p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{copy.signIn}</Link></p> : state === "no-shop" ? <p>{copy.noShop}</p> : state !== "ready" ? <p role="status">{state === "unconfigured" ? (rtl ? "هذه الخدمة غير متاحة حالياً." : "This service is currently unavailable.") : copy.failed}</p> : <>
        <h2>{locale === "ar" ? shop.name_ar : shop.name_en}</h2><p><Link to={`/${locale}/seller/delivery`}>{locale === "ar" ? "رسوم التوصيل" : "Delivery fee"}</Link></p>
        <Form method="post" className="account-form"><label>{copy.email}<input name="email" type="email" autoComplete="email" minLength={3} maxLength={254} required /></label><button className="button button-secondary" name="intent" value="search" disabled={busy}>{copy.search}</button></Form>
        {data?.accounts?.length ? <ul className="account-results">{data.accounts.map((account) => {
          const current = staff.find((member) => member.user_id === account.user_id);
          return <li key={account.user_id}><span dir="ltr">{account.email}</span><Form method="post" className="account-form"><input type="hidden" name="user_id" value={account.user_id} /><label><input type="checkbox" name="catalog" defaultChecked={current?.roles.includes("catalog")} disabled={busy} /> {copy.catalog}</label><label><input type="checkbox" name="orders" defaultChecked={current?.roles.includes("orders")} disabled={busy} /> {copy.orders}</label><button className="button button-primary" name="intent" value="save" disabled={busy}>{copy.save}</button></Form></li>;
        })}</ul> : data?.accounts ? <p>{copy.noMatches}</p> : null}
        {data?.success && <p role="status">{copy.saved}</p>}{data?.error && <p role="alert">{copy.failed}</p>}
        <h2>{copy.staff}</h2>{staff.length ? <ul className="account-results">{staff.map((member) => <li key={member.user_id}><span dir="ltr">{member.email}</span><span>{member.roles.map((role) => role === "catalog" ? copy.catalog : copy.orders).join(" · ")}</span><Form method="post"><input type="hidden" name="user_id" value={member.user_id} /><button className="button button-secondary" name="intent" value="save" disabled={busy}>{copy.remove}</button></Form></li>)}</ul> : <p>{copy.none}</p>}
      </>}
    </section>
  </main>;
}
