import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { formatJod, productHref } from "../lib/catalog.js";
import ProductImageManager from "../components/product-image-manager.jsx";
import { PortalNavigation } from "../components/portal-navigation.jsx";

const COPY = {
  en: { title: "Seller catalog", intro: "Create a bilingual product and publish it to your approved shop.", shop: "Shop", open: "Open shop", create: "Create product", category: "Category", selectCategory: "Select a category", titleAr: "Product name in Arabic", titleEn: "Product name in English", descriptionAr: "Description in Arabic", descriptionEn: "Description in English", variants: "Purchasable variants", addVariant: "Add variant", removeVariant: "Remove variant", sku: "SKU (leave blank to generate)", price: "Price (JOD)", supply: "Supply method", stocked: "Pre-stocked", afterOrder: "Obtained after order", stock: "Available quantity", options: "Bilingual options (leave empty for the default SKU)", optionLabelAr: "Option name in Arabic", optionLabelEn: "Option name in English", optionValueAr: "Value in Arabic", optionValueEn: "Value in English", addOption: "Add option", removeOption: "Remove option", save: "Publish product", products: "Your products", empty: "No products yet.", signedOut: "Sign in to manage your seller catalog.", noShop: "An approved shop with Catalog access is required.", unavailable: "The seller catalog could not be loaded.", noCategories: "No approved categories are available.", success: "Product published.", invalid: "Check product text, price, stock, category and variant options.", failed: "The product could not be published.", published: "Published", draft: "Draft", pending_review: "Pending review", suspended: "Suspended", archived: "Archived", manageStaff: "Manage shop staff", back: "Back to marketplace", publicProduct: "View product" },
  ar: { title: "كتالوج البائع", intro: "أنشئ منتجاً باللغتين وانشره في متجرك المعتمد.", shop: "المتجر", open: "فتح المتجر", create: "إنشاء منتج", category: "الفئة", selectCategory: "اختر فئة", titleAr: "اسم المنتج بالعربية", titleEn: "اسم المنتج بالإنجليزية", descriptionAr: "الوصف بالعربية", descriptionEn: "الوصف بالإنجليزية", variants: "الخيارات القابلة للشراء", addVariant: "إضافة خيار", removeVariant: "حذف الخيار", sku: "رمز SKU (اتركه فارغاً لإنشاء رمز تلقائي)", price: "السعر (دينار أردني)", supply: "طريقة التوفير", stocked: "متوفر مسبقاً", afterOrder: "يُوفّر بعد الطلب", stock: "الكمية المتاحة", options: "الخيارات باللغتين (اتركها فارغة للرمز الافتراضي)", optionLabelAr: "اسم الخيار بالعربية", optionLabelEn: "اسم الخيار بالإنجليزية", optionValueAr: "القيمة بالعربية", optionValueEn: "القيمة بالإنجليزية", addOption: "إضافة خاصية", removeOption: "حذف الخاصية", save: "نشر المنتج", products: "منتجاتك", empty: "لا توجد منتجات بعد.", signedOut: "سجّل الدخول لإدارة كتالوج متجرك.", noShop: "يلزم متجر معتمد وصلاحية المنتجات.", unavailable: "تعذر تحميل كتالوج البائع.", noCategories: "لا توجد فئات معتمدة.", success: "تم نشر المنتج.", invalid: "تحقق من النص والسعر والكمية والفئة والخيارات.", failed: "تعذر نشر المنتج.", status: "منشور", published: "منشور", draft: "مسودة", pending_review: "قيد المراجعة", suspended: "موقوف", archived: "مؤرشف", manageStaff: "إدارة فريق المتجر", back: "العودة إلى السوق", publicProduct: "عرض المنتج" },
};

const PREVIEW_COPY = {
  en: { preview: "Live listing preview · not saved", previewArabic: "Arabic preview", previewEnglish: "English preview", previewTitle: "Product name will appear here", previewDescription: "Product description will appear here." },
  ar: { preview: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0646\u062a\u062c \u0645\u0628\u0627\u0634\u0631\u0629 \u00b7 \u063a\u064a\u0631 \u0645\u062d\u0641\u0648\u0638\u0629", previewArabic: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629", previewEnglish: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0628\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629", previewTitle: "\u0633\u064a\u0638\u0647\u0631 \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062a\u062c \u0647\u0646\u0627", previewDescription: "\u0633\u064a\u0638\u0647\u0631 \u0648\u0635\u0641 \u0627\u0644\u0645\u0646\u062a\u062c \u0647\u0646\u0627." },
};

const STOCK_COPY = {
  en: { stockNow: "Available", delta: "Change (+/-)", reason: "Reason", adjust: "Adjust stock", history: "Recent stock changes", before: "Before", after: "After", stockSuccess: "Stock updated.", adjustFailed: "Stock could not be updated. Check access, quantity and reason.", edit: "Edit listing", saveChanges: "Save listing changes", cancelEdit: "Cancel editing", editing: "Editing product", editSuccess: "Product updated.", immutableStock: "Change stock separately using the audited adjustment control." },
  ar: { stockNow: "الكمية المتاحة", delta: "التغيير (+/-)", reason: "السبب", adjust: "تعديل المخزون", history: "تغييرات المخزون الأخيرة", before: "قبل", after: "بعد", stockSuccess: "تم تحديث المخزون.", adjustFailed: "تعذر تحديث المخزون. تحقق من الصلاحية والكمية والسبب.", edit: "تعديل المنتج", saveChanges: "حفظ التعديلات", cancelEdit: "إلغاء التعديل", editing: "تعديل المنتج", editSuccess: "تم تحديث المنتج.", immutableStock: "عدّل المخزون بشكل منفصل من خلال سجل التعديلات." },
};

export function meta() {
  return [{ title: "Seller catalog | BNAFSAJI" }, { name: "robots", content: "noindex,nofollow" }];
}
export { action, loader } from "../lib/seller-products.server.js";

function emptyVariant() {
  return { sku: "", price: "", supply_mode: "after_order", stock_quantity: "", option_values: [] };
}

function VariantEditor({ locale, copy, variants, setVariants, editing }) {
  const update = (index, key, value) => setVariants((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const updateOption = (variantIndex, optionIndex, key, value) => setVariants((current) => current.map((variant, i) => i !== variantIndex ? variant : {
    ...variant, option_values: variant.option_values.map((option, j) => j === optionIndex ? { ...option, [key]: value } : option),
  }));
  const addOption = (variantIndex) => setVariants((current) => current.map((variant, i) => i === variantIndex ? {
    ...variant, option_values: [...variant.option_values, { label_ar: "", label_en: "", value_ar: "", value_en: "" }],
  } : variant));
  const removeOption = (variantIndex, optionIndex) => setVariants((current) => current.map((variant, i) => i === variantIndex ? {
    ...variant, option_values: variant.option_values.filter((_, j) => j !== optionIndex),
  } : variant));

  return <>
    {variants.map((variant, index) => <fieldset className="account-form" key={variant.key}>
      <legend>{copy.variants} {index + 1}</legend>
      <label>{copy.sku}<input value={variant.sku} maxLength={100} onChange={(event) => update(index, "sku", event.currentTarget.value)} /></label>
      <label>{copy.price}<input type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,3})?" minLength={1} maxLength={17} value={variant.price} required onChange={(event) => update(index, "price", event.currentTarget.value)} /></label>
      <label>{copy.supply}<select disabled={editing} value={variant.supply_mode} onChange={(event) => update(index, "supply_mode", event.currentTarget.value)}><option value="stocked">{copy.stocked}</option><option value="after_order">{copy.afterOrder}</option></select></label>
      {variant.supply_mode === "stocked" && <label>{copy.stock}<input type="number" min="0" max="2147483647" step="1" value={variant.stock_quantity} readOnly={editing} required onChange={(event) => update(index, "stock_quantity", event.currentTarget.value === "" ? "" : Number(event.currentTarget.value))} /></label>}
      {editing && <small>{copy.immutableStock}</small>}
      <h3>{copy.options}</h3>
      {variant.option_values.map((option, optionIndex) => <div className="account-form" key={optionIndex}>
        <label>{copy.optionLabelAr}<input dir="rtl" maxLength={80} required value={option.label_ar} onChange={(event) => updateOption(index, optionIndex, "label_ar", event.currentTarget.value)} /></label>
        <label>{copy.optionLabelEn}<input dir="ltr" maxLength={80} required value={option.label_en} onChange={(event) => updateOption(index, optionIndex, "label_en", event.currentTarget.value)} /></label>
        <label>{copy.optionValueAr}<input dir="rtl" maxLength={80} required value={option.value_ar} onChange={(event) => updateOption(index, optionIndex, "value_ar", event.currentTarget.value)} /></label>
        <label>{copy.optionValueEn}<input dir="ltr" maxLength={80} required value={option.value_en} onChange={(event) => updateOption(index, optionIndex, "value_en", event.currentTarget.value)} /></label>
        <button type="button" className="button button-secondary" onClick={() => removeOption(index, optionIndex)}>{copy.removeOption}</button>
      </div>)}
      {!editing && variant.option_values.length < 8 && <button type="button" className="button button-secondary" onClick={() => addOption(index)}>{copy.addOption}</button>}
      {!editing && variants.length > 1 && <button type="button" className="button button-secondary" onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}>{copy.removeVariant}</button>}
    </fieldset>)}
    {!editing && variants.length < 50 && <button type="button" className="button button-secondary" onClick={() => setVariants((current) => [...current, { ...emptyVariant(), key: crypto.randomUUID() }])}>{copy.addVariant}</button>}
  </>;
}

function StockAdjustmentForm({ shopId, variant, text }) {
  const formRef = useRef(null);
  const result = useActionData();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle" && navigation.formData?.get("intent") === "adjust-stock" && navigation.formData?.get("variant_id") === variant.id;
  useEffect(() => {
    if (result?.stockSuccess && result.variantId === variant.id) formRef.current?.reset();
  }, [result?.stockSuccess, result?.variantId, result?.adjustmentId, variant.id]);
  function preserveRetryKey(event) {
    const input = event.currentTarget.elements.namedItem("adjustment_id");
    try {
      const storageKey = `bnafsaji-stock-adjustment:${variant.id}`;
      const saved = sessionStorage.getItem(storageKey);
      if (saved) input.value = saved;
      else sessionStorage.setItem(storageKey, input.value);
    } catch { /* The submitted form value remains a valid one-request key. */ }
  }
  return <Form method="post" className="account-form" ref={formRef} aria-busy={busy} onSubmit={preserveRetryKey}>
    <input type="hidden" name="intent" value="adjust-stock" /><input type="hidden" name="shop_id" value={shopId} /><input type="hidden" name="variant_id" value={variant.id} /><input type="hidden" name="adjustment_id" value={variant.adjustment_id} />
    <label>{text.delta}<input name="delta" type="number" min="-2147483647" max="2147483647" step="1" required /></label>
    <label>{text.reason}<input name="reason" maxLength={300} required /></label><button className="button button-secondary" disabled={busy}>{busy ? `${text.adjust}…` : text.adjust}</button>
  </Form>;
}

export default function SellerProductsRoute() {
  const data = useLoaderData();
  return <SellerCatalog key={data.shop?.shop_id ?? data.state} catalog={data} />;
}

function SellerCatalog({ catalog }) {
  const { locale, state, shops, shop, categories, products, stockAdjustments = [], ownerAccess = false } = catalog;
  const data = useActionData();
  const navigation = useNavigation();
  const savingProduct = navigation.state !== "idle" && ["create-product", "update-product"].includes(navigation.formData?.get("intent"));
  const text = { ...COPY[locale], ...STOCK_COPY[locale], ...PREVIEW_COPY[locale] };
  const rtl = locale === "ar";
  const formRef = useRef(null);
  const editorRef = useRef(null);
  const [variants, setVariants] = useState([{ ...emptyVariant(), key: "default" }]);
  const [productText, setProductText] = useState({ title_ar: "", title_en: "", description_ar: "", description_en: "" });
  const [editing, setEditing] = useState(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogStatus, setCatalogStatus] = useState("all");
  function updateProductText(event) {
    const { name, value } = event.currentTarget;
    setProductText((current) => ({ ...current, [name]: value }));
  }
  const searchTerm = catalogSearch.trim().toLocaleLowerCase(locale);
  const visibleProducts = products.filter((product) =>
    (catalogStatus === "all" || product.status === catalogStatus) &&
    (!searchTerm || [product.title_ar, product.title_en, product.slug, ...product.variants.map((variant) => variant.sku)].some((value) => String(value ?? "").toLocaleLowerCase(locale).includes(searchTerm)))
  );
  useEffect(() => {
    if (editing) {
      setProductText({ title_ar: editing.title_ar ?? "", title_en: editing.title_en ?? "", description_ar: editing.description_ar ?? "", description_en: editing.description_en ?? "" });
      if (editorRef.current) editorRef.current.open = true;
      formRef.current?.querySelector('[name="title_ar"]')?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (data?.stockSuccess && data.variantId) {
      try { sessionStorage.removeItem(`bnafsaji-stock-adjustment:${data.variantId}`); } catch { /* Storage is optional. */ }
    }
    if (data?.success || data?.updated) {
      formRef.current?.reset();
      setVariants([{ ...emptyVariant(), key: "default" }]);
      setProductText({ title_ar: "", title_en: "", description_ar: "", description_en: "" });
      setEditing(null);
      if (editorRef.current) editorRef.current.open = false;
    }
  }, [data?.success, data?.updated, data?.stockSuccess, data?.variantId, data?.adjustmentId]);
  return <main className="account-shell" lang={locale} dir={rtl ? "rtl" : "ltr"}>
    <Link to={`/${locale}`} className="account-back">{text.back}</Link>
    <PortalNavigation locale={locale} section="seller" current="/seller/products" ownerAccess={ownerAccess} />
    <section className="account-card seller-application-card"><h1>{text.title}</h1><p>{text.intro}</p>
      {state === "signed-out" ? <p><Link to={`/${locale}/account`}>{text.signedOut}</Link></p> : state === "no-shop" ? <p>{text.noShop}</p> : state !== "ready" ? <p role="status">{state === "unconfigured" ? "Supabase is not configured." : text.unavailable}</p> : <>
        {shops.length > 1 && <Form method="get" className="account-form"><label>{text.shop}<select name="shop_id" defaultValue={shop.shop_id}>{shops.map((item) => <option key={item.shop_id} value={item.shop_id}>{rtl ? item.name_ar : item.name_en}</option>)}</select></label><button className="button button-secondary">{text.open}</button></Form>}
        {ownerAccess && <p><Link to={`/${locale}/seller/staff`}>{text.manageStaff}</Link></p>}
        {data?.success && <p role="status">{text.success}</p>}{data?.updated && <p role="status">{text.editSuccess}</p>}{data?.stockSuccess && <p role="status">{text.stockSuccess}</p>}{data?.error && <p role="alert">{data.error === "invalid" ? text.invalid : data.error === "stock-failed" ? text.adjustFailed : text.failed}</p>}
        {categories.length ? <details className="seller-editor" ref={editorRef}><summary>{editing ? text.editing : text.create}</summary><Form key={editing?.product_id ?? "new"} method="post" className="account-form" ref={formRef} aria-busy={savingProduct}>
          <input type="hidden" name="intent" value={editing ? "update-product" : "create-product"} />
          <input type="hidden" name="shop_id" value={shop.shop_id} />
          {editing && <input type="hidden" name="product_id" value={editing.product_id} />}
          <label>{text.category}<select name="category_id" required defaultValue={editing?.category_id ?? ""}><option value="" disabled>{text.selectCategory}</option>{categories.map((category) => <option key={category.id} value={category.id}>{rtl ? category.name_ar : category.name_en}</option>)}</select></label>
          <label>{text.titleAr}<input name="title_ar" dir="rtl" required maxLength={200} value={productText.title_ar} onChange={updateProductText} /></label>
          <label>{text.titleEn}<input name="title_en" dir="ltr" required maxLength={200} value={productText.title_en} onChange={updateProductText} /></label>
          <label>{text.descriptionAr}<textarea name="description_ar" dir="rtl" maxLength={10000} value={productText.description_ar} onChange={updateProductText} /></label>
          <label>{text.descriptionEn}<textarea name="description_en" dir="ltr" maxLength={10000} value={productText.description_en} onChange={updateProductText} /></label>
          <details className="listing-preview">
            <summary>{text.preview}</summary>
            <div className="listing-preview-grid">
              <article lang="ar" dir="rtl"><h3>{text.previewArabic}</h3><h4>{productText.title_ar.trim() || text.previewTitle}</h4><p>{productText.description_ar.trim() || text.previewDescription}</p></article>
              <article lang="en" dir="ltr"><h3>{text.previewEnglish}</h3><h4>{productText.title_en.trim() || text.previewTitle}</h4><p>{productText.description_en.trim() || text.previewDescription}</p></article>
            </div>
          </details>
          <VariantEditor locale={locale} copy={text} variants={variants} setVariants={setVariants} editing={Boolean(editing)} />
          <input type="hidden" name="variants_json" value={JSON.stringify(variants.map(({ key, ...variant }) => ({
            ...variant,
            stock_quantity: variant.supply_mode === "stocked" && variant.stock_quantity !== "" ? Number(variant.stock_quantity) : null,
          })))} />
          <button className="button button-primary" disabled={savingProduct}>{editing ? text.saveChanges : text.save}</button>{savingProduct && <span role="status">{rtl ? "جارٍ حفظ المنتج…" : "Saving product…"}</span>}{editing && <button type="button" className="button button-secondary" disabled={savingProduct} onClick={() => { if (editorRef.current) editorRef.current.open = false; setEditing(null); setProductText({ title_ar: "", title_en: "", description_ar: "", description_en: "" }); setVariants([{ ...emptyVariant(), key: "default" }]); }}>{text.cancelEdit}</button>}
        </Form></details> : <p role="status">{text.noCategories}</p>}
        <h2>{text.products}</h2>{products.length ? <>
          <div className="account-form">
            <label>{rtl ? "ابحث عن منتج أو رمز SKU" : "Search products or SKUs"}<input type="search" value={catalogSearch} onChange={(event) => setCatalogSearch(event.currentTarget.value)} /></label>
            <label>{rtl ? "حالة المنتج" : "Product status"}<select value={catalogStatus} onChange={(event) => setCatalogStatus(event.currentTarget.value)}><option value="all">{rtl ? "كل الحالات" : "All statuses"}</option>{["published", "draft", "pending_review", "suspended", "archived"].map((status) => <option key={status} value={status}>{text[status]}</option>)}</select></label>
          </div>
          {visibleProducts.length ? <ul className="account-results">{visibleProducts.map((product) => {
          const minPrice = product.variants.reduce((min, item) => Math.min(min, Number(item.price_fils)), Number.POSITIVE_INFINITY);
          const href = productHref(locale, shop.shop_slug, product.slug);
          return <li key={product.product_id}><div><strong>{rtl ? product.title_ar : product.title_en}</strong><div>{text[product.status] ?? product.status} · {Number.isFinite(minPrice) ? formatJod(minPrice, locale) : "—"}</div><div>{product.variants.length} {text.variants.toLowerCase()}</div><button type="button" className="button button-secondary" onClick={() => { setEditing({ ...product }); setVariants(product.variants.map((variant) => ({ ...variant, variant_id: variant.id, price: (Number(variant.price_fils) / 1000).toFixed(3), stock_quantity: variant.stock_quantity ?? "", key: variant.id }))); }}>{text.edit}</button>
            <details className="seller-stock"><summary>{rtl ? "المخزون والخيارات" : "Stock and options"}</summary>
            {product.variants.map((variant) => <div className="account-form" key={variant.id}>
              <strong>{variant.sku}</strong> · {variant.option_values?.map((option) => `${rtl ? option.label_ar : option.label_en}: ${rtl ? option.value_ar : option.value_en}`).join(" / ") || text.stockNow}
              {variant.supply_mode === "stocked" ? <><div>{text.stockNow}: {variant.stock_quantity}</div><StockAdjustmentForm shopId={shop.shop_id} variant={variant} text={text} /></> : <div>{text.afterOrder}</div>}
            </div>)}</details>
          </div>{product.status === "published" && <Link to={href}>{text.publicProduct}</Link>}<ProductImageManager locale={locale} shopId={shop.shop_id} productId={product.product_id} /></li>;
        })}</ul> : <p role="status">{rtl ? "لا توجد منتجات تطابق البحث أو الحالة المحددة." : "No products match that search or status."}</p>}
        </> : <p>{text.empty}</p>}
        <h2>{text.history}</h2><ul className="account-results">{stockAdjustments.map((item) => <li key={item.adjustment_id}><div><strong>{rtl ? item.product_title_ar : item.product_title_en} · {item.sku}</strong><div>{item.delta > 0 ? "+" : ""}{item.delta} · {text.before}: {item.quantity_before} · {text.after}: {item.quantity_after}</div><div>{item.reason} · {item.actor_email}</div></div></li>)}</ul>
      </>}
    </section>
  </main>;
}
