import { Link, useLoaderData } from "react-router";
import { useEffect, useState } from "react";
import { formatJod, localizedSeoLinks, normalizeLocale, productHref, shopHref } from "../lib/catalog";
import { loadCatalog, loadProduct } from "../lib/catalog.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";
import { AddToCartButton, CartLink } from "../components/cart-controls.jsx";
import { WishlistButton, WishlistLink } from "../components/wishlist-controls.jsx";

function RecentlyViewed({ locale, currentProductId }) {
  const rtl = locale === "ar";
  const [state, setState] = useState("loading");
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    const key = "bnafsaji-recently-viewed-v1";
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let ids = [];
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(saved)) ids = saved.filter((id) => typeof id === "string" && uuid.test(id)).slice(0, 8);
      ids = [currentProductId, ...ids.filter((id) => id !== currentProductId)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      if (active) setState("unavailable");
      return () => { active = false; };
    }
    const recentIds = ids.filter((id) => id !== currentProductId);
    if (!recentIds.length) {
      setState("empty");
      return () => { active = false; };
    }

    fetch(`/${locale}/cart/items?ids=${encodeURIComponent(recentIds.join(","))}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("unavailable")))
      .then((result) => {
        if (!active) return;
        if (result.state !== "ready") throw new Error("unavailable");
        const byId = new Map((result.products ?? []).map((product) => [product.id, product]));
        setProducts(recentIds.map((id) => byId.get(id)).filter(Boolean));
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, [currentProductId, locale]);

  if (state === "empty") return null;
  return <section className="recently-viewed" aria-labelledby="recently-viewed-title">
    <div className="recently-viewed-heading"><div><p className="eyebrow">{rtl ? "تابع من حيث وصلت" : "Pick up where you left off"}</p><h2 id="recently-viewed-title">{rtl ? "شاهدتها مؤخراً" : "Recently viewed"}</h2></div><Link to={`/${locale}`}>{rtl ? "اكتشف المزيد" : "Keep exploring"}</Link></div>
    {state === "loading" ? <p role="status">{rtl ? "جارٍ تحميل المنتجات…" : "Loading products…"}</p> : state === "unavailable" ? <p role="status">{rtl ? "تعذر تحميل المنتجات التي شاهدتها مؤخراً." : "Recently viewed items could not be loaded."}</p> : products.length === 0 ? <p role="status">{rtl ? "لم تعد المنتجات التي شاهدتها متاحة." : "The products you viewed are no longer available."}</p> : <div className="recently-viewed-strip">{products.map((item) => <Link className="recently-viewed-card" key={item.id} to={productHref(locale, item.shops.slug, item.slug)}>
      {item.images?.[0]?.src ? <img src={item.images[0].src} alt="" width="160" height="200" loading="lazy" /> : <span className="recently-viewed-placeholder" aria-hidden="true">B</span>}
      <span className="recently-viewed-card-copy"><small>{rtl ? item.shops.name_ar : item.shops.name_en || item.shops.name_ar}</small><strong>{rtl ? item.title_ar : item.title_en || item.title_ar}</strong></span>
    </Link>)}</div>}
  </section>;
}

function RelatedProducts({ locale, category, products, showcase }) {
  if (!products.length) return null;
  const rtl = locale === "ar";
  return <section className="recently-viewed" aria-labelledby="related-products-title">
    <div className="recently-viewed-heading"><div><p className="eyebrow">{rtl ? "اكتشف المزيد" : "Keep exploring"}</p><h2 id="related-products-title">{rtl ? `المزيد من ${category.name_ar}` : `More in ${category.name_en || category.name_ar}`}</h2></div><Link to={`/${locale}/c/${category.slug}${showcase ? "?showcase=1" : ""}`}>{rtl ? "عرض الفئة" : "View category"}</Link></div>
    <div className="recently-viewed-strip">{products.map((item) => <Link className="recently-viewed-card" key={item.product_id ?? item.id} to={`${productHref(locale, item.shop_slug, item.product_slug ?? item.slug)}${showcase ? "?showcase=1" : ""}`}>
      {item.images?.[0]?.src ? <img src={item.images[0].src} alt="" width="160" height="200" loading="lazy" /> : <span className="recently-viewed-placeholder" aria-hidden="true">B</span>}
      <span className="recently-viewed-card-copy"><small>{rtl ? item.shop_name_ar : item.shop_name_en || item.shop_name_ar}</small><strong>{rtl ? item.title_ar : item.title_en || item.title_ar}</strong><span>{formatJod(item.price_fils, locale)}</span></span>
    </Link>)}</div>
  </section>;
}

export async function loader({ context, params, request }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const env = context.get(cloudflareContext).env;
  const showcase = import.meta.env?.MODE === "development" && new URL(request.url).searchParams.get("showcase") === "1";
  if (showcase) {
    const demo = await import("../lib/showcase-data.js");
    const product = demo.findShowcaseProduct(params.shopSlug, params.slug);
    const related = product ? demo.loadShowcaseCatalog({ category: product.categories.slug }).products.filter((item) => item.id !== product.id).slice(0, 4) : [];
    return { locale, siteUrl: env.PUBLIC_SITE_URL, result: product ? { state: "ready", isShowcase: true, product } : { state: "missing", product: null }, related };
  }
  const result = await loadProduct(env, params.shopSlug, params.slug);
  const relatedCatalog = result.product ? await loadCatalog(env, { category: result.product.categories.slug, signal: request.signal }) : null;
  const related = relatedCatalog?.state === "ready" ? relatedCatalog.products.filter((item) => item.product_id !== result.product.id).slice(0, 4) : [];
  return { locale, siteUrl: env.PUBLIC_SITE_URL, result, related };
}

export function meta({ loaderData }) {
  const product = loaderData?.result?.product;
  const locale = loaderData?.locale ?? "ar";
  const title = product ? (locale === "ar" ? product.title_ar || product.title_en : product.title_en || product.title_ar) : "BNAFSAJI";
  const description = product ? (locale === "ar" ? product.description_ar || product.description_en : product.description_en || product.description_ar) : "";
  const canonicalPath = product ? productHref("ar", product.shops.slug, product.slug).slice(3) : null;
  const seoLinks = product && !loaderData?.result?.isShowcase ? localizedSeoLinks(loaderData.siteUrl, canonicalPath, locale) : [];
  return [
    { title: `${title} | BNAFSAJI` },
    ...(description ? [{ name: "description", content: description.slice(0, 300) }] : []),
    { name: "robots", content: seoLinks.length ? "index,follow" : "noindex,follow" },
    ...seoLinks,
  ];
}

export default function ProductRoute() {
  const { locale, result, related } = useLoaderData();
  const rtl = locale === "ar";
  const product = result.product;
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const text = rtl ? { back: "\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u062a\u0633\u0648\u0642", setup: "\u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u062a\u062c\u0631 \u0642\u064a\u062f \u0627\u0644\u0625\u0639\u062f\u0627\u062f", missing: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c \u063a\u064a\u0631 \u0645\u062a\u0627\u062d.", error: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0646\u062a\u062c", category: "\u0627\u0644\u0641\u0626\u0629", noPhoto: "\u0644\u0645 \u062a\u0636\u0641 \u0635\u0648\u0631\u0629 \u0644\u0644\u0645\u0646\u062a\u062c \u0628\u0639\u062f", language: "EN", cart: "\u0627\u0644\u0633\u0644\u0629", add: "\u0623\u0636\u0641 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629", added: "\u0623\u0636\u064a\u0641 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629", limit: "\u0648\u0635\u0644\u062a \u0627\u0644\u0633\u0644\u0629 \u0625\u0644\u0649 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 (100 \u0645\u0646\u062a\u062c)", variant: "\u0627\u0644\u062e\u064a\u0627\u0631", afterOrder: "\u064a\u062c\u0647\u0632 \u0628\u0639\u062f \u0627\u0644\u0637\u0644\u0628", stocked: "\u0645\u062a\u0648\u0641\u0631 \u0628\u0627\u0644\u0645\u062e\u0632\u0648\u0646" } : { back: "Continue browsing", setup: "Storefront setup in progress", missing: "This product is unavailable.", error: "Product could not be loaded", category: "Category", noPhoto: "No product photo has been added yet", language: "\u0639\u0631\u0628\u064a", cart: "Cart", add: "Add to cart", added: "Added to cart", limit: "Cart limit reached (100 items)", variant: "Option", afterOrder: "Prepared after order", stocked: "In stock" };
  const variantPrompt = rtl ? "\u0627\u0644\u062e\u064a\u0627\u0631" : "Option";
  const languageHref = product ? `${productHref(rtl ? "en" : "ar", product.shops.slug, product.slug)}${result.isShowcase ? "?showcase=1" : ""}` : `/${rtl ? "en" : "ar"}`;
  const title = product ? (rtl ? product.title_ar : product.title_en) : "";
  const category = product ? (rtl ? product.categories.name_ar : product.categories.name_en) : "";
  const shop = product ? (rtl ? product.shops.name_ar : product.shops.name_en) : "";
  const description = product ? (rtl ? product.description_ar : product.description_en) : "";
  const variants = product?.product_variants ?? [];
  const images = product?.images ?? [];
  const variant = variants.find((item) => item.id === selectedVariantId) ?? variants[0] ?? null;
  const [selectedImageId, setSelectedImageId] = useState(null);
  const selectedImage = images.find((item) => item.id === selectedImageId) ?? images[0] ?? null;
  const supplyLabel = variant?.supply_mode === "stocked" ? (rtl ? "\u0645\u062a\u0648\u0641\u0631 \u0628\u0627\u0644\u0645\u062e\u0632\u0648\u0646" : "In stock") : (rtl ? "\u064a\u064f\u062c\u0647\u0651\u0632 \u0628\u0639\u062f \u0627\u0644\u0637\u0644\u0628" : "Prepared after order");
  const cartProduct = product && variant ? { product_id: product.id, variant_id: variant.id, option_values: variant.option_values, product_slug: product.slug, shop_slug: product.shops.slug, title_ar: product.title_ar, title_en: product.title_en, shop_name_ar: product.shops.name_ar, shop_name_en: product.shops.name_en } : null;
  const variantLabel = (item) => (Array.isArray(item.option_values) ? item.option_values : []).map((option) => `${rtl ? option.label_ar : option.label_en || option.label_ar}: ${rtl ? option.value_ar : option.value_en || option.value_ar}`).join(" / ") || (rtl ? "\u0627\u0644\u062e\u064a\u0627\u0631 \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a" : "Default option");
  return <main className="product-page" lang={locale} dir={rtl ? "rtl" : "ltr"}><header className="product-header"><Link className="wordmark" to={`/${locale}`}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>{rtl ? "بَنَفْسَجِي" : "BNAFSAJI"}</span></Link><nav className="header-actions"><WishlistLink locale={locale} /><CartLink locale={locale} text={text.cart} /><Link className="language-link" to={languageHref} lang={rtl ? "en" : "ar"}>{text.language}</Link></nav></header>{result.isShowcase && <div className="showcase-notice" role="note"><strong>{rtl ? "منتج افتراضي · معاينة محلية" : "Sample product · Local preview"}</strong><span>{rtl ? "الشراء معطل؛ هذا العنصر غير موجود في المخزون الحقيقي." : "Purchase is disabled; this item is not in live inventory."}</span></div>}{product ? <article className="product-detail"><section className="product-gallery" aria-label={rtl ? "\u0635\u0648\u0631 \u0627\u0644\u0645\u0646\u062a\u062c" : "Product photos"}><div className="product-art product-art-large">{selectedImage ? <img src={selectedImage.src} alt={`${title} ${rtl ? "\u0635\u0648\u0631\u0629" : "photo"} ${images.findIndex((item) => item.id === selectedImage.id) + 1}`} width="1600" height="1600" fetchPriority="high" decoding="async" /> : <span>{text.noPhoto}</span>}</div>{images.length > 1 && <div className="product-thumbnails">{images.map((image, index) => <button key={image.id} type="button" aria-label={`${rtl ? "\u0635\u0648\u0631\u0629" : "Photo"} ${index + 1}`} aria-pressed={selectedImage?.id === image.id} onClick={() => setSelectedImageId(image.id)}><img src={image.src} alt="" width="88" height="88" loading="lazy" /></button>)}</div>}</section><div><p className="eyebrow">{text.category}: {category}</p><h1>{title}</h1><p className="product-shop"><Link to={`${shopHref(locale, product.shops.slug)}${result.isShowcase ? "?showcase=1" : ""}`}>{shop}</Link></p>{variants.length > 1 && <label className="cart-quantity">{variantPrompt}<select value={variant?.id ?? ""} onChange={(event) => setSelectedVariantId(event.currentTarget.value)}>{variants.map((item) => <option key={item.id} value={item.id}>{variantLabel(item)}</option>)}</select></label>}<p className="detail-price">{variant ? formatJod(variant.price_fils, locale) : "\u2014"}</p>{variant && <p>{supplyLabel}</p>}{description && <p className="product-description">{description}</p>}{!result.isShowcase && <><WishlistButton productId={product.id} locale={locale} /><AddToCartButton product={cartProduct} text={text} /></>}<Link className="button button-secondary" to={`/${locale}${result.isShowcase ? "?showcase=1" : ""}`}>{text.back}</Link></div></article> : <section className="catalog-state"><h1>{result.state === "unconfigured" ? text.setup : result.state === "missing" ? text.missing : text.error}</h1><Link className="button button-primary" to={`/${locale}`}>{text.back}</Link></section>}{product && <RelatedProducts locale={locale} category={product.categories} products={related} showcase={result.isShowcase} />}{product && !result.isShowcase && <RecentlyViewed locale={locale} currentProductId={product.id} />}</main>;
}
