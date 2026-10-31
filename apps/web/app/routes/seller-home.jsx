import { useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { PortalNavigation } from "../components/portal-navigation.jsx";
import { loader } from "../lib/seller-home.server.js";
import { formatJod } from "../lib/catalog.js";

export { loader };

const COPY = {
  en: {
    title: "Seller workspace", intro: "A clear path to opening and running your shop.", apply: "Apply to sell", application: "Seller application", draft: "Draft saved", submitted: "Under review", rejected: "Changes requested", approved: "Approved",
    products: "Create your first product", productsDone: "Products are listed", delivery: "Set your Amman delivery fee", deliveryDone: "Delivery fee is set", staff: "Manage shop team", guide: "Getting started", hide: "Dismiss guide", show: "Show setup guide", complete: "Complete", open: "Open", continue: "Continue", signIn: "Sign in to open your seller workspace.", unconfigured: "Seller tools are unavailable until Supabase is configured.", unavailable: "We could not load your seller setup. Please try again.", noApplication: "Start an application to open a seller shop.", pending: "Your application is under review. You can return here for updates.", rejectedHelp: "Update your application and resubmit it for review.", shop: "Shop", staffRole: "You have catalog access. Ask your shop owner to configure delivery and team access.", back: "Back to marketplace",
  },
  ar: {
    title: "مساحة البائع", intro: "خطوات واضحة لفتح متجرك وإدارته.", apply: "قدّم طلب البيع", application: "طلب البائع", draft: "المسودة محفوظة", submitted: "قيد المراجعة", rejected: "مطلوب تعديلات", approved: "تمت الموافقة",
    products: "أضف منتجك الأول", productsDone: "تم إدراج منتجات", delivery: "حدّد رسوم التوصيل في عمّان", deliveryDone: "تم تحديد رسوم التوصيل", staff: "إدارة فريق المتجر", guide: "خطوات البدء", hide: "إخفاء الدليل", show: "عرض دليل الإعداد", complete: "مكتمل", open: "فتح", continue: "متابعة", signIn: "سجّل الدخول لفتح مساحة البائع.", unconfigured: "أدوات البائع غير متاحة قبل إعداد Supabase.", unavailable: "تعذر تحميل إعدادات البائع. حاول مرة أخرى.", noApplication: "ابدأ طلباً لفتح متجر بائع.", pending: "طلبك قيد المراجعة. يمكنك العودة لمتابعة مستجداته.", rejectedHelp: "عدّل الطلب وأعد إرساله للمراجعة.", shop: "المتجر", staffRole: "لديك صلاحية إدارة المنتجات. اطلب من مالك المتجر إعداد التوصيل والفريق.", back: "العودة إلى السوق",
  },
};

export function meta() { return [{ title: "Seller workspace | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }]; }

function ShowcaseDashboard({ data }) {
  const rtl = data.locale === "ar";
  const values = data.sales.map((point) => point.revenue_fils);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const points = values.map((value, index) => `${40 + (560 / (values.length - 1)) * index},${180 - ((value - low) / (high - low || 1)) * 138}`).join(" ");
  const text = rtl ? {
    title: "نظرة عامة على المتجر", intro: "تابع أداء منتجاتك وطلباتك من مكان واحد.", preview: "معاينة محلية · بيانات افتراضية", note: "هذه الأرقام للعرض فقط، وليست مبيعات حقيقية.", revenue: "المبيعات", orders: "الطلبات", products: "المنتجات المنشورة", rating: "تقييم المتجر", trend: "المبيعات خلال آخر 8 أسابيع", chartSummary: `ارتفعت المبيعات من ${formatJod(data.sales[0].revenue_fils, "ar")} إلى ${formatJod(data.sales.at(-1).revenue_fils, "ar")} خلال 8 أسابيع.`, week: "الأسبوع", amount: "المبيعات بالدينار", recent: "طلبات نموذجية", order: "رقم الطلب", items: "المنتجات", status: "الحالة", total: "الإجمالي", top: "منتجات للعرض", seller: "مساحة البائع", back: "العودة إلى السوق", productNames: ["كنزة بنفسجية بتطريز يدوي", "حقيبة قماش يومية", "حذاء رياضي بنفسجي"], sold: ["مبيعات نموذجية: 24", "مبيعات نموذجية: 18", "مبيعات نموذجية: 13"], language: "EN",
  } : {
    title: "Shop overview", intro: "See product activity and order progress in one place.", preview: "Local preview · Sample data", note: "These figures are illustrative, not real sales.", revenue: "Sales", orders: "Orders", products: "Published products", rating: "Shop rating", trend: "Sales over the last 8 weeks", chartSummary: `Sales rise from ${formatJod(data.sales[0].revenue_fils, "en")} in week 1 to ${formatJod(data.sales.at(-1).revenue_fils, "en")} in week 8.`, week: "Week", amount: "Sales (JOD)", recent: "Example orders", order: "Order", items: "Items", status: "Status", total: "Total", top: "Products in this preview", seller: "Seller workspace", back: "Back to marketplace", productNames: ["Violet embroidered hoodie", "Everyday canvas tote", "Violet street sneakers"], sold: ["Sample sales: 24", "Sample sales: 18", "Sample sales: 13"], language: "عربي",
  };
  const area = `M ${points.split(" ")[0]} L ${points.replaceAll(" ", " L ")} L 600 202 L 40 202 Z`;
  return <main className="seller-dashboard" lang={data.locale} dir={rtl ? "rtl" : "ltr"}>
    <header className="dashboard-topbar"><Link className="wordmark" to={`/${data.locale}`}><img className="brand-logo" src="/bnafsaji.svg" alt="" width="36" height="36" /><span>BNAFSAJI</span></Link><span className="dashboard-user-mark" aria-hidden="true">S</span></header>
    <div className="dashboard-frame"><aside className="dashboard-rail"><p className="dashboard-rail-label">{text.seller}</p><a className="dashboard-rail-link is-current" href="#overview">◫ <span>{rtl ? "نظرة عامة" : "Overview"}</span></a><a className="dashboard-rail-link" href="#products">▧ <span>{rtl ? "المنتجات" : "Products"}</span></a><a className="dashboard-rail-link" href="#orders">▤ <span>{rtl ? "الطلبات" : "Orders"}</span></a><Link className="dashboard-rail-link" to={`/${data.locale}`}>⌂ <span>{text.back}</span></Link></aside>
      <section className="dashboard-main" id="overview"><div className="dashboard-heading"><div><p className="eyebrow">{text.seller}</p><h1>{text.title}</h1><p>{text.intro}</p></div><Link className="language-link" to={`/${rtl ? "en" : "ar"}/seller?showcase=1`}>{text.language}</Link></div>
        <div className="sample-warning"><strong>{text.preview}</strong><span>{text.note}</span></div>
        <section className="metric-grid" aria-label={text.preview}><article className="metric-card"><span>{text.revenue}</span><strong>{formatJod(data.metrics.revenue_fils, data.locale)}</strong><small>{rtl ? "آخر 30 يوماً" : "Last 30 days"}</small></article><article className="metric-card"><span>{text.orders}</span><strong>{data.metrics.orders}</strong><small>{rtl ? "طلب افتراضي" : "Sample orders"}</small></article><article className="metric-card"><span>{text.products}</span><strong>{data.metrics.products}</strong><small>{rtl ? "منتج افتراضي" : "Sample products"}</small></article><article className="metric-card"><span>{text.rating}</span><strong>★ {data.metrics.average_rating}</strong><small>{rtl ? "تقييم افتراضي" : "Sample rating"}</small></article></section>
        <section className="dashboard-panel sales-panel" aria-labelledby="sales-title"><div className="panel-heading"><div><h2 id="sales-title">{text.trend}</h2><p>{text.chartSummary}</p></div><span className="chart-key"><i /> {text.revenue}</span></div><svg className="sales-chart" viewBox="0 0 640 230" role="img" aria-labelledby="sales-chart-title sales-chart-description"><title id="sales-chart-title">{text.trend}</title><desc id="sales-chart-description">{text.chartSummary}</desc><path className="chart-gridline" d="M40 42H600M40 96H600M40 150H600M40 202H600" /><path className="chart-area" d={area} /><polyline className="chart-line" points={points} />{points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle className="chart-point" key={data.sales[index].label} cx={cx} cy={cy} r="5"><title>{`${data.sales[index].label}: ${formatJod(data.sales[index].revenue_fils, data.locale)}`}</title></circle>; })}{data.sales.map((point, index) => <text className="chart-label" key={point.label} x={40 + (560 / (data.sales.length - 1)) * index} y="224" textAnchor="middle">{index + 1}</text>)}</svg><table className="chart-data-table"><caption>{text.trend}</caption><thead><tr><th scope="col">{text.week}</th><th scope="col">{text.amount}</th><th scope="col">{rtl ? "الطلبات" : "Orders"}</th></tr></thead><tbody>{data.sales.map((point, index) => <tr key={point.label}><th scope="row">{index + 1}</th><td>{formatJod(point.revenue_fils, data.locale)}</td><td>{point.orders}</td></tr>)}</tbody></table></section>
        <div className="dashboard-columns"><section className="dashboard-panel" id="orders" aria-labelledby="orders-title"><div className="panel-heading"><h2 id="orders-title">{text.recent}</h2><span className="sample-caption">{rtl ? "عينات" : "Examples"}</span></div><div className="orders-list">{data.recentOrders.map((order) => <article className="sample-order" key={order.id}><div><strong>{order.id}</strong><span>{order.items} {text.items.toLocaleLowerCase()}</span></div><span className="sample-status">{rtl ? order.status_ar : order.status_en}</span><strong>{formatJod(order.amount_fils, data.locale)}</strong></article>)}</div></section>
          <section className="dashboard-panel" id="products" aria-labelledby="products-title"><div className="panel-heading"><h2 id="products-title">{text.top}</h2><span className="sample-caption">{rtl ? "عينات" : "Examples"}</span></div><div className="sample-products-list">{data.products.map((product, index) => <article className="sample-product-row" key={product.id}><img src={product.images[0].src} alt="" width="64" height="64" /><div><strong>{rtl ? product.title_ar : product.title_en}</strong><span>{text.sold[index]}</span></div><b>{formatJod(product.price_fils, data.locale)}</b></article>)}</div></section></div>
        <p className="dashboard-footnote">{rtl ? "المنتجات والطلبات والمبيعات هنا تجريبية. البيانات الفعلية تحتاج إلى متجر بائع معتمد واتصال قاعدة البيانات." : "Products, orders and sales here are sample content. Live figures require an approved seller shop and connected database."}</p>
      </section></div>
  </main>;
}

function Step({ done, href, title, complete, open, continueLabel }) {
  return <li className="seller-setup-step">
    <span className="seller-setup-indicator" aria-hidden="true">{done ? "✓" : ""}</span>
    <div><strong>{title}</strong>{done && <small>{complete}</small>}</div>
    {href && <Link className="button button-secondary" to={href}>{done ? open : continueLabel}</Link>}
  </li>;
}

export default function SellerHomeRoute() {
  const data = useLoaderData();
  const text = COPY[data.locale];
  const rtl = data.locale === "ar";
  const key = `bnafsaji-seller-guide:${data.userId ?? "guest"}`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { setDismissed(localStorage.getItem(key) === "dismissed"); } catch { /* Guide remains available when storage is disabled. */ }
  }, [key]);
  function dismiss() {
    try { localStorage.setItem(key, "dismissed"); } catch { /* Dismissal is a convenience only. */ }
    setDismissed(true);
  }
  function showGuide() {
    try { localStorage.removeItem(key); } catch { /* The current view can still be reopened. */ }
    setDismissed(false);
  }

  if (data.state === "showcase") return <ShowcaseDashboard data={data} />;

  return <main className="account-shell" lang={data.locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${data.locale}`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={data.locale} section="seller" current="/seller" ownerAccess={data.isOwner} />
    <section className="account-card seller-application-card seller-home-card">
      <p className="eyebrow">BNAFSAJI SELLER</p><h1>{text.title}</h1><p>{text.intro}</p>
      {data.state === "signed-out" ? <p><Link to={`/${data.locale}/account`}>{text.signIn}</Link></p> : data.state === "unconfigured" ? <p role="status">{text.unconfigured}</p> : data.state === "unavailable" ? <p role="alert">{text.unavailable}</p> : data.state === "application" ? <>
        <h2>{text.application}</h2>
        {!data.application ? <><p>{text.noApplication}</p><Link className="button button-primary" to={`/${data.locale}/seller/apply`}>{text.apply}</Link></> : <>
          <p role="status"><strong>{text[data.application.status] ?? data.application.status}</strong></p>
          {data.application.status === "draft" || data.application.status === "rejected" ? <><p>{data.application.status === "rejected" ? text.rejectedHelp : text.noApplication}</p><Link className="button button-primary" to={`/${data.locale}/seller/apply`}>{text.apply}</Link></> : <p>{text.pending}</p>}
        </>}
      </> : <>
        <h2>{rtl ? data.shop.name_ar : data.shop.name_en}</h2>
        {!dismissed ? <section className="seller-setup-guide" aria-labelledby="seller-setup-title">
          <div className="seller-setup-heading"><h2 id="seller-setup-title">{text.guide}</h2><button type="button" className="button button-secondary" onClick={dismiss}>{text.hide}</button></div>
          <ol className="seller-setup-list">
            <Step done={data.productCount > 0} href={`/${data.locale}/seller/products`} title={data.productCount ? text.productsDone : text.products} complete={text.complete} open={text.open} continueLabel={text.continue} />
            {data.isOwner && <Step done={data.deliveryConfigured} href={`/${data.locale}/seller/delivery`} title={data.deliveryConfigured ? text.deliveryDone : text.delivery} complete={text.complete} open={text.open} continueLabel={text.continue} />}
          </ol>
          {!data.isOwner && <p className="seller-setup-note">{text.staffRole}</p>}
          {data.isOwner && <Link to={`/${data.locale}/seller/staff`}>{text.staff}</Link>}
        </section> : <button type="button" className="button button-secondary" onClick={showGuide}>{text.show}</button>}
        <p className="seller-setup-link"><Link to={`/${data.locale}/seller/products`}>{text.products}</Link>{data.isOwner && <> · <Link to={`/${data.locale}/seller/delivery`}>{text.delivery}</Link></>}</p>
      </>}
    </section>
  </main>;
}
