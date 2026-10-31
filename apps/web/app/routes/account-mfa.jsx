import { useEffect, useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { sameOriginPost, safeMfaReturnTo } from "../lib/auth-config.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";

const copy = {
  en: { title: "Administrator two-step verification", intro: "Platform administration requires a second verification step. Set up an authenticator app or enter its current code.", signIn: "Sign in first to continue.", setup: "Set up authenticator", enroll: "Create authenticator setup", code: "Six-digit code", verify: "Verify code", challenge: "Verify administrator access", secret: "Authenticator setup key", busy: "Authentication is not configured.", failed: "We could not verify that code. Try again.", back: "Back to account", ready: "Administrator verification is complete." },
  ar: { title: "التحقق بخطوتين للمسؤول", intro: "تتطلب إدارة المنصة خطوة تحقق إضافية. أعد تطبيق المصادقة أو أدخل الرمز الحالي.", signIn: "سجّل الدخول أولاً للمتابعة.", setup: "إعداد تطبيق المصادقة", enroll: "بدء إعداد المصادقة", code: "الرمز المكوّن من ستة أرقام", verify: "التحقق من الرمز", challenge: "التحقق من صلاحية المسؤول", secret: "مفتاح إعداد تطبيق المصادقة", busy: "إعداد المصادقة غير متاح.", failed: "تعذر التحقق من الرمز. حاول مرة أخرى.", back: "العودة إلى الحساب", ready: "اكتمل التحقق بخطوتين." },
};

function localePath(value) { return value === "en" ? "en" : "ar"; }

export function meta() {
  return [{ title: "Account security | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}

export async function loader({ request, params, context }) {
  const locale = localePath(params.locale);
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const returnTo = safeMfaReturnTo(new URL(request.url).searchParams.get("returnTo"), locale);
  if (!claims?.sub) return { locale, state: "signed-out", returnTo, factors: [], currentLevel: null, nextLevel: null };
  if (!supabase) return { locale, state: "unconfigured", returnTo, factors: [], currentLevel: null, nextLevel: null };
  try {
    const [{ data: aal, error: aalError }, { data: factorData, error: factorError }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    if (aalError || factorError) return { locale, state: "unavailable", returnTo, factors: [], currentLevel: null, nextLevel: null };
    const factors = (factorData?.all ?? []).filter((factor) => factor.factor_type === "totp" && factor.status === "verified");
    return { locale, state: aal?.currentLevel === "aal2" ? "verified" : "ready", returnTo, factors, currentLevel: aal?.currentLevel ?? "aal1", nextLevel: aal?.nextLevel ?? "aal1" };
  } catch {
    return { locale, state: "unavailable", returnTo, factors: [], currentLevel: null, nextLevel: null };
  }
}

export async function action({ request, params, context }) {
  const locale = localePath(params.locale);
  const supabase = context.get(supabaseAuthContext);
  const claims = context.get(supabaseClaimsContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return { error: "sign-in" };
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return { error: "failed" };
  const form = await request.formData();
  const intent = form.get("intent");
  const returnTo = safeMfaReturnTo(form.get("return_to"), locale);

  if (intent === "enroll") {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Bnafsaji platform administration" });
      if (error || !data?.id || !data?.totp?.secret) return { error: "failed" };
      return { enrollment: { factorId: data.id, secret: data.totp.secret, returnTo } };
    } catch {
      return { error: "failed" };
    }
  }

  const factorId = form.get("factor_id");
  const code = form.get("code");
  if ((intent !== "verify-enrollment" && intent !== "challenge") || typeof factorId !== "string"
      || !/^[0-9a-f-]{36}$/i.test(factorId) || typeof code !== "string" || !/^\d{6,8}$/.test(code)) return { error: "failed" };
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) return { error: "failed" };
    return redirect(returnTo, { status: 303, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return { error: "failed" };
  }
}

export default function AccountMfaRoute() {
  const { locale, state, returnTo, factors } = useLoaderData();
  const actionData = useActionData();
  const [enrollment, setEnrollment] = useState(null);
  const busy = useNavigation().state !== "idle";
  useEffect(() => {
    if (actionData?.enrollment) setEnrollment(actionData.enrollment);
  }, [actionData?.enrollment]);
  const text = copy[locale];
  const rtl = locale === "ar";
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}/account`} className="account-back">{text.back}</Link>
    <section className="account-card"><p className="eyebrow">BNAFSAJI SECURITY</p><h1>{text.title}</h1><p>{text.intro}</p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{text.signIn}</Link></p> : state === "unconfigured" || state === "unavailable" ? <p role="status">{text.busy}</p> : state === "verified" ? <p role="status">{text.ready} <Link to={returnTo}>{text.back}</Link></p> : enrollment ? <Form method="post" className="account-form" aria-busy={busy}>
        <input type="hidden" name="factor_id" value={enrollment.factorId} /><input type="hidden" name="return_to" value={enrollment.returnTo} />
        <p>{text.setup}</p><label>{text.secret}<input readOnly value={enrollment.secret} dir="ltr" autoComplete="off" /></label>
        <label>{text.code}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required maxLength={8} /></label>
        <button className="button button-primary" name="intent" value="verify-enrollment" disabled={busy}>{text.verify}</button>
      </Form> : factors.length ? <Form method="post" className="account-form">
        <input type="hidden" name="return_to" value={returnTo} /><label>{text.code}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required maxLength={8} /></label>
        <label className={factors.length > 1 ? undefined : "visually-hidden"}><span>{rtl ? "تطبيق المصادقة" : "Authenticator"}</span><select name="factor_id" required defaultValue={factors[0].id}>{factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendly_name || (rtl ? "تطبيق المصادقة" : "Authenticator")}</option>)}</select></label>
        <button className="button button-primary" name="intent" value="challenge" disabled={busy}>{text.challenge}</button>
      </Form> : <Form method="post"><input type="hidden" name="return_to" value={returnTo} /><button className="button button-primary" name="intent" value="enroll" disabled={busy}>{text.enroll}</button></Form>}
      {actionData?.error && <p className="account-message" role="alert">{actionData.error === "sign-in" ? text.signIn : text.failed}</p>}
    </section>
  </main>;
}
