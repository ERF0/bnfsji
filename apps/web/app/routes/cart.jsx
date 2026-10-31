import { useEffect, useMemo, useRef } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import { AddToCartButton, CartLink } from "../components/cart-controls.jsx";
import { WishlistLink } from "../components/wishlist-controls.jsx";
import { useCart } from "../components/cart-provider.jsx";
import { cartItemSubtotalFils, cartVariantIds } from "../lib/cart.js";
import { formatJod, normalizeLocale, productHref } from "../lib/catalog.js";

const copy = {
  ar: { title: "سلة التسوق", empty: "سلتك فارغة", browse: "تابع التسوق", remove: "إزالة", quantity: "الكمية", unavailable: "هذا المنتج لم يعد متاحاً", refreshing: "جارٍ تحديث المنتجات والأسعار…", unavailableCatalog: "تعذر التحقق من المنتجات الآن. احتفظنا بسلتك؛ حاول مجدداً لاحقاً.", setup: "خدمة المتجر غير مهيأة بعد. لم نتمكن من التحقق من السلة.", subtotal: "المجموع الفرعي للمنتجات", refresh: "لم تُحدّث الأسعار إلا من الكتالوج الحالي. تُحسب الخصومات والتوصيل وتُراجع الأسعار عند إتاحة إتمام الطلب.", checkout: "إتمام الطلب غير متاح حالياً. سيُتاح بعد ربط التحقق من الهاتف والدفع ومراجعة الشروط.", language: "EN", cart: "السلة", add: "أضف إلى السلة", added: "أُضيف إلى السلة", tooLarge: "تعذر حساب هذا المجموع بأمان. قلل الكميات." },
  en: { title: "Your cart", empty: "Your cart is empty", browse: "Continue shopping", remove: "Remove", quantity: "Quantity", unavailable: "This product is no longer available", refreshing: "Refreshing products and prices…", unavailableCatalog: "Products could not be checked right now. Your cart is saved; try again later.", setup: "The shop service is not configured yet, so we could not check this cart.", subtotal: "Items subtotal", refresh: "Prices are refreshed from the current catalog. Discounts and delivery are calculated and prices rechecked when checkout is enabled.", checkout: "Checkout is currently unavailable. It will open after phone verification, payment and terms are ready.", language: "عربي", cart: "Cart", add: "Add to cart", added: "Added to cart", tooLarge: "This subtotal is outside the supported amount. Reduce quantities." },
};

const checkoutStatus = {
  en: { checkout: "Checkout is unavailable until HyperPay methods, phone verification, Amman delivery coverage and approved terms are confirmed." },
  ar: { checkout: "\u0644\u0627 \u064a\u0645\u0643\u0646 \u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0634\u0631\u0627\u0621 \u0642\u0628\u0644 \u0627\u0644\u062a\u0623\u0643\u062f \u0645\u0646 \u0648\u0633\u0627\u0626\u0644 HyperPay \u0648\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0647\u0627\u062a\u0641 \u0648\u062a\u063a\u0637\u064a\u0629 \u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0641\u064a \u0639\u0645\u0651\u0627\u0646 \u0648\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0634\u0631\u0648\u0637." },
};

export async function loader({ params }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  return { locale };
}

export function meta({ loaderData }) {
  const locale = loaderData?.locale ?? "ar";
  return [{ title: `${locale === "ar" ? "سلة التسوق" : "Your cart"} | BNAFSAJI` }];
}

function UnverifiedCart({ lines, locale, removeItem, setQuantity, text }) {
  const rtl = locale === "ar";
  return <section aria-label={text.title}>
    <p className="cart-note" role="status">{rtl ? "هذه العناصر محفوظة على هذا الجهاز. لم نتحقق بعد من توفرها أو أسعارها الحالية." : "These items are saved on this device. Their availability and current prices have not been verified."}</p>
    <ul className="cart-lines">{lines.map((line) => <li className="cart-line" key={line.variant_id}>
      <div className="cart-line-main"><strong>{String((rtl ? line.title_ar : line.title_en) || line.product_slug).slice(0, 120)}</strong><small>{String((rtl ? line.shop_name_ar : line.shop_name_en) || line.shop_slug).slice(0, 120)}</small></div>
      <label className="cart-quantity">{text.quantity}<input type="number" min="1" step="1" value={line.quantity} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isSafeInteger(value) && value > 0) setQuantity(line.variant_id, value); }} /></label>
      <button className="cart-remove" type="button" onClick={() => removeItem(line.variant_id)}>{text.remove}</button>
    </li>)}</ul>
  </section>;
}

export default function CartRoute() {
  const { locale } = useLoaderData();
  const { lines, ready, setQuantity, removeItem } = useCart();
  const fetcher = useFetcher();
  const requested = useRef("");
  const ids = useMemo(() => cartVariantIds(lines), [lines]);
  const quantities = useMemo(() => ids.map((id) => lines.find((line) => line.variant_id === id)?.quantity ?? 0), [ids, lines]);
  const idsKey = ids.join(",");
  const quantitiesKey = quantities.join(",");
  const requestKey = `${idsKey}|${quantitiesKey}`;
  const text = { ...copy[locale], ...checkoutStatus[locale] };
  const rtl = locale === "ar";

  useEffect(() => {
    if (!ready || !idsKey || requested.current === requestKey) return;
    requested.current = requestKey;
    fetcher.load(`/${locale}/cart/items?variants=${encodeURIComponent(idsKey)}&quantities=${encodeURIComponent(quantitiesKey)}`);
  }, [fetcher, idsKey, locale, quantitiesKey, ready, requestKey]);

  const current = fetcher.data?.requestedVariantIds?.join(",") === idsKey && fetcher.data?.requestedQuantities?.join(",") === quantitiesKey ? fetcher.data : null;
  const variantsById = new Map((current?.variants ?? []).map((product) => [product.variant_id, product]));
  const unavailable = current?.state === "ready" && lines.some((line) => !variantsById.has(line.variant_id));
  const subtotal = current?.state === "ready" && !unavailable ? cartItemSubtotalFils(lines, variantsById) : null;
  const groups = new Map();
  if (current?.state === "ready") {
    for (const line of lines) {
      const product = variantsById.get(line.variant_id) ?? null;
      const key = product?.shops.slug ?? `unavailable:${line.shop_slug}`;
      if (!groups.has(key)) groups.set(key, { shop: product?.shops ?? null, lines: [] });
      groups.get(key).lines.push({ line, product });
    }
  }
  const languageHref = `/${rtl ? "en" : "ar"}/cart`;
  const deliveryLabel = rtl
    ? current?.delivery_mode === "platform" ? "\u062a\u0648\u0635\u064a\u0644 \u0627\u0644\u0645\u0646\u0635\u0629 \u0627\u0644\u062a\u0642\u062f\u064a\u0631\u064a \u0641\u064a \u0639\u0645\u0651\u0627\u0646" : "\u062a\u0648\u0635\u064a\u0644 \u0627\u0644\u0628\u0627\u0626\u0639 \u0627\u0644\u062a\u0642\u062f\u064a\u0631\u064a \u0641\u064a \u0639\u0645\u0651\u0627\u0646"
    : current?.delivery_mode === "platform" ? "Estimated platform delivery (Amman)" : "Estimated seller delivery (Amman)";
  const totalLabel = rtl ? "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a" : "Total";
  const deliveryUnavailable = rtl ? "\u062a\u0639\u0630\u0651\u0631 \u062a\u0623\u0643\u064a\u062f \u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0627\u0644\u0622\u0646. \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0644\u0627\u062d\u0642\u0627\u064b." : "Delivery fees could not be confirmed now. Please retry later.";

  return <main className="cart-page" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <header className="product-header"><Link className="wordmark" to={`/${locale}`}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>BNAFSAJI</span></Link><nav className="header-actions"><WishlistLink locale={locale} /><CartLink locale={locale} text={text.cart} /><Link className="language-link" to={languageHref} lang={rtl ? "en" : "ar"}>{text.language}</Link></nav></header>
    <h1>{text.title}</h1>
    {!ready ? <p role="status">{text.refreshing}</p> : lines.length === 0 ? <section className="catalog-state"><h2>{text.empty}</h2><Link className="button button-primary" to={`/${locale}`}>{text.browse}</Link></section> : !current ? <><p role="status">{fetcher.state !== "idle" ? text.refreshing : text.unavailableCatalog}</p><UnverifiedCart lines={lines} locale={locale} removeItem={removeItem} setQuantity={setQuantity} text={text} /></> : current.state !== "ready" ? <><p role="alert">{current.state === "unconfigured" ? text.setup : text.unavailableCatalog}</p><UnverifiedCart lines={lines} locale={locale} removeItem={removeItem} setQuantity={setQuantity} text={text} /></> : <>
      {[...groups.entries()].map(([key, group]) => <section className="cart-group" key={key} aria-labelledby={`cart-shop-${key}`}>
        <h2 id={`cart-shop-${key}`}>{group.shop ? (rtl ? group.shop.name_ar : group.shop.name_en || group.shop.name_ar) : rtl ? "متجر" : "Shop"}</h2>
        <ul className="cart-lines">{group.lines.map(({ line, product }) => <li className="cart-line" key={line.variant_id}>
          {product && <Link className="cart-line-image" to={productHref(locale, product.shops.slug, product.slug)} aria-label={rtl ? "عرض المنتج" : "View product"}>{product.images?.[0]?.src ? <img src={product.images[0].src} alt="" width="96" height="96" loading="lazy" /> : <span aria-hidden="true">{rtl ? "صورة المنتج" : "Product"}</span>}</Link>}
          <div className="cart-line-main">
            {product ? <><Link to={productHref(locale, product.shops.slug, product.slug)}>{rtl ? product.title_ar : product.title_en || product.title_ar}</Link><small>{(line.option_values ?? []).map((option) => `${rtl ? option.label_ar : option.label_en || option.label_ar}: ${rtl ? option.value_ar : option.value_en || option.value_ar}`).join(" / ")}</small><strong>{formatJod(product.price_fils, locale)}</strong></> : <strong>{text.unavailable}</strong>}
          </div>
          {product && <label className="cart-quantity">{text.quantity}<input type="number" min="1" step="1" value={line.quantity} onChange={(event) => { const value = Number(event.currentTarget.value); if (Number.isSafeInteger(value) && value > 0) setQuantity(line.variant_id, value); }} /></label>}
          <button className="cart-remove" type="button" onClick={() => removeItem(line.variant_id)}>{text.remove}</button>
        </li>)}</ul>
      </section>)}
      <section className="cart-summary" aria-live="polite">
        <p><span>{text.subtotal}</span><strong>{unavailable ? "—" : subtotal === null ? text.tooLarge : formatJod(subtotal, locale)}</strong></p>
        {current?.quote_state === "ready" && current.quote ? <><p className="cart-cost-line"><span>{deliveryLabel}</span><strong>{formatJod(current.quote.delivery_charge_fils, locale)}</strong></p><p className="cart-cost-line"><span>{totalLabel}</span><strong>{formatJod(current.quote.buyer_total_fils, locale)}</strong></p></> : <p role="status">{deliveryUnavailable}</p>}
        <p className="cart-note">{text.refresh}</p>
        <p className="cart-blocked" role="status">{text.checkout}</p>
      </section>
    </>}
    {ready && lines.length > 0 && <Link className="button button-secondary" to={`/${locale}`}>{text.browse}</Link>}
  </main>;
}
