import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { CartLink } from "../components/cart-controls.jsx";
import { WishlistLink } from "../components/wishlist-controls.jsx";
import { useWishlist } from "../components/wishlist-provider.jsx";
import { formatJod, normalizeLocale, productHref } from "../lib/catalog.js";
import { isCompleteWishlistResolution, partitionWishlistProducts } from "../lib/wishlist.js";

const text = {
  en: { title: "Your wishlist", empty: "Your wishlist is empty", browse: "Continue shopping", loading: "Loading saved products…", unavailable: "Saved products could not be refreshed. Try again shortly.", saved: "Saved products", remove: "Remove", cart: "Cart", noPhoto: "No product photo has been added yet", sync: "Your saved products could not be synced. Reload after checking your connection." },
  ar: { title: "قائمة المفضلة", empty: "قائمة المفضلة فارغة", browse: "متابعة التسوق", loading: "جارٍ تحميل المنتجات المحفوظة…", unavailable: "تعذر تحديث المنتجات المحفوظة. حاول مجدداً بعد قليل.", saved: "المنتجات المحفوظة", remove: "إزالة", cart: "السلة", noPhoto: "لم تُضف صورة للمنتج بعد", sync: "تعذرت مزامنة المنتجات المحفوظة. أعد التحميل بعد التحقق من الاتصال." },
};

const AVAILABILITY_COPY = {
  en: {
    heading: "Saved products no longer in the public catalog",
    item: "This saved product is no longer available in the public catalog.",
    remove: (index) => `Remove unavailable saved product ${index + 1}`,
  },
  ar: {
    heading: "\u0645\u0646\u062a\u062c\u0627\u062a \u0645\u062d\u0641\u0648\u0638\u0629 \u0644\u0645 \u062a\u0639\u062f \u0641\u064a \u0627\u0644\u0633\u0648\u0642",
    item: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c \u0627\u0644\u0645\u062d\u0641\u0648\u0638 \u0644\u0645 \u064a\u0639\u062f \u0645\u062a\u0627\u062d\u0627\u064b \u0641\u064a \u0627\u0644\u0633\u0648\u0642.",
    remove: (index) => `\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0645\u0646\u062a\u062c \u0627\u0644\u0645\u062d\u0641\u0648\u0638 \u063a\u064a\u0631 \u0627\u0644\u0645\u062a\u0627\u062d ${index + 1}`,
  },
};

export async function loader({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  return { locale };
}

export function meta({ loaderData }) {
  return [{ title: `${text[loaderData?.locale ?? "ar"].title} | BNAFSAJI` }, { name: "robots", content: "noindex,follow" }];
}

export default function WishlistRoute() {
  const { locale } = useLoaderData();
  const rtl = locale === "ar";
  const copy = text[locale];
  const languageHref = `/${rtl ? "en" : "ar"}/wishlist`;
  const { ids, status, toggle } = useWishlist();
  const key = ids.join(",");
  const [loaded, setLoaded] = useState({ key: "", products: [], state: "loading" });
  const batches = useMemo(() => {
    const values = ids;
    const groups = [];
    for (let offset = 0; offset < values.length; offset += 100) groups.push(values.slice(offset, offset + 100));
    return groups;
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    if (!ids.length) { setLoaded({ key, products: [], state: "ready" }); return () => { cancelled = true; }; }
    setLoaded({ key, products: [], state: "loading" });
    (async () => {
      const products = [];
      for (const batch of batches) {
        const response = await fetch(`/${locale}/cart/items?ids=${encodeURIComponent(batch.join(","))}`, { cache: "no-store" });
        if (!response.ok) throw new Error("product refresh failed");
        const result = await response.json();
        if (result.state !== "ready" || !Array.isArray(result.products)
            || !isCompleteWishlistResolution(batch, result.requestedIds)) throw new Error("product refresh failed");
        products.push(...result.products);
      }
      if (!cancelled) setLoaded({ key, products, state: "ready" });
    })().catch(() => { if (!cancelled) setLoaded({ key, products: [], state: "error" }); });
    return () => { cancelled = true; };
  }, [key, locale, status, batches]);

  const current = loaded.key === key ? loaded : null;
  const { products, unavailableIds } = current?.state === "ready"
    ? partitionWishlistProducts(ids, current.products)
    : { products: current?.products ?? [], unavailableIds: [] };
  const availability = AVAILABILITY_COPY[locale];
  return <main className="cart-page" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <header className="product-header"><Link className="wordmark" to={`/${locale}`}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>BNAFSAJI</span></Link><nav className="header-actions"><WishlistLink locale={locale} /><CartLink locale={locale} text={copy.cart} /><Link className="language-link" to={languageHref} lang={rtl ? "en" : "ar"}>{rtl ? "EN" : "عربي"}</Link></nav></header>
    <h1>{copy.title}</h1>
    {status === "loading" ? <p role="status">{copy.loading}</p> : status === "error" ? <p role="alert">{copy.sync}</p> : ids.length === 0 ? <section className="catalog-state"><h2>{copy.empty}</h2><Link className="button button-primary" to={`/${locale}`}>{copy.browse}</Link></section> : !current || current.state === "loading" ? <p role="status">{copy.loading}</p> : current.state === "error" ? <p role="alert">{copy.unavailable}</p> : <>
      <section className="product-grid" aria-label={copy.saved}>{products.map((product) => <article className="product-card" key={product.id}>
        <div className="product-art">{product.images?.[0]?.src ? <img src={product.images[0].src} alt={rtl ? product.title_ar : product.title_en || product.title_ar} width="640" height="640" loading="lazy" decoding="async" /> : <span>{copy.noPhoto}</span>}</div><div className="product-info">
          <h2><Link to={productHref(locale, product.shops.slug, product.slug)}>{rtl ? product.title_ar : product.title_en || product.title_ar}</Link></h2>
          <div className="product-row"><strong>{formatJod(product.price_fils, locale)}</strong><button className="cart-remove" type="button" onClick={() => { void toggle(product.id); }}>{copy.remove}</button></div>
        </div>
      </article>)}</section>
      {products.length === 0 && unavailableIds.length === 0 && <section className="catalog-state"><h2>{copy.empty}</h2><Link className="button button-primary" to={`/${locale}`}>{copy.browse}</Link></section>}
      {unavailableIds.length > 0 && <section className="wishlist-unavailable" aria-labelledby="wishlist-unavailable-title"><h2 id="wishlist-unavailable-title">{availability.heading}</h2><ul>{unavailableIds.map((id, index) => <li key={id}><span>{availability.item}</span><button className="cart-remove" type="button" aria-label={availability.remove(index)} onClick={() => { void toggle(id); }}>{copy.remove}</button></li>)}</ul></section>}
    </>}
    <Link className="button button-secondary" to={`/${locale}`}>{copy.browse}</Link>
  </main>;
}
