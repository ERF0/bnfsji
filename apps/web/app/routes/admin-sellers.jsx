import { Form, Link, useActionData, useLoaderData } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { sameOriginPost } from "../lib/auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";

const copy = {
  en: { title: "Seller applications", back: "Back to marketplace", assigned: "Assigned reviewer", assign: "Assign reviewer", approve: "Approve seller", reject: "Reject and request changes", reason: "Reason for rejection", empty: "No applications are waiting for your review.", denied: "This account cannot access seller reviews.", signIn: "Sign in with an assigned administrator account.", mfa: "Verify two-step authentication to view seller details.", failed: "The request could not be completed.", proof: "Open private address proof", contact: "Contact", address: "Business address", submitted: "Submitted", success: "Application updated." },
  ar: { title: "طلبات البائعين", back: "العودة إلى السوق", assigned: "المسؤول المعيّن", assign: "تعيين مسؤول للمراجعة", approve: "قبول البائع", reject: "الرفض وطلب التعديل", reason: "سبب طلب التعديل", empty: "لا توجد طلبات بانتظار مراجعتك.", denied: "لا يملك هذا الحساب صلاحية مراجعة البائعين.", signIn: "سجّل الدخول بحساب مسؤول معيّن.", mfa: "تحقق بخطوتين لعرض بيانات البائع.", failed: "تعذر إكمال الطلب.", proof: "فتح إثبات العنوان الخاص", contact: "التواصل", address: "عنوان النشاط", submitted: "تاريخ الإرسال", success: "تم تحديث الطلب." },
};

function localePath(value) { return value === "en" ? "en" : "ar"; }

export function meta() {
  return [{ title: "Seller review | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}

export async function loader({ params, context }) {
  const locale = localePath(params.locale);
  const supabase = context.get(supabaseAuthContext);
  const claims = context.get(supabaseClaimsContext);
  if (!claims?.sub) return { locale, state: "signed-out", applications: [], admins: [] };
  if (!supabase) return { locale, state: "unconfigured", applications: [], admins: [] };
  if (claims.aal !== "aal2") return { locale, state: "mfa", applications: [], admins: [] };
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  const { data: isOwner } = await supabase.rpc("is_platform_owner");
  if (isAdmin !== true && isOwner !== true) return { locale, state: "denied", applications: [], admins: [] };
  const { data, error } = await supabase.from("seller_applications")
    .select("id, applicant_user_id, store_name_ar, store_name_en, contact, address, proof_path, assigned_reviewer_id, submitted_at, status")
    .eq("status", "submitted").order("submitted_at", { ascending: true }).limit(100);
  if (error) return { locale, state: "unavailable", applications: [], admins: [] };

  const applications = await Promise.all((data ?? []).map(async (application) => {
    let proofUrl = null;
    if (application.assigned_reviewer_id === claims.sub && application.proof_path) {
      const { data: signed } = await supabase.storage.from("seller-address-proofs").createSignedUrl(application.proof_path, 60);
      proofUrl = signed?.signedUrl ?? null;
    }
    return { ...application, proofUrl };
  }));
  const { data: admins = [] } = isOwner === true ? await supabase.rpc("list_platform_admins") : { data: [] };
  return { locale, state: "ready", applications, admins, isOwner: isOwner === true, viewerId: claims.sub };
}

export async function action({ request, context }) {
  const supabase = context.get(supabaseAuthContext);
  const claims = context.get(supabaseClaimsContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  if (claims.aal !== "aal2") return { error: "mfa" };
  const form = await request.formData();
  const intent = form.get("intent");
  const applicationId = form.get("application_id");
  if (typeof applicationId !== "string" || !/^[0-9a-f-]{36}$/i.test(applicationId)) return { error: "failed" };
  if (intent === "assign") {
    const { data: isOwner } = await supabase.rpc("is_platform_owner");
    const reviewerId = form.get("reviewer_id");
    if (isOwner !== true || typeof reviewerId !== "string" || !/^[0-9a-f-]{36}$/i.test(reviewerId)) return { error: "failed" };
    const { error } = await supabase.rpc("assign_seller_reviewer", { p_application_id: applicationId, p_reviewer_id: reviewerId });
    return error ? { error: "failed" } : { success: true };
  }
  if (intent === "approve" || intent === "reject") {
    const reason = form.get("reason");
    if (intent === "reject" && (typeof reason !== "string" || reason.trim().length < 1 || reason.length > 2000)) return { error: "failed" };
    const { error } = await supabase.rpc("review_seller_application", {
      p_application_id: applicationId, p_decision: intent, p_reason: intent === "reject" ? reason.trim() : null,
    });
    return error ? { error: "failed" } : { success: true };
  }
  return { error: "failed" };
}

export default function AdminSellersRoute() {
  const { locale, state, applications, admins, isOwner, viewerId } = useLoaderData();
  const actionData = useActionData();
  const text = copy[locale];
  const rtl = locale === "ar";
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={locale} section="admin" current="/admin/sellers" ownerAccess={isOwner} />
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI ADMIN</p><h1>{text.title}</h1><p><Link to={`/${locale}/admin/categories`}>{locale === "ar" ? "مقترحات الفئات" : "Category proposals"}</Link></p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{text.signIn}</Link></p> : state === "mfa" ? <p role="status"><Link to={`/${locale}/account/mfa?returnTo=${encodeURIComponent(`/${locale}/admin/sellers`)}`}>{text.mfa}</Link></p> : state === "denied" ? <p role="alert">{text.denied}</p> : state !== "ready" ? <p role="status">{state === "unconfigured" ? (rtl ? "هذه الخدمة غير متاحة حالياً." : "This service is currently unavailable.") : text.failed}</p> : applications.length === 0 ? <p>{text.empty}</p> : <div className="seller-review-list">{applications.map((application) => <article className="seller-review-card" key={application.id}>
        <h2>{application.store_name_ar} <bdi dir="ltr">{application.store_name_en}</bdi></h2><p>{text.contact}: <bdi dir="auto">{application.contact}</bdi></p><p>{text.address}: <bdi dir="auto">{application.address}</bdi></p><p>{text.submitted}: <time dateTime={application.submitted_at}>{application.submitted_at}</time></p>
        {application.proofUrl && <a href={application.proofUrl} rel="noreferrer" target="_blank">{text.proof}</a>}
        {isOwner && <Form method="post" className="account-form"><input type="hidden" name="application_id" value={application.id} /><label>{text.assigned}<select name="reviewer_id" required defaultValue={application.assigned_reviewer_id ?? ""}><option value="" disabled>{text.assigned}</option>{admins.map((admin) => <option key={admin.user_id} value={admin.user_id}>{admin.email}</option>)}</select></label><button className="button button-secondary" name="intent" value="assign">{text.assign}</button></Form>}
        {application.assigned_reviewer_id === viewerId && <Form method="post" className="account-form"><input type="hidden" name="application_id" value={application.id} /><label>{text.reason}<textarea name="reason" maxLength={2000} /></label><div className="account-buttons"><button className="button button-primary" name="intent" value="approve">{text.approve}</button><button className="button button-secondary" name="intent" value="reject">{text.reject}</button></div></Form>}
      </article>)}</div>}
      {actionData?.success && <p role="status">{text.success}</p>}{actionData?.error && <p role="alert">{actionData.error === "mfa" ? text.mfa : text.failed}</p>}
    </section>
  </main>;
}
