const supportedLocales = new Set(["ar", "en"]);

export function normalizeLocale(value) {
  return supportedLocales.has(value) ? value : null;
}

export function productHref(locale, shopSlug, productSlug) {
  if (!normalizeLocale(locale) || !shopSlug || !productSlug) return null;
  return `/${locale}/p/${encodeURIComponent(shopSlug)}/${encodeURIComponent(productSlug)}`;
}

export function shopHref(locale, shopSlug) {
  if (!normalizeLocale(locale) || !shopSlug) return null;
  return `/${locale}/s/${encodeURIComponent(shopSlug)}`;
}

export function localizedSeoLinks(siteUrl, path, locale = "ar") {
  if (!normalizeLocale(locale) || typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return [];
  let origin;
  try {
    const url = new URL(siteUrl);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return [];
    origin = url.origin;
  } catch {
    return [];
  }
  const localizedPath = (language) => new URL(`/${language}${path}`, origin).href;
  return [
    { tagName: "link", rel: "canonical", href: localizedPath(locale) },
    { tagName: "link", rel: "alternate", hrefLang: "ar-JO", href: localizedPath("ar") },
    { tagName: "link", rel: "alternate", hrefLang: "en-JO", href: localizedPath("en") },
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: localizedPath("ar") },
  ];
}

export function formatJod(amountFils, locale) {
  const fils = Number(amountFils);
  if (!Number.isSafeInteger(fils) || fils < 0) throw new TypeError("Catalog prices must be integer fils.");
  return new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-JO", {
    style: "currency", currency: "JOD", minimumFractionDigits: 3, maximumFractionDigits: 3,
  }).format(fils / 1000);
}

export function parseJodPriceFilter(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{1,13}(?:\.\d{1,3})?$/.test(value)) {
    throw new TypeError("Price filters must be non-negative JOD amounts with up to three decimals.");
  }
  const [whole, fraction = ""] = value.split(".");
  const fils = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0") || "0");
  if (fils > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError("Price filter is outside the supported range.");
  return Number(fils);
}
