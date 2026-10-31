import { Form, Link, useActionData, useLoaderData } from "react-router";
export { action, loader } from "../lib/account.server.js";

const copy = {
  en: {
    addresses: "Manage saved addresses",
    title: "Your account", email: "Email", password: "Password", signIn: "Sign in", create: "Create account",
    google: "Continue with Google", apple: "Continue with Apple", signOut: "Sign out", busy: "Authentication is not configured yet.",
    success: "Account created. If email confirmation is enabled, check your inbox before signing in.", error: "We could not complete that request. Check your details and try again.",
    signedIn: "Signed in as", phone: "Verify your phone before checkout. Email verification is optional.", back: "Back to shopping",
    resetLabel: "Send password reset email", resetSent: "If the address belongs to an account, a password reset email will arrive shortly.",
  },
  ar: {
    addresses: "إدارة العناوين المحفوظة",
    title: "حسابك", email: "البريد الإلكتروني", password: "كلمة المرور", signIn: "تسجيل الدخول", create: "إنشاء حساب",
    google: "المتابعة باستخدام Google", apple: "المتابعة باستخدام Apple", signOut: "تسجيل الخروج", busy: "إعداد تسجيل الدخول غير مكتمل بعد.",
    success: "أُنشئ الحساب. إذا كان تأكيد البريد مفعّلًا، فتحقق من بريدك قبل تسجيل الدخول.", error: "تعذر إكمال الطلب. تحقق من البيانات وحاول مجددًا.",
    signedIn: "تم تسجيل الدخول باسم", phone: "يجب تأكيد رقم الهاتف قبل إتمام الشراء. تأكيد البريد اختياري.", back: "العودة إلى التسوق",
    resetLabel: "إرسال رسالة إعادة تعيين كلمة المرور", resetSent: "إذا كان البريد مرتبطًا بحساب، فستصلك رسالة لإعادة تعيين كلمة المرور قريبًا.",
  },
};

const SELLER_COPY = {
  en: { area: "Seller setup", start: "Start a seller application", continue: "Continue your application", status: "View application status", workspace: "Open seller workspace", unavailable: "Seller setup status could not be loaded." },
  ar: {
    area: "\u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0645\u062a\u062c\u0631",
    start: "\u0627\u0628\u062f\u0623 \u0637\u0644\u0628 \u0627\u0644\u0628\u064a\u0639",
    continue: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628",
    status: "\u0639\u0631\u0636 \u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628",
    workspace: "\u0641\u062a\u062d \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0628\u0627\u0626\u0639",
    unavailable: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u062d\u0627\u0644\u0629 \u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0645\u062a\u062c\u0631.",
  },
};

export default function AccountRoute() {
  const { locale, configured, oauthConfigured, email, sellerSetup } = useLoaderData();
  const actionData = useActionData();
  const text = copy[locale];
  const rtl = locale === "ar";
  const message = actionData?.success ? actionData.success === "reset-requested" ? text.resetSent : text.success : actionData?.error ? actionData.error === "unconfigured" ? text.busy : text.error : null;

  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{text.back}</Link>
    <section className="account-card">
      <p className="eyebrow">BNAFSAJI</p><h1>{text.title}</h1>
      {!configured && <p className="account-message" role="status">{text.busy}</p>}
      {email && <p><Link to={`/${locale}/account/addresses`}>{text.addresses}</Link></p>}
      {email ? <><p>{text.signedIn} <strong>{email}</strong></p><p>{text.phone}</p><h2>{SELLER_COPY[locale].area}</h2>{sellerSetup?.state === "unavailable" ? <p role="status">{SELLER_COPY[locale].unavailable}</p> : sellerSetup && <p><Link to={`/${locale}${sellerSetup.status === "approved" ? "/seller" : "/seller/apply"}`}>{sellerSetup.status === "approved" ? SELLER_COPY[locale].workspace : sellerSetup.status === "submitted" ? SELLER_COPY[locale].status : sellerSetup.status === "draft" || sellerSetup.status === "rejected" ? SELLER_COPY[locale].continue : SELLER_COPY[locale].start}</Link></p>}<Form method="post"><button className="button button-primary" name="intent" value="sign-out">{text.signOut}</button></Form></> : configured ? <>
        <Form method="post" className="account-form">
          <label>{text.email}<input type="email" name="email" autoComplete="email" required maxLength={254} /></label>
          <label>{text.password}<input type="password" name="password" autoComplete="current-password" required minLength={8} maxLength={128} /></label>
          <div className="account-buttons"><button className="button button-primary" name="intent" value="sign-in" disabled={!configured}>{text.signIn}</button><button className="button button-secondary" name="intent" value="sign-up" disabled={!configured}>{text.create}</button></div>
        </Form>
        <Form method="post" className="account-form"><label>{text.email}<input type="email" name="email" autoComplete="email" required maxLength={254} /></label><button className="button button-secondary" name="intent" value="request-reset" disabled={!configured}>{text.resetLabel}</button></Form>
        <div className="account-oauth"><Form method="post"><input type="hidden" name="provider" value="google" /><button className="button button-secondary" name="intent" value="oauth" disabled={!configured || !oauthConfigured}>{text.google}</button></Form><Form method="post"><input type="hidden" name="provider" value="apple" /><button className="button button-secondary" name="intent" value="oauth" disabled={!configured || !oauthConfigured}>{text.apple}</button></Form></div>
      </> : null}
      {message && <p className="account-message" role="status">{message}</p>}
    </section>
  </main>;
}
