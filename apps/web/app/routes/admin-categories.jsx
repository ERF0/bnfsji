import { Form, Link, useActionData, useLoaderData } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { action, loader } from "../lib/admin-categories.server.js";
export { action, loader };

const copy = {
  en: { title: "Category proposals", intro: "Platform staff can propose categories. A proposal stays private and inactive until the platform owner approves it.", slug: "URL slug", nameAr: "Category name in Arabic", nameEn: "Category name in English", propose: "Submit proposal", pending: "Pending owner decision", approved: "Approved", rejected: "Rejected", approve: "Approve and activate", reject: "Reject", none: "No category proposals yet.", signIn: "Sign in with a platform staff account.", mfa: "Verify two-step authentication to continue.", denied: "Only platform staff can propose categories; only the owner can review them.", failed: "The request could not be completed.", submitted: "Category proposal submitted.", saved: "Decision recorded.", back: "Back to marketplace", proposedBy: "Proposed by", reviewedBy: "Reviewed by" },
  ar: { title: "مقترحات الفئات", intro: "يمكن لفريق المنصة اقتراح فئات. تبقى الفئة غير نشطة ولا تظهر للعامة حتى يوافق عليها مالك المنصة.", slug: "الرابط المختصر", nameAr: "اسم الفئة بالعربية", nameEn: "اسم الفئة بالإنجليزية", propose: "إرسال المقترح", pending: "بانتظار قرار المالك", approved: "تمت الموافقة", rejected: "مرفوض", approve: "الموافقة والتفعيل", reject: "رفض", none: "لا توجد مقترحات فئات بعد.", signIn: "سجّل الدخول بحساب فريق المنصة.", mfa: "تحقق بخطوتين للمتابعة.", denied: "يستطيع فريق المنصة تقديم المقترحات، والمالك وحده يراجعها.", failed: "تعذر إكمال الطلب.", submitted: "تم إرسال مقترح الفئة.", saved: "تم تسجيل القرار.", back: "العودة إلى السوق", proposedBy: "اقترحها", reviewedBy: "راجعها" },
};

export function meta() { return [{ title: "Category proposals | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }]; }

export default function AdminCategoriesRoute() {
  const { locale, state, proposals, isOwner } = useLoaderData();
  const result = useActionData();
  const text = copy[locale];
  const rtl = locale === "ar";
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={locale} section="admin" current="/admin/categories" ownerAccess={isOwner} />
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI ADMIN</p><h1>{text.title}</h1><p>{text.intro}</p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{text.signIn}</Link></p> : state === "mfa" ? <p role="status"><Link to={`/${locale}/account/mfa?returnTo=${encodeURIComponent(`/${locale}/admin/categories`)}`}>{text.mfa}</Link></p> : state === "denied" ? <p role="alert">{text.denied}</p> : state !== "ready" ? <p role="status">{state === "unconfigured" ? (rtl ? "هذه الخدمة غير متاحة حالياً." : "This service is currently unavailable.") : text.failed}</p> : <>
        <Form method="post" className="account-form">
          <label>{text.slug}<input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} required /></label>
          <label>{text.nameAr}<input name="name_ar" dir="rtl" maxLength={100} required /></label>
          <label>{text.nameEn}<input name="name_en" dir="ltr" maxLength={100} required /></label>
          <button className="button button-primary" name="intent" value="propose">{text.propose}</button>
        </Form>
        {result?.proposed && <p role="status">{text.submitted}</p>}{result?.reviewed && <p role="status">{text.saved}</p>}{result?.error && <p role="alert">{text.failed}</p>}
        {isOwner && <><h2>{text.pending}</h2>{proposals.length ? <ul className="account-results">{proposals.map((proposal) => <li key={proposal.proposal_id}>
          <div><strong>{proposal.name_ar} · {proposal.name_en}</strong><div dir="ltr">{proposal.slug} · {proposal.status}</div><div>{text.proposedBy}: {proposal.proposer_email}{proposal.reviewer_email ? ` · ${text.reviewedBy}: ${proposal.reviewer_email}` : ""}</div></div>
          {proposal.status === "pending" && <Form method="post" className="account-buttons"><input type="hidden" name="proposal_id" value={proposal.proposal_id} /><button className="button button-primary" name="intent" value="approve-category">{text.approve}</button><button className="button button-secondary" name="intent" value="reject-category">{text.reject}</button></Form>}
        </li>)}</ul> : <p>{text.none}</p>}</>}
      </>}
    </section>
  </main>;
}
