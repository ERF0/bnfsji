import { Link } from "react-router";

const sections = {
  seller: {
    en: [["/seller", "Overview"], ["/seller/products", "Products"], ["/seller/staff", "Shop team"], ["/seller/delivery", "Delivery fee"]],
    ar: [["/seller", "نظرة عامة"], ["/seller/products", "المنتجات"], ["/seller/staff", "فريق المتجر"], ["/seller/delivery", "رسوم التوصيل"]],
  },
  admin: {
    en: [["/admin", "Overview"], ["/admin/sellers", "Seller applications"], ["/admin/categories", "Category proposals"]],
    ar: [["/admin", "نظرة عامة"], ["/admin/sellers", "طلبات البائعين"], ["/admin/categories", "مقترحات الفئات"]],
  },
  owner: {
    en: [["/owner", "Overview"], ["/admin/sellers", "Seller applications"], ["/admin/categories", "Category proposals"], ["/owner/admins", "Platform admins"], ["/owner/delivery", "Platform delivery fee"]],
    ar: [["/owner", "نظرة عامة"], ["/admin/sellers", "طلبات البائعين"], ["/admin/categories", "مقترحات الفئات"], ["/owner/admins", "مسؤولو المنصة"], ["/owner/delivery", "رسوم توصيل المنصة"]],
  },
};

export function PortalNavigation({ locale, section, current, ownerAccess = false }) {
  const baseLabels = sections[section]?.[locale] ?? [];
  const ownerLabels = locale === "ar"
    ? [["/owner/admins", "مسؤولو المنصة"], ["/owner/delivery", "رسوم توصيل المنصة"]]
    : [["/owner/admins", "Platform admins"], ["/owner/delivery", "Platform delivery fee"]];
  const labels = section === "seller"
    ? [baseLabels[0], ...(ownerAccess ? [["/seller/shop", locale === "ar" ? "ملف المتجر" : "Shop profile"]] : []), baseLabels[1], ...(ownerAccess ? baseLabels.slice(2) : [])]
    : ownerAccess && section === "admin" ? [...baseLabels, ...ownerLabels] : baseLabels;
  return <nav className="portal-nav" aria-label={locale === "ar" ? "أدوات مساحة العمل" : "Workspace tools"}>
    {labels.map(([path, label]) => <Link key={path} to={`/${locale}${path}`} aria-current={current === path ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
