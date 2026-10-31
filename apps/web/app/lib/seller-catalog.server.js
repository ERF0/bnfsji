import { parseJodPriceFilter } from "./catalog.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_VARIANTS = 50;
const MAX_OPTIONS = 8;
export const SELLER_PRODUCT_FORM_MAX_BYTES = 256 * 1024;

export async function readSellerProductForm(request) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > SELLER_PRODUCT_FORM_MAX_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > SELLER_PRODUCT_FORM_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Request(request.url, { method: "POST", headers, body }).formData();
}

export function validateSellerProduct(input) {
  const fields = {};
  for (const [key, max] of Object.entries({ title_ar: 200, title_en: 200, description_ar: 10000, description_en: 10000 })) {
    const value = input?.[key];
    if (typeof value !== "string" || value.trim().length > max || ((key === "title_ar" || key === "title_en") && value.trim().length === 0)) return null;
    fields[key] = value.trim();
  }
  if (typeof input.category_id !== "string" || !UUID.test(input.category_id)) return null;
  let rawVariants;
  try {
    rawVariants = JSON.parse(input.variants_json);
  } catch {
    return null;
  }
  if (!Array.isArray(rawVariants) || rawVariants.length < 1 || rawVariants.length > MAX_VARIANTS) return null;

  const variants = [];
  let optionLabels = null;
  const combinations = new Set();
  const skus = new Set();
  for (const raw of rawVariants) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (raw.variant_id !== undefined && (typeof raw.variant_id !== "string" || !UUID.test(raw.variant_id))) return null;
    let priceFils;
    try { priceFils = parseJodPriceFilter(raw.price); } catch { return null; }
    if (!Number.isSafeInteger(priceFils) || priceFils < 1) return null;
    if (typeof raw.sku !== "string" || raw.sku.trim().length > 100) return null;
    const sku = raw.sku.trim();
    if (raw.variant_id !== undefined && !sku) return null;
    if (sku) {
      const normalizedSku = sku.toLocaleUpperCase("en-US");
      if (skus.has(normalizedSku)) return null;
      skus.add(normalizedSku);
    }
    if (!new Set(["stocked", "after_order"]).has(raw.supply_mode)) return null;
    let stockQuantity = null;
    if (raw.supply_mode === "stocked") {
      if (!Number.isSafeInteger(raw.stock_quantity) || raw.stock_quantity < 0 || raw.stock_quantity > 2147483647) return null;
      stockQuantity = raw.stock_quantity;
    }
    if (!Array.isArray(raw.option_values) || raw.option_values.length > MAX_OPTIONS) return null;
    const optionValues = [];
    for (const rawOption of raw.option_values) {
      if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)) return null;
      const option = {};
      for (const key of ["label_ar", "label_en", "value_ar", "value_en"]) {
        if (typeof rawOption[key] !== "string" || rawOption[key].trim().length < 1 || rawOption[key].trim().length > 80) return null;
        option[key] = rawOption[key].trim();
      }
      optionValues.push(option);
    }
    const labels = JSON.stringify(optionValues.map(({ label_ar, label_en }) => [label_ar, label_en]));
    if (optionLabels !== null && optionLabels !== labels) return null;
    optionLabels = labels;
    const combination = JSON.stringify(optionValues.map(({ value_ar, value_en }) => [value_ar, value_en]));
    if (combinations.has(combination)) return null;
    combinations.add(combination);
    variants.push({
      ...(raw.variant_id ? { variant_id: raw.variant_id } : {}),
      sku: sku || null,
      price_fils: String(priceFils),
      supply_mode: raw.supply_mode,
      stock_quantity: stockQuantity === null ? null : String(stockQuantity),
      option_values: optionValues,
    });
  }
  return { ...fields, category_id: input.category_id, variants };
}
