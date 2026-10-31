const WISHLIST_KEY = "bnafsaji-wishlist-v1";
export const WISHLIST_BATCH_SIZE = 80;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWishlistIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && UUID.test(id)))];
}

export function readWishlist(storage) {
  try {
    storage ??= globalThis.localStorage;
    return normalizeWishlistIds(JSON.parse(storage?.getItem(WISHLIST_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function writeWishlist(ids, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage?.setItem(WISHLIST_KEY, JSON.stringify(normalizeWishlistIds(ids)));
  } catch {
    // Storage can be disabled or full; the in-memory list still works.
  }
}

export function toggleWishlistId(ids, productId) {
  if (typeof productId !== "string" || !UUID.test(productId)) return ids;
  return ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
}

export function mergeWishlistIds(...lists) {
  return normalizeWishlistIds(lists.flat());
}

export function partitionWishlistProducts(savedIds, products) {
  const byId = new Map(products.map((product) => [product.id, product]));
  return {
    products: savedIds.map((id) => byId.get(id)).filter(Boolean),
    unavailableIds: savedIds.filter((id) => !byId.has(id)),
  };
}

export function isCompleteWishlistResolution(requestedIds, returnedIds) {
  return Array.isArray(requestedIds) && Array.isArray(returnedIds) && returnedIds.length === requestedIds.length
    && requestedIds.every((id, index) => returnedIds[index] === id);
}
