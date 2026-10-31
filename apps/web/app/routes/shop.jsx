import { Link, useLoaderData } from "react-router";
import { formatJod, localizedSeoLinks, normalizeLocale, productHref, shopHref } from "../lib/catalog";
import { loadShop } from "../lib/catalog.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";
import { CartLink } from "../components/cart-controls.jsx";
import { WishlistButton, WishlistLink } from "../components/wishlist-controls.jsx";

export async function loader({ context, params, request }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const value = new URL(request.url).searchParams.get("page");
  const requestedPage = value && /^\d+$/.test(value) ? Number(value) : 1;
  const page = Number.isSafeInteger(requestedPage) ? requestedPage : 1;
  const env = context.get(cloudflareContext).env;
  const showcase = import.meta.env?.MODE === "development" && new URL(request.url).searchParams.get("showcase") === "1";
  if (showcase) {
    const demo = await import("../lib/showcase-data.js");
    return { locale, siteUrl: env.PUBLIC_SITE_URL, showcase, result: demo.loadShowcaseShop(params.slug, page) };
  }
  return { locale, siteUrl: env.PUBLIC_SITE_URL, showcase, result: await loadShop(env, params.slug, page) };
}

export function meta({ loaderData }) {
  const result = loaderData?.result;
  const locale = loaderData?.locale ?? "ar";
  const shop = result?.shop;
  const name = shop ? (locale === "ar" ? shop.name_ar : shop.name_en || shop.name_ar) : "BNAFSAJI";
  const canonicalPath = shop ? `${shopHref("ar", shop.slug).slice(3)}${result.page > 1 ? `?page=${result.page}` : ""}` : null;
  const seoLinks = result?.state === "ready" && !result.isShowcase ? localizedSeoLinks(loaderData.siteUrl, canonicalPath, locale) : [];
  return [
    { title: `${name} | BNAFSAJI` },
    { name: "description", content: ((locale === "ar" ? shop?.description_ar || shop?.description_en : shop?.description_en || shop?.description_ar) || (locale === "ar" ? `\u0645\u0646\u062a\u062c\u0627\u062a ${name} \u0639\u0644\u0649 \u0628\u0646\u0641\u0633\u062c\u064a.` : `Products from ${name} on BNAFSAJI.`)).slice(0, 300) },
    { name: "robots", content: seoLinks.length ? "index,follow" : "noindex,follow" },
    ...seoLinks,
  ];
}

function ShopProductCard({ product, shop, locale, text }) {
  const rtl = locale === "ar";
  const title = rtl ? product.title_ar : product.title_en || product.title_ar;
  const baseLink = productHref(locale, shop.slug, product.slug);
  const link = product.sample ? `${baseLink}?showcase=1` : baseLink;
  return <article className="product-card"><div className="product-art"><Link className="product-image-link" to={link} aria-label={title}>{product.images?.[0]?.src ? <img src={product.images[0].src} alt={title} width="640" height="640" loading="lazy" decoding="async" /> : <span>{text.noPhoto}</span>}</Link>{product.sample && <span className="sample-product-badge">{locale === "ar" ? "\u0639\u064a\u0646\u0629" : "Sample"}</span>}</div><div className="product-info"><h2><Link to={link}>{title}</Link></h2><div className="product-row"><strong>{formatJod(product.price_fils, locale)}</strong><Link className="product-link" to={link} aria-label={`${text.view}: ${title}`}>↗</Link></div>{!product.sample && <WishlistButton productId={product.id} locale={locale} />}<Link className="button button-secondary" to={link}>{text.view}</Link></div></article>;
}

export default function ShopRoute() {
  const { locale, result, showcase } = useLoaderData();
  const rtl = locale === "ar";
  const text = rtl ? {
    brand: "\u0628\u0646\u0641\u0633\u062c\u064a", cart: "\u0627\u0644\u0633\u0644\u0629", language: "EN", back: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u062a\u0633\u0648\u0642", products: "\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0645\u062a\u062c\u0631",
    noPhoto: "\u0644\u0645 \u062a\u0636\u0641 \u0635\u0648\u0631\u0629 \u0644\u0644\u0645\u0646\u062a\u062c \u0628\u0639\u062f", view: "\u0639\u0631\u0636 \u0627\u0644\u0645\u0646\u062a\u062c", add: "\u0623\u0636\u0641 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629", added: "\u0623\u0636\u064a\u0641 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629",
    limit: "\u0648\u0635\u0644\u062a \u0627\u0644\u0633\u0644\u0629 \u0625\u0644\u0649 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 (100 \u0645\u0646\u062a\u062c)", empty: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u0645\u0646\u0634\u0648\u0631\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0645\u062a\u062c\u0631 \u0628\u0639\u062f",
    setup: "\u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u062a\u062c\u0631 \u0642\u064a\u062f \u0627\u0644\u0625\u0639\u062f\u0627\u062f", unavailable: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u062a\u062c\u0631", missing: "\u0647\u0630\u0627 \u0627\u0644\u0645\u062a\u062c\u0631 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d", previous: "\u0627\u0644\u0633\u0627\u0628\u0642", next: "\u0627\u0644\u062a\u0627\u0644\u064a",
  } : {
    brand: "BNAFSAJI", cart: "Cart", language: "\u0639\u0631\u0628\u064a", back: "Continue shopping", products: "Shop products",
    noPhoto: "No product photo has been added yet", view: "View product", add: "Add to cart", added: "Added to cart",
    limit: "Cart limit reached (100 items)", empty: "This shop has no published products yet", setup: "Shop page setup in progress", unavailable: "Shop could not be loaded", missing: "This shop is unavailable", previous: "Previous", next: "Next",
  };
  const { shop, products, total, page, state } = result;
  const shopName = shop ? (rtl ? shop.name_ar : shop.name_en || shop.name_ar) : "";
  const languageParams = new URLSearchParams();
  if (page > 1) languageParams.set("page", String(page));
  if (showcase) languageParams.set("showcase", "1");
  const languageHref = shop ? `${shopHref(rtl ? "en" : "ar", shop.slug)}${languageParams.size ? `?${languageParams}` : ""}` : `/${rtl ? "en" : "ar"}`;
  const pageCount = Math.ceil(total / 24);
  const pageHref = (nextPage) => `${shopHref(locale, shop.slug)}?page=${nextPage}`;

  return <div className="site-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    {showcase && <div className="showcase-notice" role="note"><strong>{rtl ? "\u0645\u062a\u062c\u0631 \u0627\u0641\u062a\u0631\u0627\u0636\u064a \u00b7 \u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062d\u0644\u064a\u0629" : "Sample shop · Local preview"}</strong><span>{rtl ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0623\u0648 \u0639\u0645\u0644\u064a\u0627\u062a \u0634\u0631\u0627\u0621 \u062d\u0642\u064a\u0642\u064a\u0629." : "This page has no real orders or purchases."}</span></div>}
    <header className="site-header shop-header">
      <Link className="wordmark" to={`/${locale}`} aria-label={text.brand}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>{text.brand}</span></Link>
      <nav className="header-actions" aria-label={rtl ? "التنقل" : "Navigation"}><WishlistLink locale={locale} /><CartLink locale={locale} text={text.cart} /><Link className="language-link" to={languageHref} lang={rtl ? "en" : "ar"}>{text.language}</Link></nav>
    </header>
    <main className="main-content">
      {state === "ready" ? <>
        <nav className="category-nav"><Link className="category-pill" to={`/${locale}${showcase ? "?showcase=1" : ""}`}>{text.back}</Link></nav>
        <section className="catalog-heading"><div><p className="eyebrow">{text.products}</p><h1>{shopName}</h1>{(rtl ? shop.description_ar || shop.description_en : shop.description_en || shop.description_ar) && <p className="catalog-subtitle shop-description">{rtl ? shop.description_ar || shop.description_en : shop.description_en || shop.description_ar}</p>}</div></section>
        {products.length ? <section className="product-grid" aria-label={text.products}>{products.map((product) => <ShopProductCard key={product.id} product={product} shop={shop} locale={locale} text={text} />)}</section> : <section className="catalog-state"><h2>{text.empty}</h2></section>}
        {pageCount > 1 && <nav className="pagination" aria-label={rtl ? "صفحات المنتجات" : "Product pages"}>{page > 1 && <Link className="page-link" to={pageHref(page - 1)}>{text.previous}</Link>}<span>{page} / {pageCount}</span>{page < pageCount && <Link className="page-link" to={pageHref(page + 1)}>{text.next}</Link>}</nav>}
      </> : <section className="catalog-state"><h1>{state === "unconfigured" ? text.setup : state === "missing" ? text.missing : text.unavailable}</h1><Link className="button button-primary" to={`/${locale}`}>{text.back}</Link></section>}
    </main>
    <footer className="site-footer"><Link className="wordmark footer-brand" to={`/${locale}`}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>{text.brand}</span></Link><span>© {new Date().getFullYear()} BNAFSAJI</span></footer>
  </div>;
}
