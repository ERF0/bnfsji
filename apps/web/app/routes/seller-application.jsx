import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { sameOriginPost } from "../lib/auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";
import { validateAddressProof, validateSellerApplication } from "../lib/seller-application.server.js";

const copy = {
  en: {
    title: "Open your seller shop", intro: "Tell us about your shop and provide address proof. An administrator will review your application.",
    storeAr: "Store name in Arabic", storeEn: "Store name in English", contact: "Seller contact", address: "Business address in Jordan",
    proof: "Address proof (PDF, JPG or PNG; up to 10 MB)", private: "Address proof is private and retained until your account closes. Only an administrator assigned to review your application can access it.",
    save: "Save draft", submit: "Submit for review", back: "Back to shopping", signIn: "Sign in to apply", unconfigured: "Seller applications are not available until Supabase is configured.",
    saveSuccess: "Draft saved.", submitSuccess: "Application submitted for review.", invalid: "Check the fields and upload a valid address-proof file.",
    failed: "We could not save the application. Please try again.", draft: "Draft", submitted: "Under review", rejected: "Changes requested", approved: "Approved",
    locked: "Your application has been submitted and cannot be edited while it is under review.", reason: "Review note", required: "Address proof is required before submission.",
  },
  ar: {
    title: "أنشئ متجرك كبائع", intro: "أدخل معلومات متجرك وأرفق إثبات العنوان. سيراجع أحد المسؤولين طلبك.",
    storeAr: "اسم المتجر بالعربية", storeEn: "اسم المتجر بالإنجليزية", contact: "بيانات التواصل مع البائع", address: "عنوان النشاط في الأردن",
    proof: "إثبات العنوان (PDF أو JPG أو PNG، بحد أقصى 10 ميغابايت)", private: "إثبات العنوان خاص ويُحتفظ به حتى إغلاق الحساب. لا يمكن الاطلاع عليه إلا للمسؤول المعيّن لمراجعة الطلب.",
    save: "حفظ المسودة", submit: "إرسال للمراجعة", back: "العودة للتسوق", signIn: "سجّل الدخول لتقديم الطلب", unconfigured: "طلبات البائعين غير متاحة حتى إعداد Supabase.",
    saveSuccess: "حُفظت المسودة.", submitSuccess: "أُرسل الطلب للمراجعة.", invalid: "تحقق من البيانات وأرفق إثبات عنوان صالحاً.",
    failed: "تعذر حفظ الطلب. حاول مرة أخرى.", draft: "مسودة", submitted: "قيد المراجعة", rejected: "مطلوب تعديل", approved: "مقبول",
    locked: "أُرسل الطلب ولا يمكن تعديله أثناء المراجعة.", reason: "ملاحظة المراجعة", required: "يجب إرفاق إثبات العنوان قبل الإرسال.",
  },
};

function localePath(value) { return value === "en" ? "en" : "ar"; }

export function meta() {
  return [{ title: "Seller application | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}

export async function loader({ params, context }) {
  const locale = localePath(params.locale);
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  if (!claims?.sub) return { locale, state: "signed-out", application: null };
  if (!supabase) return { locale, state: "unconfigured", application: null };
  const { data, error } = await supabase.from("seller_applications")
    .select("id, store_name_ar, store_name_en, contact, address, proof_path, status, rejection_reason, shop_id")
    .eq("applicant_user_id", claims.sub).maybeSingle();
  return { locale, state: error ? "unavailable" : "ready", application: error ? null : data };
}

export async function action({ request, params, context }) {
  const locale = localePath(params.locale);
  const supabase = context.get(supabaseAuthContext);
  const claims = context.get(supabaseClaimsContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase) return { error: "unconfigured" };
  if (!sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };

  let form;
  try { form = await request.formData(); } catch { return { error: "invalid" }; }
  const fields = validateSellerApplication(Object.fromEntries(["store_name_ar", "store_name_en", "contact", "address"].map((name) => [name, form.get(name)])));
  const intent = form.get("intent");
  if (!fields || !["save", "submit"].includes(intent)) return { error: "invalid" };

  const current = await supabase.from("seller_applications").select("id, status, proof_path")
    .eq("applicant_user_id", claims.sub).maybeSingle();
  if (current.error) return { error: "failed" };
  if (["submitted", "approved"].includes(current.data?.status)) return { error: "locked" };

  let applicationId = current.data?.id;
  if (applicationId) {
    const { error } = await supabase.from("seller_applications").update(fields).eq("id", applicationId);
    if (error) return { error: "failed" };
  } else {
    const { data, error } = await supabase.from("seller_applications").insert({ ...fields, applicant_user_id: claims.sub }).select("id").single();
    if (error || !data?.id) return { error: "failed" };
    applicationId = data.id;
  }

  const file = form.get("address_proof");
  if (file && typeof file !== "string" && file.size > 0) {
    const validated = await validateAddressProof(file);
    if (!validated) return { error: "invalid" };
    const path = `${applicationId}/${crypto.randomUUID()}.${validated.extension}`;
    const upload = await supabase.storage.from("seller-address-proofs").upload(path, file, {
      contentType: validated.contentType, cacheControl: "0", upsert: false,
    });
    if (upload.error) return { error: "failed" };
    const { error } = await supabase.from("seller_applications").update({ proof_path: path }).eq("id", applicationId);
    if (error) return { error: "failed" };
  }

  if (intent === "submit") {
    const { error } = await supabase.rpc("submit_seller_application", { p_application_id: applicationId });
    if (error) return { error: error.message?.includes("valid address proof") ? "proof-required" : "failed" };
    return { success: "submitted" };
  }
  return { success: "saved" };
}

export default function SellerApplicationRoute() {
  const { locale, state, application } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const pendingIntent = navigation.state !== "idle" ? navigation.formData?.get("intent") : null;
  const pending = pendingIntent === "save" || pendingIntent === "submit";
  const text = copy[locale];
  const rtl = locale === "ar";
  const editable = !application || ["draft", "rejected"].includes(application.status);
  const message = actionData?.success ? actionData.success === "submitted" ? text.submitSuccess : text.saveSuccess
    : actionData?.error === "proof-required" ? text.required
      : actionData?.error ? actionData.error === "sign-in" ? text.signIn : actionData.error === "unconfigured" ? text.unconfigured : actionData.error === "locked" ? text.locked : actionData.error === "invalid" ? text.invalid : text.failed : null;

  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{text.back}</Link>
    <section className="account-card seller-application-card">
      <p className="eyebrow">BNAFSAJI SELLERS</p><h1>{text.title}</h1><p>{text.intro}</p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{text.signIn}</Link></p>
        : state === "unconfigured" ? <p role="status">{text.unconfigured}</p>
          : state === "unavailable" ? <p role="status">{text.failed}</p>
            : <>
              {application && <p role="status"><strong>{text[application.status]}</strong>{application.status === "approved" && <> · <Link to={`/${locale}/seller/products`}>{locale === "ar" ? "إدارة المنتجات" : "Manage products"}</Link> · <Link to={`/${locale}/seller/staff`}>{locale === "ar" ? "إدارة فريق المتجر" : "Manage shop staff"}</Link></>}</p>}
              {application?.rejection_reason && <p>{text.reason}: <bdi dir="auto">{application.rejection_reason}</bdi></p>}
              {application?.status === "submitted" ? <p>{text.locked}</p> : <Form method="post" encType="multipart/form-data" className="account-form" aria-busy={pending}>
                <label>{text.storeAr}<input name="store_name_ar" defaultValue={application?.store_name_ar ?? ""} required maxLength={120} dir="rtl" disabled={!editable} /></label>
                <label>{text.storeEn}<input name="store_name_en" defaultValue={application?.store_name_en ?? ""} required maxLength={120} dir="ltr" disabled={!editable} /></label>
                <label>{text.contact}<input name="contact" defaultValue={application?.contact ?? ""} required maxLength={160} disabled={!editable} /></label>
                <label>{text.address}<textarea name="address" defaultValue={application?.address ?? ""} required maxLength={1000} disabled={!editable} /></label>
                <label>{text.proof}<input type="file" name="address_proof" accept="application/pdf,image/jpeg,image/png" disabled={!editable} /></label>
                <p>{text.private}</p>
                <div className="account-buttons"><button className="button button-secondary" name="intent" value="save" disabled={!editable || pending}>{text.save}</button><button className="button button-primary" name="intent" value="submit" disabled={!editable || pending}>{text.submit}</button></div>
                {pending && <p role="status">{locale === "ar" ? "جارٍ حفظ الطلب…" : "Saving application…"}</p>}
              </Form>}
            </>}
      {message && <p className="account-message" role="status">{message}</p>}
    </section>
  </main>;
}
