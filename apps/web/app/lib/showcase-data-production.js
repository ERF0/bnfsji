export const showcaseMetrics = null;
export const showcaseSales = [];
export const showcaseRecentOrders = [];
export const showcaseProducts = [];
export const showcaseShops = [];
export const showcaseCategories = [];

export function loadShowcaseCatalog() {
  return { state: "unconfigured", categories: [], products: [], total: 0, page: 1 };
}

export function findShowcaseProduct() { return null; }
export function loadShowcaseShop() { return { state: "missing", shop: null, products: [], total: 0, page: 1 }; }
