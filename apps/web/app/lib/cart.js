const CART_KEY = "bnafsaji-cart-v2";
export const MAX_CART_LINES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validLine(line) {
  return line && typeof line === "object"
    && UUID.test(line.product_id)
    && UUID.test(line.variant_id)
    && Number.isSafeInteger(line.quantity) && line.quantity > 0
    && typeof line.product_slug === "string"
    && typeof line.shop_slug === "string";
}

export function readCart(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage?.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    const unique = new Map();
    for (const line of value) if (validLine(line)) unique.set(line.variant_id, line);
    return [...unique.values()].slice(0, MAX_CART_LINES);
  } catch {
    return [];
  }
}

export function writeCart(lines, storage) {
  try {
    storage ??= globalThis.localStorage;
    storage?.setItem(CART_KEY, JSON.stringify(lines.filter(validLine)));
  } catch {
    // Storage can be disabled or full; the current in-memory cart still works.
  }
}

export function addCartItem(lines, product) {
  if (!product || !UUID.test(product.product_id) || !UUID.test(product.variant_id) || !product.product_slug || !product.shop_slug) return lines;
  const existing = lines.find((line) => line.variant_id === product.variant_id);
  if (existing) {
    if (existing.quantity === Number.MAX_SAFE_INTEGER) return lines;
    return lines.map((line) => line.variant_id === product.variant_id
      ? { ...line, quantity: line.quantity + 1 }
      : line);
  }
  if (lines.length >= MAX_CART_LINES) return lines;
  return [...lines, {
    product_id: product.product_id,
    variant_id: product.variant_id,
    option_values: product.option_values ?? [],
    product_slug: product.product_slug,
    shop_slug: product.shop_slug,
    title_ar: product.title_ar,
    title_en: product.title_en,
    shop_name_ar: product.shop_name_ar,
    shop_name_en: product.shop_name_en,
    quantity: 1,
  }];
}

export function setCartQuantity(lines, variantId, quantity) {
  if (!Number.isSafeInteger(quantity)) return lines;
  if (quantity < 1) return lines.filter((line) => line.variant_id !== variantId);
  return lines.map((line) => line.variant_id === variantId ? { ...line, quantity } : line);
}

export function removeCartItem(lines, variantId) {
  return lines.filter((line) => line.variant_id !== variantId);
}

export function cartVariantIds(lines) {
  return [...new Set(lines.map((line) => line.variant_id).filter((id) => UUID.test(id)))].slice(0, MAX_CART_LINES).sort();
}

export function cartItemSubtotalFils(lines, productsById) {
  let total = 0n;
  for (const line of lines) {
    const price = productsById.get(line.variant_id)?.price_fils;
    if (!Number.isSafeInteger(price) || price < 1) return null;
    total += BigInt(price) * BigInt(line.quantity);
  }
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
