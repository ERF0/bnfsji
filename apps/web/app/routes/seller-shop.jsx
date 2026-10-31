import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
export { loader, action } from "../lib/shop-profile.server.js";

const copy = {
  en: { title: "Shop profile", intro: "These details appear on your public shop page. Your shop URL stays the same when you change its name.", back: "Back to seller workspace", signIn: "Sign in to manage your shop profile.", noShop: "Only the owner of an approved shop can edit its profile.", inactive: "This shop is not active. Its public profile cannot be edited here.", setup: "Shop profile tools are not configured yet.", failed: "The shop profile could not be loaded or saved. Try again.", invalid: "Enter shop names of 2–120 characters and descriptions of at most 1,000 characters.", nameAr: "Shop name in Arabic", nameEn: "Shop name in English", descriptionAr: "Shop description in Arabic", descriptionEn: "Shop description in English", url: "Public shop URL", preview: "View public shop", save: "Save profile", saving: "Saving…", saved: "Shop profile saved." },
  ar: { title: "ملف المتجر", intro: "تظهر هذه التفاصيل في صفحة متجرك العامة. يبقى رابط المتجر كما هو عند تغيير اسمه.", back: "العودة إلى مساحة البائع", signIn: "سجّل الدخول لإدارة ملف متجرك.", noShop: "يمكن لمالك المتجر المعتمد فقط تعديل ملفه.", inactive: "هذا المتجر غير نشط. لا يمكن تعديل ملفه العام هنا.", setup: "أدوات ملف المتجر غير مهيأة بعد.", failed: "تعذر تحميل ملف المتجر أو حفظه. حاول مجدداً.", invalid: "أدخل اسماً للمتجر بين حرفين و120 حرفاً، ووصفاً لا يتجاوز 1000 حرف.", nameAr: "اسم المتجر بالعربية", nameEn: "اسم المتجر بالإنجليزية", descriptionAr: "وصف المتجر بالعربية", descriptionEn: "وصف المتجر بالإنجليزية", url: "رابط المتجر العام", preview: "عرض المتجر العام", save: "حفظ الملف", saving: "جارٍ الحفظ…", saved: "حُفظ ملف المتجر." },
};

export function meta({ loaderData }) { return [{ title: `${copy[loaderData?.locale ?? "en"].title} | BNAFSAJI` }, { name: "robots", content: "noindex,nofollow" }]; }

export default function SellerShopRoute() {
  const { locale, state, shop } = useLoaderData();
  const result = useActionData();
  const navigation = useNavigation();
  const text = copy[locale];
  const busy = navigation.state === "submitting";
  return <main className="account-shell" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <Link className="account-back" to={`/${locale}/seller`}>{text.back}</Link>
    <PortalNavigation locale={locale} section="seller" current="/seller/shop" ownerAccess={state === "ready" || state === "inactive"} />
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI SELLER</p><h1>{text.title}</h1><p>{text.intro}</p>
      {state === "signed-out" ? <p role="status"><Link to={`/${locale}/account`}>{text.signIn}</Link></p> :
        state === "unconfigured" ? <p role="status">{text.setup}</p> :
        state === "no-shop" ? <p role="status">{text.noShop}</p> :
        state === "inactive" ? <p role="status">{text.inactive}</p> :
        state !== "ready" ? <p role="alert">{text.failed}</p> : <>
          <p>{text.url}: <code dir="ltr">/{locale}/s/{shop.slug}</code> · <Link to={`/${locale}/s/${shop.slug}`}>{text.preview}</Link></p>
          <Form method="post" className="account-form"><input type="hidden" name="shop_id" value={shop.shop_id} />
            <label>{text.nameAr}<input name="name_ar" lang="ar" dir="rtl" defaultValue={shop.name_ar} required minLength={2} maxLength={120} /></label>
            <label>{text.nameEn}<input name="name_en" lang="en" dir="ltr" defaultValue={shop.name_en} required minLength={2} maxLength={120} /></label>
            <label>{text.descriptionAr}<textarea name="description_ar" lang="ar" dir="rtl" defaultValue={shop.description_ar} maxLength={1000} rows={4} /></label>
            <label>{text.descriptionEn}<textarea name="description_en" lang="en" dir="ltr" defaultValue={shop.description_en} maxLength={1000} rows={4} /></label>
            <button className="button button-primary" name="intent" value="save" disabled={busy}>{busy ? text.saving : text.save}</button>
          </Form>
          {result?.saved && <p role="status">{text.saved}</p>}
          {result?.error && <p role="alert">{result.error === "invalid" ? text.invalid : text.failed}</p>}
        </>}
    </section>
  </main>;
}
