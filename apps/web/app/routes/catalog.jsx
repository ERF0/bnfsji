import { useEffect, useRef, useState } from "react";
import { Form, Link, useLoaderData, useNavigation, useSubmit } from "react-router";
import { formatJod, localizedSeoLinks, normalizeLocale, parseJodPriceFilter, productHref, shopHref } from "../lib/catalog";
import { loadCatalog } from "../lib/catalog.server";
import { cloudflareContext } from "../lib/cloudflare-context.server";
import { CartLink } from "../components/cart-controls.jsx";
import { WishlistButton, WishlistLink } from "../components/wishlist-controls.jsx";

function localShowcase(request) {
  return import.meta.env?.MODE === "development" && new URL(request.url).searchParams.get("showcase") === "1";
}

function readOptionFilters(searchParams) {
  const entries = searchParams.getAll("f");
  if (entries.length > 16) throw new Response("Too many product filters", { status: 400 });
  const filters = entries.map((entry) => {
    if (entry.length > 500) throw new Response("Invalid product filter", { status: 400 });
    try { return JSON.parse(entry); } catch { throw new Response("Invalid product filter", { status: 400 }); }
  });
  if (filters.some((filter) => !filter || ["label_ar", "label_en", "value_ar", "value_en"].some((key) =>
    typeof filter[key] !== "string" || !filter[key].trim() || filter[key].length > 80))) {
    throw new Response("Invalid product filter", { status: 400 });
  }
  return filters;
}

const copy = {
  ar: { brand: "بَنَفْسَجِي", place: "عمّان، الأردن", search: "ابحث عن منتج أو متجر", searching: "جارٍ البحث…", submit: "بحث", categories: "تسوّق حسب الفئة", all: "كل المنتجات", new: "وصل حديثاً", count: "منتج", empty: "لا توجد منتجات مطابقة بعد", emptyHelp: "جرّب عبارة بحث أخرى أو عُد لاحقاً لاكتشاف منتجات جديدة.", unavailable: "تعذر تحميل المنتجات", unavailableHelp: "المتجر غير متاح مؤقتاً. يرجى المحاولة بعد قليل.", setup: "المتجر قيد الإعداد", setupHelp: "سيظهر الكتالوج بعد ربط خدمة المتجر.", sort: "الترتيب", newest: "الأحدث", low: "السعر: الأقل أولاً", high: "السعر: الأعلى أولاً", view: "عرض المنتج", noPhoto: "لم تُضف صورة للمنتج بعد", previous: "السابق", next: "التالي", foot: "سوق أردني يجمع المتاجر والصنّاع في مكان واحد.", cart: "السلة", add: "أضف إلى السلة", added: "أُضيف إلى السلة", limit: "وصلت السلة إلى الحد الأقصى (100 منتج)" },
  en: { brand: "BNAFSAJI", place: "Amman, Jordan", search: "Search products or shops", searching: "Searching…", submit: "Search", categories: "Shop by category", all: "All products", new: "Just added", count: "products", empty: "No matching products yet", emptyHelp: "Try another search or come back to discover new products.", unavailable: "Products could not be loaded", unavailableHelp: "The shop is temporarily unavailable. Please try again shortly.", setup: "Storefront setup in progress", setupHelp: "The catalog will appear when the store service is connected.", sort: "Sort", newest: "Newest", low: "Price: low to high", high: "Price: high to low", view: "View product", noPhoto: "No product photo has been added yet", previous: "Previous", next: "Next", foot: "A Jordanian marketplace bringing shops and makers together.", cart: "Cart", add: "Add to cart", added: "Added to cart", limit: "Cart limit reached (100 items)" },
};

const homeCopy = {
  ar: { eyebrow: "\u0645\u062a\u0627\u062c\u0631 \u0648\u0635\u0646\u0651\u0627\u0639 \u0645\u0646 \u0639\u0645\u0651\u0627\u0646", title: "\u062a\u0633\u0648\u0651\u0642 \u0645\u0646 \u0645\u062a\u0627\u062c\u0631 \u0642\u0631\u064a\u0628\u0629 \u0645\u0646\u0643", body: "\u0627\u0643\u062a\u0634\u0641 \u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062c\u0631 \u0648\u0627\u0644\u0635\u0646\u0651\u0627\u0639 \u0627\u0644\u0645\u062d\u0644\u064a\u064a\u0646\u060c \u0648\u062a\u0635\u0641\u0651\u062d \u062e\u064a\u0627\u0631\u0627\u062a\u0647\u0645 \u0641\u064a \u0645\u0643\u0627\u0646 \u0648\u0627\u062d\u062f.", browse: "\u062a\u0635\u0641\u0651\u062d \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a", sell: "\u0627\u0639\u0631\u0636 \u0645\u0646\u062a\u062c\u0627\u062a \u0645\u062a\u062c\u0631\u0643" },
  en: { eyebrow: "Shops and makers in Amman", title: "Find something made close to home", body: "Explore products from local shops and makers, with their options and prices in one place.", browse: "Browse products", sell: "List your shop" },
};

const stateActions = {
  en: { clearFilters: "Clear search and filters", retry: "Try again" },
  ar: { clearFilters: "\u0645\u0633\u062d \u0627\u0644\u0628\u062d\u062b \u0648\u0627\u0644\u0641\u0644\u0627\u062a\u0631", retry: "\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649" },
};

export async function loader({ request, params, context }) {
  const locale = normalizeLocale(params.locale);
  if (!locale) throw new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const category = params.slug ?? null;
  const query = (url.searchParams.get("q") ?? "").trim();
  const sort = url.searchParams.get("sort") ?? "newest";
  const shop = url.searchParams.get("shop") ?? "";
  const fulfillment = url.searchParams.get("fulfillment") ?? "";
  if (query.length > 100 || (shop && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(shop)) || !["", "stocked", "after_order"].includes(fulfillment)) {
    throw new Response("Invalid catalog filter", { status: 400 });
  }
  const optionFilters = readOptionFilters(url.searchParams);
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  let minPriceFils;
  let maxPriceFils;
  try {
    minPriceFils = parseJodPriceFilter(url.searchParams.get("min_price"));
    maxPriceFils = parseJodPriceFilter(url.searchParams.get("max_price"));
  } catch {
    throw new Response("Invalid price filter", { status: 400 });
  }
  if (minPriceFils !== null && maxPriceFils !== null && minPriceFils > maxPriceFils) {
    throw new Response("Minimum price must not exceed maximum price", { status: 400 });
  }
  const env = context.get(cloudflareContext).env;
  const showcase = localShowcase(request);
  let showcaseShops = [];
  let facets = { shops: [], attributes: [] };
  let catalog;
  if (showcase) {
    const demo = await import("../lib/showcase-data.js");
    catalog = demo.loadShowcaseCatalog({ query, category, sort, page, minPriceFils, maxPriceFils, shop, fulfillment, optionFilters });
    showcaseShops = demo.showcaseShops;
    facets = demo.loadShowcaseFacets({ query, category });
  } else {
    catalog = await loadCatalog(env, { query, category, sort, page, minPriceFils, maxPriceFils, shop, fulfillment, optionFilters, signal: request.signal });
    facets = catalog.facets ?? facets;
  }
  if (category && catalog.state === "ready" && !catalog.categories.some((item) => item.slug === category)) throw new Response("Not found", { status: 404 });
  return { locale, category, query, sort, page, minPriceFils, maxPriceFils, shop, fulfillment, optionFilters, facets, showcase, showcaseShops, retryUrl: `${url.pathname}${url.search}`, siteUrl: env.PUBLIC_SITE_URL, catalog };
}

export function meta({ loaderData }) {
  const locale = loaderData?.locale ?? "ar";
  const catalog = loaderData?.catalog;
  const isIndexable = catalog?.state === "ready" && !catalog.isShowcase && catalog.total > 0 && !loaderData.query && loaderData.sort === "newest" && loaderData.page === 1 && loaderData.minPriceFils === null && loaderData.maxPriceFils === null && !loaderData.shop && !loaderData.fulfillment && !loaderData.optionFilters.length;
  const path = loaderData.category ? `/c/${encodeURIComponent(loaderData.category)}` : "";
  const seoLinks = isIndexable ? localizedSeoLinks(loaderData.siteUrl, path, locale) : [];
  return [
    { title: locale === "ar" ? "بَنَفْسَجِي | تسوّق من متاجر الأردن" : "BNAFSAJI | Shop Jordanian stores" },
    { name: "description", content: locale === "ar" ? "اكتشف منتجات المتاجر والصنّاع في عمّان." : "Discover products from shops and makers in Amman." },
    { name: "robots", content: seoLinks.length ? "index,follow" : "noindex,follow" },
    ...seoLinks,
  ];
}

function ProductCard({ product, locale, text }) {
  const name = locale === "ar" ? product.title_ar : product.title_en || product.title_ar;
  const shop = locale === "ar" ? product.shop_name_ar : product.shop_name_en || product.shop_name_ar;
  const baseHref = productHref(locale, product.shop_slug, product.slug ?? product.product_slug);
  const href = product.sample ? `${baseHref}?showcase=1` : baseHref;
  const storeHref = product.sample ? `${shopHref(locale, product.shop_slug)}?showcase=1` : shopHref(locale, product.shop_slug);
  return <article className="product-card"><div className="product-art"><Link className="product-image-link" to={href} aria-label={name}>{product.images?.[0]?.src ? <img src={product.images[0].src} alt={name} width="640" height="640" loading="lazy" decoding="async" /> : <span>{text.noPhoto}</span>}</Link>{product.sample && <span className="sample-product-badge">{locale === "ar" ? "عينة" : "Sample"}</span>}</div><div className="product-info"><p className="product-shop"><Link to={storeHref}>{shop}</Link></p><h2><Link to={href}>{name}</Link></h2><div className="product-row"><strong>{formatJod(product.price_fils, locale)}</strong><Link className="product-link" to={href} aria-label={`${text.view}: ${name}`}>↗</Link></div>{!product.sample && <WishlistButton productId={product.product_id} locale={locale} />}<Link className="button button-secondary" to={href}>{text.view}</Link></div></article>;
}

function CatalogSearch({ locale, category, query, sort, shop, fulfillment, optionFilters, showcase, text }) {
  const [value, setValue] = useState(query);
  const submit = useSubmit();
  const timer = useRef(null);
  const navigation = useNavigation();
  const action = `/${locale}${category ? `/c/${category}` : ""}`;
  const isSearching = navigation.state === "loading" && navigation.location?.pathname === action;

  useEffect(() => setValue(query), [query]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function clearTimer() {
    clearTimeout(timer.current);
  }

  function handleChange(event) {
    const nextValue = event.currentTarget.value;
    const form = event.currentTarget.form;
    setValue(nextValue);
    clearTimer();
    if (nextValue.trim() === query) return;
    timer.current = setTimeout(() => {
      const data = new FormData(form);
      if (nextValue.trim()) data.set("q", nextValue.trim());
      else data.delete("q");
      submit(data, { action, method: "get", replace: true, preventScrollReset: true });
    }, 350);
  }

  return <>
    <Form className="search-form" action={action} method="get" role="search" onSubmit={clearTimer}>
      <label className="visually-hidden" htmlFor="catalog-search">{text.search}</label>
      <span className="search-icon" aria-hidden="true">⌕</span>
      <input id="catalog-search" type="search" name="q" value={value} onChange={handleChange} placeholder={text.search} maxLength={100} />
      {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
      {text.minPriceValue !== null && <input type="hidden" name="min_price" value={text.minPriceValue} />}
      {text.maxPriceValue !== null && <input type="hidden" name="max_price" value={text.maxPriceValue} />}
      {shop && <input type="hidden" name="shop" value={shop} />}
      {fulfillment && <input type="hidden" name="fulfillment" value={fulfillment} />}
      {showcase && <input type="hidden" name="showcase" value="1" />}
      {optionFilters.map((filter) => <input key={`${filter.label_en}-${filter.value_en}`} type="hidden" name="f" value={JSON.stringify(filter)} />)}
      <button type="submit">{text.submit}</button>
    </Form>
    <span className="visually-hidden" role="status" aria-live="polite">{isSearching ? text.searching : ""}</span>
  </>;
}

export default function CatalogRoute() {
  const { locale, category, query, sort, page, minPriceFils, maxPriceFils, shop, fulfillment, optionFilters, facets, retryUrl, catalog, showcase, showcaseShops } = useLoaderData();
  const text = {
    ...copy[locale],
    ...stateActions[locale],
    minPrice: locale === "ar" ? "\u0627\u0644\u0633\u0639\u0631 \u0645\u0646 (\u062f.\u0623)" : "Min price (JOD)",
    maxPrice: locale === "ar" ? "\u0627\u0644\u0633\u0639\u0631 \u0625\u0644\u0649 (\u062f.\u0623)" : "Max price (JOD)",
    apply: locale === "ar" ? "\u062a\u0637\u0628\u064a\u0642" : "Apply",
    minPriceValue: minPriceFils === null ? null : (minPriceFils / 1000).toFixed(3),
    maxPriceValue: maxPriceFils === null ? null : (maxPriceFils / 1000).toFixed(3),
    filters: locale === "ar" ? "تصفية" : "Filter",
    filtersAndSort: locale === "ar" ? "تصفية" : "Filter",
    shops: locale === "ar" ? "المتجر" : "Shop",
    anyShop: locale === "ar" ? "كل المتاجر" : "All shops",
    price: locale === "ar" ? "السعر" : "Price",
    fulfillmentLabel: locale === "ar" ? "التجهيز" : "Fulfillment",
    stocked: locale === "ar" ? "متوفر مسبقاً" : "Ready to ship",
    afterOrder: locale === "ar" ? "يُجهز بعد الطلب" : "Made after order",
    allFulfillment: locale === "ar" ? "أي طريقة تجهيز" : "Any fulfillment",
    showResults: locale === "ar" ? "عرض النتائج" : "Show results",
    clearAll: locale === "ar" ? "مسح الكل" : "Clear all",
    activeFilters: locale === "ar" ? "عوامل التصفية المختارة" : "Applied filters",
    selected: locale === "ar" ? "محدد" : "selected",
    closeFilters: locale === "ar" ? "\u0625\u063a\u0644\u0627\u0642" : "Close",
  };
  const rtl = locale === "ar";
  const selected = catalog.categories.find((item) => item.slug === category);
  const heading = selected ? (rtl ? selected.name_ar : selected.name_en || selected.name_ar) : query || text.new;
  const localeParams = new URLSearchParams();
  if (query) localeParams.set("q", query);
  if (sort !== "newest") localeParams.set("sort", sort);
  if (minPriceFils !== null) localeParams.set("min_price", (minPriceFils / 1000).toFixed(3));
  if (maxPriceFils !== null) localeParams.set("max_price", (maxPriceFils / 1000).toFixed(3));
  if (shop) localeParams.set("shop", shop);
  if (fulfillment) localeParams.set("fulfillment", fulfillment);
  for (const filter of optionFilters) localeParams.append("f", JSON.stringify(filter));
  const localeQuery = localeParams.toString();
  const sortChoices = [["newest", text.newest], ["price_low", text.low], ["price_high", text.high]];
  const sortHref = (value) => {
    const params = new URLSearchParams(localeParams);
    params.delete("page");
    if (value === "newest") params.delete("sort");
    else params.set("sort", value);
    if (showcase) params.set("showcase", "1");
    return `/${locale}${category ? `/c/${category}` : ""}${params.size ? `?${params}` : ""}`;
  };
  const languageParams = new URLSearchParams(localeQuery);
  if (page > 1) languageParams.set("page", String(page));
  if (showcase) languageParams.set("showcase", "1");
  const languageHref = `/${rtl ? "en" : "ar"}${category ? `/c/${category}` : ""}${languageParams.size ? `?${languageParams}` : ""}`;
  const pageCount = Math.ceil(catalog.total / 24);
  const pageHref = (page) => {
    const params = new URLSearchParams(localeParams);
    if (showcase) params.set("showcase", "1");
    params.set("page", String(page));
    return `/${locale}${category ? `/c/${category}` : ""}?${params}`;
  };
  const categoryHref = (slug) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort !== "newest") params.set("sort", sort);
    if (minPriceFils !== null) params.set("min_price", (minPriceFils / 1000).toFixed(3));
    if (maxPriceFils !== null) params.set("max_price", (maxPriceFils / 1000).toFixed(3));
    if (showcase) params.set("showcase", "1");
    return `/${locale}${slug ? `/c/${slug}` : ""}${params.size ? `?${params}` : ""}`;
  };
  const hasFilters = Boolean(query || sort !== "newest" || minPriceFils !== null || maxPriceFils !== null || page > 1 || shop || fulfillment || optionFilters.length);
  const clearParams = new URLSearchParams();
  if (query) clearParams.set("q", query);
  if (showcase) clearParams.set("showcase", "1");
  const clearFiltersHref = `/${locale}${category ? `/c/${category}` : ""}${clearParams.size ? `?${clearParams}` : ""}`;
  const activeFilterCount = optionFilters.length + Number(Boolean(shop)) + Number(Boolean(fulfillment)) + Number(minPriceFils !== null) + Number(maxPriceFils !== null);
  const activeChips = [
    ...(shop ? [{ label: facets.shops.find((item) => item.slug === shop)?.[rtl ? "name_ar" : "name_en"] ?? shop, remove: (params) => params.delete("shop") }] : []),
    ...(fulfillment ? [{ label: fulfillment === "stocked" ? text.stocked : text.afterOrder, remove: (params) => params.delete("fulfillment") }] : []),
    ...optionFilters.map((filter, index) => ({ label: `${rtl ? filter.label_ar : filter.label_en}: ${rtl ? filter.value_ar : filter.value_en}`, remove: (params) => { const remaining = optionFilters.filter((_, itemIndex) => itemIndex !== index); params.delete("f"); for (const item of remaining) params.append("f", JSON.stringify(item)); } })),
    ...(minPriceFils !== null ? [{ label: `${text.minPrice} ${text.minPriceValue}`, remove: (params) => params.delete("min_price") }] : []),
    ...(maxPriceFils !== null ? [{ label: `${text.maxPrice} ${text.maxPriceValue}`, remove: (params) => params.delete("max_price") }] : []),
  ];
  const removeChipHref = (chip) => { const params = new URLSearchParams(localeParams); params.delete("page"); chip.remove(params); if (showcase) params.set("showcase", "1"); return `/${locale}${category ? `/c/${category}` : ""}${params.size ? `?${params}` : ""}`; };
  const description = rtl ? "منتجات من متاجر وصنّاع محليين، بتفاصيل واضحة." : "Products from local shops and makers, with the details up front.";

  return <div className="site-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    {showcase && <div className="showcase-notice" role="note"><strong>{rtl ? "معاينة محلية · بيانات افتراضية" : "Local preview · Sample data"}</strong><span>{rtl ? "المنتجات والأرقام للعرض فقط؛ الشراء والطلبات الحقيقية غير متاحين." : "Products and figures are illustrative; checkout and real orders are disabled."}</span><Link to={`/${locale}/seller?showcase=1`}>{rtl ? "معاينة لوحة البائع" : "Seller dashboard preview"}</Link><Link to={`/${locale}`}>{rtl ? "العودة للمتجر" : "Return to storefront"}</Link></div>}
    <div className="announcement"><span className="status-dot" />{text.place}<span className="announcement-separator">·</span>{rtl ? "متاجر الأردن، أقرب إليك" : "Jordanian shops, closer to you"}</div>
    <header className="site-header">
      <Link className="wordmark" to={`/${locale}`} aria-label={text.brand}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>{text.brand}</span></Link>
      <CatalogSearch locale={locale} category={category} query={query} sort={sort} shop={shop} fulfillment={fulfillment} optionFilters={optionFilters} showcase={showcase} text={text} />
      <nav className="header-actions" aria-label={rtl ? "روابط الحساب والتسوق" : "Account and shopping links"}><Link className="language-link" to={`/${locale}/seller/apply`}>{rtl ? "ابدأ البيع معنا" : "Sell on Bnafsaji"}</Link><Link className="language-link" to={"/" + locale + "/account"}>{rtl ? "حسابي" : "Account"}</Link><WishlistLink locale={locale} /><CartLink locale={locale} text={text.cart} /><Link className="language-link" to={languageHref} lang={rtl ? "en" : "ar"}>{rtl ? "EN" : "عربي"}</Link></nav>
    </header>
    <main className="main-content">
      {!showcase && import.meta.env?.MODE === "development" && <Link className="showcase-launch" to={`/${locale}?showcase=1`}>{rtl ? "شاهد الواجهة مع منتجات افتراضية" : "Preview with sample products"}<span aria-hidden="true">↗</span></Link>}
      {!category && !query && <section className="marketplace-hero live-hero" aria-labelledby="home-title">
        <div className="marketplace-hero-copy"><p className="eyebrow">{homeCopy[locale].eyebrow}</p><h1 id="home-title">{homeCopy[locale].title}</h1><p>{homeCopy[locale].body}</p><div className="hero-actions"><a className="button button-primary" href="#product-results">{homeCopy[locale].browse}</a><Link className="button button-secondary" to={`/${locale}/seller/apply`}>{homeCopy[locale].sell}</Link></div></div>
      </section>}
      <nav id="categories" className="category-nav" aria-label={text.categories}><Link className={!category ? "category-pill is-active" : "category-pill"} to={categoryHref(null)}>{text.all}</Link>{catalog.categories.map((item) => <Link key={item.slug} className={category === item.slug ? "category-pill is-active" : "category-pill"} to={categoryHref(item.slug)}>{rtl ? item.name_ar : item.name_en || item.name_ar}</Link>)}</nav>
      <section id="product-results" className="catalog-heading"><div><p className="eyebrow">{rtl ? "اختيارات من عمّان" : "A selection from Amman"}</p>{!category && !query ? <h2>{heading}</h2> : <h1>{heading}</h1>}<p className="catalog-subtitle">{description}</p></div>{catalog.state === "ready" && <div className="discovery-controls">
        <div className="sort-control"><span>{text.sort}</span><details className="sort-menu" key={sort}><summary aria-label={`${text.sort}: ${sortChoices.find(([value]) => value === sort)?.[1] ?? text.newest}`}>{sortChoices.find(([value]) => value === sort)?.[1] ?? text.newest}</summary><div className="sort-menu-list">{sortChoices.map(([value, label]) => <Link key={value} to={sortHref(value)} aria-current={value === sort ? "true" : undefined} preventScrollReset onClick={(event) => { event.currentTarget.closest("details").open = false; }}><span>{label}</span>{value === sort && <span aria-hidden="true">✓</span>}</Link>)}</div></details></div>
        <details className="catalog-filter-panel"><summary><span aria-hidden="true">☷</span> {text.filtersAndSort}{activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}</summary><Form className="catalog-filter-form" method="get"><input type="hidden" name="q" value={query} />{showcase && <input type="hidden" name="showcase" value="1" />}
          <fieldset className="filter-section"><legend>{text.sort}</legend><div className="filter-choice-grid">{[["newest", text.newest], ["price_low", text.low], ["price_high", text.high]].map(([value, label]) => <label key={value} className="filter-choice"><input type="radio" name="sort" value={value} defaultChecked={sort === value} /><span>{label}</span></label>)}</div></fieldset>
          <fieldset className="filter-section"><legend>{text.price}</legend><div className="filter-price-row"><label><span>{text.minPrice}</span><input name="min_price" type="number" min="0" step="0.001" inputMode="decimal" defaultValue={text.minPriceValue ?? ""} /></label><label><span>{text.maxPrice}</span><input name="max_price" type="number" min="0" step="0.001" inputMode="decimal" defaultValue={text.maxPriceValue ?? ""} /></label></div></fieldset>
          {facets.shops.length > 0 && <fieldset className="filter-section"><legend>{text.shops}</legend><div className="filter-choice-list"><label className="filter-choice"><input type="radio" name="shop" value="" defaultChecked={!shop} /><span>{text.anyShop}</span></label>{facets.shops.map((item) => <label key={item.slug} className="filter-choice"><input type="radio" name="shop" value={item.slug} defaultChecked={shop === item.slug} /><span>{rtl ? item.name_ar : item.name_en}</span><small>{item.count}</small></label>)}</div></fieldset>}
          {facets.attributes.map((facet) => <fieldset className="filter-section" key={`${facet.label_en}-${facet.label_ar}`}><legend>{rtl ? facet.label_ar : facet.label_en}</legend><div className="filter-choice-list">{facet.values.map((item) => { const value = JSON.stringify({ label_en: facet.label_en, label_ar: facet.label_ar, value_en: item.value_en, value_ar: item.value_ar }); return <label key={item.value_en} className="filter-choice"><input type="checkbox" name="f" value={value} defaultChecked={optionFilters.some((filter) => filter.label_en === facet.label_en && filter.value_en === item.value_en)} /><span>{rtl ? item.value_ar : item.value_en}</span><small>{item.count}</small></label>; })}</div></fieldset>)}
          <fieldset className="filter-section"><legend>{text.fulfillmentLabel}</legend><div className="filter-choice-grid">{[["", text.allFulfillment], ["stocked", text.stocked], ["after_order", text.afterOrder]].map(([value, label]) => <label key={value || "all"} className="filter-choice"><input type="radio" name="fulfillment" value={value} defaultChecked={fulfillment === value} /><span>{label}</span></label>)}</div></fieldset>
          <div className="filter-actions"><button className="filter-close" type="button" onClick={(event) => { const panel = event.currentTarget.closest("details"); panel.open = false; panel.querySelector("summary")?.focus(); }}>{text.closeFilters}</button><Link className="filter-clear" to={clearFiltersHref}>{text.clearAll}</Link><button className="button button-primary" type="submit">{text.showResults}</button></div>
        </Form></details>
      </div>}</section>
      {activeChips.length > 0 && <section className="active-filter-row" aria-label={text.activeFilters}>{activeChips.map((chip, index) => <Link className="active-filter-chip" key={`${chip.label}-${index}`} to={removeChipHref(chip)}><span>{chip.label}</span><span aria-hidden="true">×</span></Link>)}<Link className="filter-clear-inline" to={clearFiltersHref}>{text.clearAll}</Link></section>}
      {catalog.state === "ready" && catalog.products.length > 0 ? <><p className="result-count">{new Intl.NumberFormat(rtl ? "ar-JO" : "en-JO").format(catalog.total)} {text.count}</p><section className="product-grid" aria-label={heading}>{catalog.products.map((product) => <ProductCard key={product.product_id} product={product} locale={locale} text={text} />)}</section>{pageCount > 1 && <nav className="pagination" aria-label={rtl ? "صفحات المنتجات" : "Product pages"}>{catalog.page > 1 && <Link className="page-link" to={pageHref(catalog.page - 1)}>{text.previous}</Link>}<span>{new Intl.NumberFormat(rtl ? "ar-JO" : "en-JO").format(catalog.page)} / {new Intl.NumberFormat(rtl ? "ar-JO" : "en-JO").format(pageCount)}</span>{catalog.page < pageCount && <Link className="page-link" to={pageHref(catalog.page + 1)}>{text.next}</Link>}</nav>}</> : <section className="catalog-state" aria-live="polite"><div className="state-mark" aria-hidden="true">{catalog.state === "ready" ? "⌕" : "…"}</div><h2>{catalog.state === "ready" ? text.empty : catalog.state === "unconfigured" ? text.setup : text.unavailable}</h2><p>{catalog.state === "ready" ? text.emptyHelp : catalog.state === "unconfigured" ? text.setupHelp : text.unavailableHelp}</p>{catalog.state === "ready" && hasFilters && <Link className="button button-primary" to={clearFiltersHref}>{text.clearFilters}</Link>}{catalog.state === "unavailable" && <Link className="button button-secondary" to={retryUrl}>{text.retry}</Link>}</section>}
      {showcase && !category && !query && <section className="featured-shops" aria-labelledby="featured-shops-title"><div className="section-title-row"><div><p className="eyebrow">{rtl ? "متاجر من عمّان" : "Independent shops"}</p><h2 id="featured-shops-title">{rtl ? "تعرّف إلى صُنّاع محليين" : "Meet local makers"}</h2></div><span className="sample-caption">{rtl ? "متاجر افتراضية" : "Sample shops"}</span></div><div className="shop-strip">{showcaseShops.map((shop) => <Link className="featured-shop-card" key={shop.id} to={`${shopHref(locale, shop.slug)}?showcase=1`}><span className="shop-mark">{shop.mark}</span><span><strong>{rtl ? shop.name_ar : shop.name_en}</strong><small>{rtl ? shop.note_ar : shop.note_en}</small></span><span className="shop-arrow" aria-hidden="true">↗</span></Link>)}</div></section>}
    </main>
    <footer className="site-footer"><Link className="wordmark footer-brand" to={`/${locale}`}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>{text.brand}</span></Link><p>{text.foot}</p><span>© {new Date().getFullYear()} BNAFSAJI</span></footer>
  </div>;
}
