import { useEffect } from "react";
import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation, useRouteLoaderData } from "react-router";
import appStyles from "./app.css?url";
import catalogStyles from "./catalog.css?url";
import showcaseStyles from "./showcase.css?url";
import { supabaseAuthMiddleware } from "./lib/auth.server";
import { supabaseClaimsContext } from "./lib/auth-context.server";
import { CartProvider, useCart } from "./components/cart-provider.jsx";
import { WishlistProvider } from "./components/wishlist-provider.jsx";

export const middleware = [supabaseAuthMiddleware];

export function links() {
  return [
    { rel: "stylesheet", href: appStyles },
    { rel: "stylesheet", href: catalogStyles },
    { rel: "stylesheet", href: showcaseStyles },
  ];
}

export function Layout({ children }) {
  const locale = useRouteLoaderData("root")?.locale ?? "ar";
  return <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#080912" /><meta name="apple-mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-title" content="Bnafsaji" /><link rel="icon" type="image/svg+xml" href="/bnafsaji.svg" /><link rel="apple-touch-icon" href="/icon-180.png" /><link rel="manifest" href="/manifest.webmanifest" /><Meta /><Links nonce="" /></head><body>{children}<ScrollRestoration /><Scripts /></body></html>;
}

export function loader({ request, context }) {
  const pathname = new URL(request.url).pathname;
  const candidate = pathname.split("/")[1].replace(/\.data$/, "");
  if (candidate && candidate !== "ar" && candidate !== "en" && pathname !== "/auth/callback" && pathname !== "/auth/callback.data") {
    throw new Response("Not found", { status: 404 });
  }
  return { locale: candidate === "en" ? "en" : "ar", accountUserId: context.get(supabaseClaimsContext)?.sub ?? null };
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

function MobileBottomNavigation({ locale, pathname }) {
  const { itemCount, ready } = useCart();
  const nav = locale === "ar"
    ? [["⌂", "الرئيسية", `/${locale}`, pathname === `/${locale}`], ["▦", "الأقسام", `/${locale}#categories`, false], ["♡", "المفضلة", `/${locale}/wishlist`, pathname === `/${locale}/wishlist`], ["▣", "السلة", `/${locale}/cart`, pathname === `/${locale}/cart`], ["♙", "حسابي", `/${locale}/account`, pathname.startsWith(`/${locale}/account`)]]
    : [["⌂", "Home", `/${locale}`, pathname === `/${locale}`], ["▦", "Categories", `/${locale}#categories`, false], ["♡", "Saved", `/${locale}/wishlist`, pathname === `/${locale}/wishlist`], ["▣", "Cart", `/${locale}/cart`, pathname === `/${locale}/cart`], ["♙", "Account", `/${locale}/account`, pathname.startsWith(`/${locale}/account`)]];
  return <nav className="mobile-bottom-nav" aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>{nav.map(([icon, label, href, current]) => <Link key={label} to={href} aria-current={current ? "page" : undefined}><span aria-hidden="true">{icon}{label === (locale === "ar" ? "السلة" : "Cart") && ready && itemCount > 0 && <small className="mobile-cart-count">{new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-JO").format(itemCount)}</small>}</span>{label}</Link>)}</nav>;
}

export default function App() {
  const { locale, accountUserId } = useRouteLoaderData("root");
  const { pathname } = useLocation();
  const inWorkspace = ["seller", "admin", "owner"].some((section) => pathname === `/${locale}/${section}` || pathname.startsWith(`/${locale}/${section}/`));
  return <CartProvider><WishlistProvider userId={accountUserId} locale={locale}><Outlet />{!inWorkspace && <MobileBottomNavigation locale={locale} pathname={pathname} />}</WishlistProvider><ServiceWorkerRegistration /></CartProvider>;
}

export function ErrorBoundary({ error }) {
  const locale = useRouteLoaderData("root")?.locale ?? "ar";
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const text = locale === "en"
    ? {
        401: ["Sign in required", "Sign in to continue to this page."],
        403: ["You do not have access", "Return to the marketplace or use an account with the required access."],
        404: ["Page not found", "Check the address or return to the marketplace."],
        500: ["Something went wrong", "Try this page again. If the problem continues, return to the marketplace."],
        home: "Back to shopping", signIn: "Sign in", retry: "Try again", language: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
      }
    : {
        401: ["\u064a\u0644\u0632\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644", "\u0633\u062c\u0651\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0625\u0644\u0649 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629."],
        403: ["\u0644\u064a\u0633 \u0644\u062f\u064a\u0643 \u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0648\u0635\u0648\u0644", "\u0639\u062f \u0625\u0644\u0649 \u0627\u0644\u0633\u0648\u0642 \u0623\u0648 \u0627\u0633\u062a\u062e\u062f\u0645 \u062d\u0633\u0627\u0628\u0627\u064b \u064a\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629."],
        404: ["\u0627\u0644\u0635\u0641\u062d\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629", "\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0627\u0628\u0637 \u0623\u0648 \u0639\u062f \u0625\u0644\u0649 \u0627\u0644\u0633\u0648\u0642."],
        500: ["\u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639", "\u062d\u0627\u0648\u0644 \u0641\u062a\u062d \u0627\u0644\u0635\u0641\u062d\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649. \u0625\u0630\u0627 \u0627\u0633\u062a\u0645\u0631\u062a \u0627\u0644\u0645\u0634\u0643\u0644\u0629\u060c \u0639\u062f \u0625\u0644\u0649 \u0627\u0644\u0633\u0648\u0642."],
        home: "\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u062a\u0633\u0648\u0642", signIn: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644", retry: "\u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u062c\u062f\u062f\u0627\u064b", language: "EN",
      };
  const content = text[status] ?? text[500];
  const home = `/${locale}`;
  return <main className="system-error" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
    <a className="wordmark" href={home}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>BNAFSAJI</span></a>
    <h1>{content[0]}</h1>
    <p>{content[1]}</p>
    <div className="hero-actions">
      {status === 401 && <a className="button button-primary" href={`/${locale}/account`}>{text.signIn}</a>}
      {status >= 500 && <button className="button button-primary" type="button" onClick={() => window.location.reload()}>{text.retry}</button>}
      <a className={status === 404 || status === 403 ? "button button-primary" : "button button-secondary"} href={home}>{text.home}</a>
      <a className="language-link" href={`/${locale === "ar" ? "en" : "ar"}`}>{text.language}</a>
    </div>
  </main>;
}
