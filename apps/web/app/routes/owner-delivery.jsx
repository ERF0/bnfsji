import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { formatJod } from "../lib/catalog.js";
import { ownerDeliveryAction, ownerDeliveryLoader } from "../lib/delivery-settings.server.js";
export { ownerDeliveryAction as action, ownerDeliveryLoader as loader };

const copy = {
  en: { title: "Platform delivery fee", intro: "Set the fixed Amman fee for a consolidated multi-seller delivery.", fee: "Fee (JOD)", save: "Save fee", unset: "Not configured. Multi-seller checkout stays unavailable until a fee is set.", current: "Current fee", history: "Change history", from: "Previous", to: "New", saved: "Platform delivery fee saved.", back: "Back to owner panel", signIn: "Sign in with the platform owner account.", mfa: "Verify two-step authentication to continue.", denied: "Only the platform owner can change this fee.", failed: "The request could not be completed.", invalid: "Enter a non-negative JOD amount with up to three decimal places." },
  ar: { title: "رسوم توصيل المنصة", intro: "حدّد رسماً ثابتاً في عمّان لتوصيل الطلبات المجمّعة من عدة متاجر.", fee: "الرسوم (دينار أردني)", save: "حفظ الرسوم", unset: "لم تُحدّد الرسوم. سيبقى إتمام طلبات المتاجر المتعددة غير متاح حتى تحديدها.", current: "الرسوم الحالية", history: "سجل التغييرات", from: "السابق", to: "الجديد", saved: "حُفظت رسوم توصيل المنصة.", back: "العودة إلى لوحة المالك", signIn: "سجّل الدخول بحساب مالك المنصة.", mfa: "تحقق بخطوتين للمتابعة.", denied: "مالك المنصة وحده يستطيع تغيير هذه الرسوم.", failed: "تعذر إكمال الطلب.", invalid: "أدخل مبلغاً غير سالب وبحد أقصى ثلاثة منازل عشرية." },
};

export function meta() { return [{ title: "Platform delivery fee | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }]; }

export default function OwnerDeliveryRoute() {
  const data = useLoaderData();
  const result = useActionData();
  const busy = useNavigation().state !== "idle";
  const text = copy[data.locale];
  const rtl = data.locale === "ar";
  return <main className="account-shell" lang={data.locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${data.locale}/owner/admins`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={data.locale} section="owner" current="/owner/delivery" />
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI OWNER</p><h1>{text.title}</h1><p>{text.intro}</p>
      {data.state === "signed-out" ? <p><Link to={`/${data.locale}/account`}>{text.signIn}</Link></p> : data.state === "mfa" ? <p role="status"><Link to={`/${data.locale}/account/mfa?returnTo=${encodeURIComponent(`/${data.locale}/owner/delivery`)}`}>{text.mfa}</Link></p> : data.state === "denied" ? <p>{text.denied}</p> : data.state !== "ready" ? <p role="status">{data.state === "unconfigured" ? (rtl ? "هذه الخدمة غير متاحة حالياً." : "This service is currently unavailable.") : text.failed}</p> : <>
        {data.fee == null ? <p role="status">{text.unset}</p> : <p>{text.current}: <bdi>{formatJod(data.fee, data.locale)}</bdi></p>}
        <Form method="post" className="account-form"><label>{text.fee}<input name="fee_jod" type="text" inputMode="decimal" pattern="\d{1,13}(\.\d{1,3})?" maxLength={17} defaultValue={data.input} required /></label>
          <button className="button button-primary" name="intent" value="save-platform-fee" disabled={busy}>{busy ? `${text.save}…` : text.save}</button>
        </Form>
        {result?.saved && <p role="status">{text.saved}</p>}{result?.error === "invalid" && <p role="alert">{text.invalid}</p>}{result?.error && result.error !== "invalid" && <p role="alert">{text.failed}</p>}
        <h2>{text.history}</h2><ol className="account-results">{data.history.map((event, index) => <li key={`${event.created_at}-${index}`}><div>{text.from}: <bdi>{event.fee_before_fils == null ? "—" : formatJod(event.fee_before_fils, data.locale)}</bdi> · {text.to}: <bdi>{event.fee_after_fils == null ? "—" : formatJod(event.fee_after_fils, data.locale)}</bdi></div><div>{event.actor_email}</div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(data.locale === "ar" ? "ar-JO" : "en-JO")}</time></li>)}</ol>
      </>}
    </section>
  </main>;
}
