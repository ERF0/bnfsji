import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import { sameOriginPost } from "../lib/auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";

const copy = {
  en: { title: "Choose a new password", password: "New password", confirm: "Confirm password", submit: "Save password", back: "Back to shopping", error: "We could not update your password. Please request a new reset link.", mismatch: "Passwords do not match.", length: "Use a password between 8 and 128 characters." },
  ar: { title: "اختر كلمة مرور جديدة", password: "كلمة المرور الجديدة", confirm: "تأكيد كلمة المرور", submit: "حفظ كلمة المرور", back: "العودة إلى التسوق", error: "تعذر تحديث كلمة المرور. اطلب رابط إعادة تعيين جديدًا.", mismatch: "كلمتا المرور غير متطابقتين.", length: "استخدم كلمة مرور من 8 إلى 128 حرفًا." },
};

export async function loader({ params, context }) {
  const locale = params.locale === "en" ? "en" : "ar";
  if (!context.get(supabaseClaimsContext)?.sub) return redirect(`/${locale}/account`);
  return { locale };
}

export async function action({ request, params, context }) {
  const locale = params.locale === "en" ? "en" : "ar";
  const env = context.get(cloudflareContext)?.env;
  const supabase = context.get(supabaseAuthContext);
  if (!supabase || !context.get(supabaseClaimsContext)?.sub) return redirect(`/${locale}/account`);
  if (!sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  const form = await request.formData();
  const password = form.get("password");
  const confirmation = form.get("confirmation");
  if (typeof password !== "string" || typeof confirmation !== "string" || password.length < 8 || password.length > 128) return { error: "length" };
  if (password !== confirmation) return { error: "mismatch" };
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "failed" };
  } catch {
    return { error: "failed" };
  }
  return redirect(`/${locale}/account`, { headers: { "Cache-Control": "private, no-store" } });
}

export default function PasswordResetRoute() {
  const { locale } = useLoaderData();
  const actionData = useActionData();
  const text = copy[locale];
  const rtl = locale === "ar";
  const message = actionData?.error === "mismatch" ? text.mismatch : actionData?.error === "length" ? text.length : actionData?.error ? text.error : null;
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}><Link to={`/${locale}`} className="account-back">{text.back}</Link><section className="account-card"><p className="eyebrow">BNAFSAJI</p><h1>{text.title}</h1><Form method="post" className="account-form"><label>{text.password}<input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label><label>{text.confirm}<input type="password" name="confirmation" autoComplete="new-password" required minLength={8} maxLength={128} /></label><button className="button button-primary">{text.submit}</button></Form>{message && <p className="account-message" role="alert">{message}</p>}</section></main>;
}
