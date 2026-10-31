const productImages = {
  hoodie: "/showcase/hoodie.webp",
  tote: "/showcase/keyboard.webp",
  sneakers: "/showcase/plush.webp",
  earrings: "/showcase/sneakers.webp",
  candle: "/showcase/lamp.webp",
  wallet: "/showcase/figure.webp",
};
const option = (label_en, value_en, label_ar, value_ar) => ({ label_en, value_en, label_ar, value_ar });
const productOptions = [
  [option("Color", "Violet", "اللون", "بنفسجي"), option("Size", "M", "المقاس", "متوسط")],
  [option("Color", "Plum", "اللون", "برقوقي"), option("Material", "Canvas", "الخامة", "قماش كانفاس")],
  [option("Color", "Black", "اللون", "أسود"), option("Size", "39", "المقاس", "٣٩")],
  [option("Color", "Lilac", "اللون", "ليلكي"), option("Material", "Alloy", "الخامة", "سبيكة")],
  [option("Color", "Violet", "اللون", "بنفسجي"), option("Material", "Soy wax", "الخامة", "شمع الصويا")],
  [option("Color", "Brown", "اللون", "بني"), option("Material", "Leather", "الخامة", "جلد")],
];

export const showcaseCategories = [
  { slug: "clothing", name_en: "Clothing & shoes", name_ar: "الملابس والأحذية" },
  { slug: "electronics", name_en: "Electronics", name_ar: "إلكترونيات" },
  { slug: "toys", name_en: "Toys & figures", name_ar: "ألعاب ومجسمات" },
  { slug: "home", name_en: "Home", name_ar: "المنزل" },
];

export const showcaseShops = [
  { id: "sample-shop-luna", slug: "luna-store", name_en: "Luna Store", name_ar: "لونا", note_en: "Independent fashion", note_ar: "أزياء مستقلة", mark: "L" },
  { id: "sample-shop-game-station", slug: "game-station", name_en: "Game Station", name_ar: "محطة ألعاب", note_en: "Gear for your setup", note_ar: "ملحقات الألعاب", mark: "GS" },
  { id: "sample-shop-pixel-jo", slug: "pixel-jo", name_en: "Pixel.JO", name_ar: "بيكسل", note_en: "Desktop accessories", note_ar: "ملحقات الحاسوب", mark: "P" },
  { id: "sample-shop-kickz", slug: "kickz-jo", name_en: "Kickz JO", name_ar: "كيكز", note_en: "Everyday streetwear", note_ar: "أزياء يومية", mark: "K" },
  { id: "sample-shop-casa", slug: "casa-home", name_en: "Casa Home", name_ar: "كاسا هوم", note_en: "Details for your space", note_ar: "تفاصيل للمنزل", mark: "C" },
  { id: "sample-shop-anime", slug: "anime-world", name_en: "Anime World", name_ar: "عالم أنمي", note_en: "Figures and collectibles", note_ar: "مجسمات وقطع جمع", mark: "A" },
];

export const showcaseProducts = [
  { id: "a0000000-0000-4000-8000-000000000101", slug: "violet-embroidered-hoodie", shop: 0, category: "clothing", image: "hoodie", price_fils: 28500, title_en: "Violet embroidered hoodie", title_ar: "كنزة بنفسجية مطرزة", description_en: "A black hoodie with hand-finished violet embroidery.", description_ar: "كنزة سوداء بتطريز بنفسجي محلي.", badge_en: "Made in Amman", badge_ar: "صناعة عمّانية" },
  { id: "a0000000-0000-4000-8000-000000000102", slug: "violet-mechanical-keyboard", shop: 1, category: "electronics", image: "tote", price_fils: 14500, title_en: "Violet mechanical keyboard", title_ar: "لوحة مفاتيح بنفسجية", description_en: "A compact keyboard with lilac keycaps.", description_ar: "لوحة مفاتيح ميكانيكية بمفاتيح بنفسجية.", badge_en: "Small batch", badge_ar: "كمية محدودة" },
  { id: "a0000000-0000-4000-8000-000000000103", slug: "little-black-plush", shop: 2, category: "toys", image: "sneakers", price_fils: 42000, title_en: "Little black plush bear", title_ar: "دب أسود محشو", description_en: "A soft plush bear in a tiny lounge chair.", description_ar: "دب محشو ناعم مع أريكة صغيرة.", badge_en: "New", badge_ar: "جديد" },
  { id: "a0000000-0000-4000-8000-000000000104", slug: "black-violet-sneakers", shop: 3, category: "clothing", image: "earrings", price_fils: 9500, title_en: "Black violet sneakers", title_ar: "حذاء رياضي بتفاصيل بنفسجية", description_en: "Everyday sneakers with deep violet accents.", description_ar: "حذاء يومي مريح بتفاصيل بنفسجية.", badge_en: "Hand finished", badge_ar: "تشطيب يدوي" },
  { id: "a0000000-0000-4000-8000-000000000105", slug: "violet-bedside-lamp", shop: 4, category: "home", image: "candle", price_fils: 12000, title_en: "Violet bedside lamp", title_ar: "مصباح طاولة بنفسجي", description_en: "A warm accent lamp for a bedside table or reading nook.", description_ar: "مصباح صغير لطاولة السرير أو زاوية القراءة.", badge_en: "Popular", badge_ar: "اختيار محبوب" },
  { id: "a0000000-0000-4000-8000-000000000106", slug: "anime-collector-figure", shop: 5, category: "toys", image: "wallet", price_fils: 23000, title_en: "Anime collector figure", title_ar: "مجسم أنمي للجمع", description_en: "A detailed figure for an anime shelf or collector display.", description_ar: "مجسم مفصل للعرض والجمع.", badge_en: "Collector piece", badge_ar: "قطعة للجمع" },
].map((product, index) => {
  const shop = showcaseShops[product.shop];
  const category = showcaseCategories.find((item) => item.slug === product.category);
  const variantId = `b0000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`;
  const option_values = productOptions[index];
  return {
    ...product,
    sample: true,
    product_id: product.id,
    shop_id: shop.id,
    shop_slug: shop.slug,
    shop_name_en: shop.name_en,
    shop_name_ar: shop.name_ar,
    shops: { slug: shop.slug, name_en: shop.name_en, name_ar: shop.name_ar },
    categories: { slug: category.slug, name_en: category.name_en, name_ar: category.name_ar },
    images: [{ id: `sample-image-${product.image}`, src: productImages[product.image] }],
    option_values,
    product_variants: [{ id: variantId, price_fils: product.price_fils, option_values, supply_mode: index === 0 ? "after_order" : "stocked" }],
    supply_mode: index === 0 ? "after_order" : "stocked",
    variant_id: variantId,
    currency: "JOD",
  };
});

export function loadShowcaseCatalog({ query = "", category = null, sort = "newest", page = 1, minPriceFils = null, maxPriceFils = null, shop: shopSlug = null, fulfillment = null, optionFilters = [] } = {}) {
  const normalizedQuery = query.toLocaleLowerCase();
  const selectedByLabel = new Map();
  for (const filter of optionFilters) {
    const key = `${filter.label_en}\u0000${filter.label_ar}`;
    selectedByLabel.set(key, [...(selectedByLabel.get(key) ?? []), filter]);
  }
  let products = showcaseProducts.filter((product) => {
    const shopItem = showcaseShops[product.shop];
    return (!category || product.category === category) &&
      (!shopSlug || shopItem.slug === shopSlug) &&
      (!normalizedQuery || `${product.title_en} ${product.title_ar} ${shopItem.name_en} ${shopItem.name_ar}`.toLocaleLowerCase().includes(normalizedQuery)) &&
      (minPriceFils === null || product.price_fils >= minPriceFils) &&
      (maxPriceFils === null || product.price_fils <= maxPriceFils) &&
      [...selectedByLabel.values()].every((group) => product.option_values.some((value) =>
        value.label_en === group[0].label_en && value.label_ar === group[0].label_ar &&
        group.some((filter) => value.value_en === filter.value_en && value.value_ar === filter.value_ar))) &&
      (!fulfillment || product.supply_mode === fulfillment);
  });
  if (sort === "price_low") products = [...products].sort((left, right) => left.price_fils - right.price_fils);
  else if (sort === "price_high") products = [...products].sort((left, right) => right.price_fils - left.price_fils);
  const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(page, 1000)) : 1;
  return { state: "ready", isShowcase: true, categories: showcaseCategories, products: products.slice((safePage - 1) * 24, safePage * 24), total: products.length, page: safePage };
}

export function loadShowcaseFacets({ query = "", category = null } = {}) {
  const normalizedQuery = query.toLocaleLowerCase();
  const pool = showcaseProducts.filter((product) => {
    const shop = showcaseShops[product.shop];
    return (!category || product.category === category) &&
      (!normalizedQuery || `${product.title_en} ${product.title_ar} ${shop.name_en} ${shop.name_ar}`.toLocaleLowerCase().includes(normalizedQuery));
  });
  const shops = showcaseShops.map((shop, index) => ({ ...shop, count: pool.filter((product) => product.shop === index).length })).filter((shop) => shop.count > 0);
  const groups = new Map();
  for (const product of pool) for (const value of product.option_values) {
    const key = `${value.label_en}\u0000${value.label_ar}\u0000${value.value_en}\u0000${value.value_ar}`;
    const facet = groups.get(key) ?? { ...value, count: 0 };
    facet.count += 1;
    groups.set(key, facet);
  }
  const attributes = [...groups.values()].reduce((facets, value) => {
    const key = `${value.label_en}\u0000${value.label_ar}`;
    const facet = facets.get(key) ?? { label_en: value.label_en, label_ar: value.label_ar, values: [] };
    facet.values.push({ value_en: value.value_en, value_ar: value.value_ar, count: value.count });
    facets.set(key, facet);
    return facets;
  }, new Map());
  return { shops, attributes: [...attributes.values()] };
}

export function findShowcaseProduct(shopSlug, slug) {
  return showcaseProducts.find((product) => product.shop_slug === shopSlug && product.slug === slug) ?? null;
}

export function loadShowcaseShop(slug, page = 1) {
  const shop = showcaseShops.find((item) => item.slug === slug);
  if (!shop) return { state: "missing", shop: null, products: [], total: 0, page };
  const products = showcaseProducts.filter((item) => item.shop_slug === slug);
  return { state: "ready", isShowcase: true, shop, products, total: products.length, page };
}

export const showcaseSales = [
  { label: "Week 1", orders: 7, revenue_fils: 186000 }, { label: "Week 2", orders: 10, revenue_fils: 241000 },
  { label: "Week 3", orders: 8, revenue_fils: 209000 }, { label: "Week 4", orders: 14, revenue_fils: 348000 },
  { label: "Week 5", orders: 12, revenue_fils: 312000 }, { label: "Week 6", orders: 19, revenue_fils: 426000 },
  { label: "Week 7", orders: 16, revenue_fils: 391000 }, { label: "Week 8", orders: 23, revenue_fils: 518000 },
];

export const showcaseMetrics = { revenue_fils: 2631000, orders: 109, products: 18, average_rating: "4.8" };

export const showcaseRecentOrders = [
  { id: "BNF-SAMPLE-1048", items: 2, status_en: "Ready to pack", status_ar: "جاهز للتغليف", amount_fils: 63500 },
  { id: "BNF-SAMPLE-1047", items: 1, status_en: "Awaiting seller", status_ar: "بانتظار البائع", amount_fils: 28500 },
  { id: "BNF-SAMPLE-1046", items: 3, status_en: "Delivered", status_ar: "تم التسليم", amount_fils: 47000 },
];
