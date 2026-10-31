export function publicSiteUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function authConfigured(env) {
  return Boolean(publicSiteUrl(env?.SUPABASE_URL) && env?.SUPABASE_PUBLISHABLE_KEY && publicSiteUrl(env?.PUBLIC_SITE_URL));
}

export function sameOriginPost(request, configuredSiteUrl) {
  const siteOrigin = publicSiteUrl(configuredSiteUrl);
  const requestOrigin = publicSiteUrl(request.url);
  const suppliedOrigin = publicSiteUrl(request.headers.get("Origin"));
  return Boolean(siteOrigin && requestOrigin === siteOrigin && suppliedOrigin === siteOrigin);
}

export function safeMfaReturnTo(value, locale) {
  const allowed = ["/admin", "/owner", "/owner/admins", "/owner/delivery", "/admin/sellers", "/admin/categories"];
  return allowed.some((path) => value === `/${locale}${path}`) ? value : `/${locale}/account`;
}
