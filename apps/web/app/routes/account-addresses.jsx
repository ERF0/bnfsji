import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
export { action, loader } from "../lib/addresses.server.js";

const copy = {
  en: { title: "Saved addresses", back: "Back to account", intro: "Save an Amman address for later. Delivery eligibility and cost are confirmed at checkout when ordering becomes available.", signIn: "Sign in to manage your addresses.", setup: "Address storage is not configured yet.", unavailable: "Addresses could not be loaded. Try again later.", empty: "You have no saved addresses.", add: "Add an address", edit: "Edit", save: "Save address", remove: "Remove", recipient: "Recipient name", phone: "Contact phone", area: "Area in Amman", street: "Street and address", building: "Building or apartment (optional)", city: "Amman, Jordan", added: "Address saved.", updated: "Address updated.", removed: "Address removed.", invalid: "Check the address and phone details.", failed: "The address could not be saved. Try again.", limit: "You can save up to 10 addresses.", saving: "Saving…" },
  ar: { title: "العناوين المحفوظة", back: "العودة إلى الحساب", intro: "احفظ عنواناً في عمّان لاستخدامه لاحقاً. تُؤكَّد أهلية التوصيل وتكلفته عند إتاحة إتمام الطلب.", signIn: "سجّل الدخول لإدارة عناوينك.", setup: "خدمة حفظ العناوين غير مهيأة بعد.", unavailable: "تعذر تحميل العناوين. حاول لاحقاً.", empty: "ليس لديك عناوين محفوظة.", add: "إضافة عنوان", edit: "تعديل", save: "حفظ العنوان", remove: "إزالة", recipient: "اسم المستلم", phone: "رقم الهاتف للتواصل", area: "المنطقة في عمّان", street: "الشارع والعنوان", building: "المبنى أو الشقة (اختياري)", city: "عمّان، الأردن", added: "حُفظ العنوان.", updated: "حُدّث العنوان.", removed: "أُزيل العنوان.", invalid: "تحقق من تفاصيل العنوان ورقم الهاتف.", failed: "تعذر حفظ العنوان. حاول مجدداً.", limit: "يمكنك حفظ 10 عناوين كحد أقصى.", saving: "جارٍ الحفظ…" },
};

export function meta({ loaderData }) { return [{ title: `${loaderData?.locale === "ar" ? "العناوين المحفوظة" : "Saved addresses"} | BNAFSAJI` }, { name: "robots", content: "noindex,nofollow" }]; }

function AddressFields({ address, text }) {
  return <>
    <label>{text.recipient}<input name="recipient" defaultValue={address?.recipient ?? ""} autoComplete="name" required minLength={2} maxLength={100} /></label>
    <label>{text.phone}<input name="phone" type="tel" inputMode="tel" defaultValue={address?.phone ?? ""} autoComplete="tel" required maxLength={20} pattern="\+?[0-9 ]{8,20}" /></label>
    <label>{text.area}<input name="area" defaultValue={address?.area ?? ""} autoComplete="address-level2" required minLength={2} maxLength={100} /></label>
    <label>{text.street}<input name="street" defaultValue={address?.street ?? ""} autoComplete="street-address" required minLength={2} maxLength={160} /></label>
    <label>{text.building}<input name="building" defaultValue={address?.building ?? ""} maxLength={100} /></label>
  </>;
}

export default function AddressesRoute() {
  const { locale, state, addresses } = useLoaderData();
  const result = useActionData();
  const navigation = useNavigation();
  const text = copy[locale];
  const busy = navigation.state === "submitting";
  return <main className="account-shell" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <Link to={`/${locale}/account`} className="account-back">{text.back}</Link>
    <section className="account-card seller-application-card"><p className="eyebrow">BNAFSAJI</p><h1>{text.title}</h1><p>{text.intro}</p>
      {state === "signed-out" ? <p role="status">{text.signIn} <Link to={`/${locale}/account`}>{text.back}</Link></p> :
        state !== "ready" ? <p role="status">{state === "unconfigured" ? text.setup : text.unavailable}</p> : <>
          {addresses.length === 0 ? <p>{text.empty}</p> : <ul className="account-results">{addresses.map((address) => <li key={address.id}>
            <strong>{address.recipient}</strong><p>{address.area} · {address.street}{address.building ? ` · ${address.building}` : ""}</p><p><bdi>{address.phone}</bdi></p>
            <details><summary>{text.edit}</summary><Form method="post" className="account-form"><input type="hidden" name="id" value={address.id} /><AddressFields address={address} text={text} /><button className="button button-primary" name="intent" value="edit" disabled={busy}>{busy ? text.saving : text.save}</button></Form></details>
            <Form method="post"><input type="hidden" name="id" value={address.id} /><button className="button button-secondary" name="intent" value="remove" disabled={busy}>{text.remove}</button></Form>
          </li>)}</ul>}
          {addresses.length < 10 && <details><summary>{text.add}</summary><Form method="post" className="account-form"><AddressFields text={text} /><button className="button button-primary" name="intent" value="add" disabled={busy}>{busy ? text.saving : text.save}</button></Form></details>}
          {result?.saved && <p role="status">{text[result.saved]}</p>}
          {result?.error && <p role="alert">{text[result.error] ?? text.failed}</p>}
        </>}
    </section>
  </main>;
}
