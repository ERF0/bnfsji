import { Link, useLoaderData } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server.js";

export function meta() {
  return [{ title: "Platform workspace | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}

export async function loader({ request, params, context }) {
  const locale = params.locale === "en" ? "en" : "ar";
  const ownerPage = new URL(request.url).pathname.split("/").includes("owner");
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, ownerPage, state: "signed-out" };
  if (!supabase) return { locale, ownerPage, state: "unconfigured" };
  if (claims.aal !== "aal2") return { locale, ownerPage, state: "mfa" };

  const [adminResult, ownerResult] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase.rpc("is_platform_owner"),
  ]);
  if (adminResult.error || ownerResult.error) return { locale, ownerPage, state: "unavailable" };
  const isAdmin = adminResult.data === true;
  const isOwner = ownerResult.data === true;
  if ((!isAdmin && !isOwner) || (ownerPage && !isOwner)) return { locale, ownerPage, state: "denied" };

  const [applications, categories, admins] = await Promise.all([
    supabase.from("seller_applications").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    isOwner ? supabase.rpc("list_category_proposals") : Promise.resolve({ data: [], error: null }),
    isOwner ? supabase.rpc("list_platform_admins") : Promise.resolve({ data: [], error: null }),
  ]);
  if (applications.error || categories.error || admins.error) return { locale, ownerPage, state: "unavailable" };
  return {
    locale, ownerPage, isOwner, state: "ready",
    pendingApplications: applications.count ?? 0,
    pendingCategories: (categories.data ?? []).filter((proposal) => proposal.status === "pending").length,
    adminCount: admins.data?.length ?? 0,
  };
}

const copy = {
  en: {
    back: "Back to marketplace", admin: "Platform workspace", owner: "Owner workspace",
    adminIntro: "Review seller applications and keep marketplace categories in order.",
    ownerIntro: "Manage platform access, review queues, and delivery settings.",
    sellers: "Seller applications", sellersHelp: "Review submitted shops and assigned address proof.",
    categories: "Category proposals", categoriesHelp: "Propose or approve marketplace categories.",
    admins: "Platform administrators", adminsHelp: "Grant or revoke administrator access.",
    delivery: "Platform delivery fee", deliveryHelp: "Review the Amman delivery fee and its change history.",
    pending: "Pending", people: "Administrators", signIn: "Sign in with an assigned platform account.",
    mfa: "Verify two-step authentication to continue.", denied: "This account cannot access this workspace.",
    unconfigured: "Platform tools are unavailable until Supabase is configured.",
    unavailable: "Workspace information could not be loaded. Try again.",
  },
  ar: {
    back: "العودة إلى السوق", admin: "مساحة عمل المنصة", owner: "مساحة عمل المالك",
    adminIntro: "راجع طلبات البائعين وتابع تنظيم فئات السوق.",
    ownerIntro: "أدر صلاحيات المنصة وطلبات المراجعة ورسوم التوصيل.",
    sellers: "طلبات البائعين", sellersHelp: "راجع المتاجر المقدمة وإثباتات العناوين المحالة.",
    categories: "مقترحات الفئات", categoriesHelp: "اقترح فئات السوق أو وافق عليها.",
    admins: "مسؤولو المنصة", adminsHelp: "أضف صلاحيات المسؤولين أو أزلها.",
    delivery: "رسوم توصيل المنصة", deliveryHelp: "راجع رسوم التوصيل في عمّان وسجل تغييراتها.",
    pending: "قيد الانتظار", people: "المسؤولون", signIn: "سجل الدخول بحساب مُسند إليه دور في المنصة.",
    mfa: "تحقق بخطوتين للمتابعة.", denied: "لا يملك هذا الحساب صلاحية دخول مساحة العمل.",
    unconfigured: "تتعذر إتاحة أدوات المنصة قبل إعداد Supabase.",
    unavailable: "تعذر تحميل معلومات مساحة العمل. حاول مجدداً.",
  },
};

export default function AdminHomeRoute() {
  const data = useLoaderData();
  const text = copy[data.locale];
  const current = data.ownerPage ? "/owner" : "/admin";
  const links = [
    { href: "/admin/sellers", title: text.sellers, help: text.sellersHelp, count: data.pendingApplications, countLabel: text.pending },
    { href: "/admin/categories", title: text.categories, help: text.categoriesHelp, count: data.isOwner ? data.pendingCategories : undefined, countLabel: text.pending },
    ...(data.isOwner ? [
      { href: "/owner/admins", title: text.admins, help: text.adminsHelp, count: data.adminCount, countLabel: text.people },
      { href: "/owner/delivery", title: text.delivery, help: text.deliveryHelp },
    ] : []),
  ];
  return <main className="account-shell" lang={data.locale} dir={data.locale === "ar" ? "rtl" : "ltr"}>
    <Link to={`/${data.locale}`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={data.locale} section={data.ownerPage ? "owner" : "admin"} current={current} ownerAccess={data.isOwner} />
    <section className="account-card platform-overview">
      <p className="eyebrow">BNAFSAJI {data.ownerPage ? "OWNER" : "ADMIN"}</p>
      <h1>{data.ownerPage ? text.owner : text.admin}</h1>
      {data.state === "signed-out" ? <p><Link to={`/${data.locale}/account`}>{text.signIn}</Link></p> : data.state === "mfa" ? <p role="status"><Link to={`/${data.locale}/account/mfa?returnTo=${encodeURIComponent(`/${data.locale}${current}`)}`}>{text.mfa}</Link></p> : data.state !== "ready" ? <p role={data.state === "denied" ? "alert" : "status"}>{text[data.state] ?? text.unavailable}</p> : <>
        <p>{data.ownerPage ? text.ownerIntro : text.adminIntro}</p>
        <div className="platform-overview-grid">{links.map((item) => <Link className="platform-overview-card" to={`/${data.locale}${item.href}`} key={item.href}>
          <span className="platform-overview-card-heading"><strong>{item.title}</strong>{item.count !== undefined && <span className="platform-overview-count"><bdi>{new Intl.NumberFormat(data.locale === "ar" ? "ar-JO" : "en-JO").format(item.count)}</bdi><small>{item.countLabel}</small></span>}</span>
          <span>{item.help}</span><span className="platform-overview-link" aria-hidden="true">↗</span>
        </Link>)}</div>
      </>}
    </section>
  </main>;
}
