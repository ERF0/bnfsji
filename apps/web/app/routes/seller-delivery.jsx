import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { formatJod } from "../lib/catalog.js";
import { sellerDeliveryAction, sellerDeliveryLoader } from "../lib/delivery-settings.server.js";
export { sellerDeliveryAction as action, sellerDeliveryLoader as loader };

const copy = {
  en: { title: "Amman delivery fee", intro: "Set one delivery fee for your shop's orders across Amman. The buyer sees this amount before checkout.", fee: "Fee (JOD)", save: "Save fee", unset: "Not configured. Checkout stays unavailable until a fee is set.", current: "Current fee", history: "Change history", from: "Previous", to: "New", saved: "Delivery fee saved.", back: "Back to seller catalog", signIn: "Sign in to manage shop delivery.", noShop: "An approved shop is required.", failed: "The request could not be completed.", invalid: "Enter a non-negative JOD amount with up to three decimal places." },
  ar: { title: "رسوم التوصيل في عمّان", intro: "حدّد رسماً واحداً لتوصيل طلبات متجرك في عمّان. يظهر المبلغ للمشتري قبل إتمام الطلب.", fee: "الرسوم (دينار أردني)", save: "حفظ الرسوم", unset: "لم تُحدّد الرسوم. سيبقى إتمام الطلب غير متاح حتى تحديدها.", current: "الرسوم الحالية", history: "سجل التغييرات", from: "السابق", to: "الجديد", saved: "حُفظت رسوم التوصيل.", back: "العودة إلى كتالوج البائع", signIn: "سجّل الدخول لإدارة توصيل متجرك.", noShop: "يلزم وجود متجر معتمد.", failed: "تعذر إكمال الطلب.", invalid: "أدخل مبلغاً غير سالب وبحد أقصى ثلاثة منازل عشرية." },
};

export function meta() { return [{ title: "Seller delivery fee | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }]; }

export default function SellerDeliveryRoute() {
  const data = useLoaderData();
  const result = useActionData();
  const busy = useNavigation().state !== "idle";
  const text = copy[data.locale];
  const rtl = data.locale === "ar";
  return <main className="account-shell" lang={data.locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${data.locale}/seller/products`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={data.locale} section="seller" current="/seller/delivery" ownerAccess={data.state === "ready"} />
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI SELLER</p><h1>{text.title}</h1><p>{text.intro}</p>
      {data.state === "signed-out" ? <p><Link to={`/${data.locale}/account`}>{text.signIn}</Link></p> : data.state === "no-shop" ? <p>{text.noShop}</p> : data.state !== "ready" ? <p role="status">{data.state === "unconfigured" ? (rtl ? "هذه الخدمة غير متاحة حالياً." : "This service is currently unavailable.") : text.failed}</p> : <>
        <h2>{rtl ? data.shop.name_ar : data.shop.name_en}</h2>
        {data.fee == null ? <p role="status">{text.unset}</p> : <p>{text.current}: <bdi>{formatJod(data.fee, data.locale)}</bdi></p>}
        <Form method="post" className="account-form"><input type="hidden" name="shop_id" value={data.shop.shop_id} />
          <label>{text.fee}<input name="fee_jod" type="text" inputMode="decimal" pattern="\d{1,13}(\.\d{1,3})?" maxLength={17} defaultValue={data.input} required /></label>
          <button className="button button-primary" name="intent" value="save-seller-fee" disabled={busy}>{busy ? `${text.save}…` : text.save}</button>
        </Form>
        {result?.saved && <p role="status">{text.saved}</p>}{result?.error === "invalid" && <p role="alert">{text.invalid}</p>}{result?.error && result.error !== "invalid" && <p role="alert">{text.failed}</p>}
        <h2>{text.history}</h2><ol className="account-results">{data.history.map((event, index) => <li key={`${event.created_at}-${index}`}><div>{text.from}: <bdi>{event.fee_before_fils == null ? "—" : formatJod(event.fee_before_fils, data.locale)}</bdi> · {text.to}: <bdi>{event.fee_after_fils == null ? "—" : formatJod(event.fee_after_fils, data.locale)}</bdi></div><div>{event.actor_email}</div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(data.locale === "ar" ? "ar-JO" : "en-JO")}</time></li>)}</ol>
      </>}
    </section>
  </main>;
}
