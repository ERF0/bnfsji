import assert from "node:assert/strict";
import test from "node:test";
import { readSellerProductForm, SELLER_PRODUCT_FORM_MAX_BYTES, validateSellerProduct } from "./seller-catalog.server.js";

const category = "00000000-0000-4000-8000-000000000001";
const input = (variants) => ({
  category_id: category,
  title_ar: "قميص",
  title_en: "Shirt",
  description_ar: "",
  description_en: "",
  variants_json: JSON.stringify(variants),
});

test("seller product validation converts JOD to integer fils and preserves SKU and variant options", () => {
  const product = validateSellerProduct(input([{
    sku: "SHIRT-M-BLUE", price: "12.345", supply_mode: "stocked", stock_quantity: 4,
    option_values: [{ label_ar: "المقاس", label_en: "Size", value_ar: "متوسط", value_en: "Medium" }],
  }]));
  assert.equal(product.variants[0].price_fils, "12345");
  assert.equal(product.variants[0].sku, "SHIRT-M-BLUE");
  assert.equal(product.variants[0].stock_quantity, "4");
});

test("seller product validation rejects inconsistent option dimensions, duplicate combinations and invalid stock", () => {
  const base = { price: "1", supply_mode: "after_order", option_values: [{ label_ar: "المقاس", label_en: "Size", value_ar: "صغير", value_en: "Small" }] };
  assert.equal(validateSellerProduct(input([base, { ...base, option_values: [{ ...base.option_values[0], value_en: "Small" }] }])), null);
  assert.equal(validateSellerProduct(input([base, { ...base, option_values: [{ label_ar: "اللون", label_en: "Color", value_ar: "أزرق", value_en: "Blue" }] }])), null);
  assert.equal(validateSellerProduct(input([{ ...base, supply_mode: "stocked", stock_quantity: -1 }])), null);
});

test("seller product form parsing enforces its byte limit with or without Content-Length", async () => {
  const valid = await readSellerProductForm(new Request("https://example.test/en/seller/products", {
    method: "POST", body: new URLSearchParams({ title_en: "Shirt" }),
  }));
  assert.equal(valid.get("title_en"), "Shirt");
  const body = `payload=${"x".repeat(SELLER_PRODUCT_FORM_MAX_BYTES)}`;
  const oversized = new Request("https://example.test/en/seller/products", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body,
  });
  assert.equal(await readSellerProductForm(oversized), null);
  const declaredOversized = new Request("https://example.test/en/seller/products", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "content-length": String(SELLER_PRODUCT_FORM_MAX_BYTES + 1) }, body: "x=y",
  });
  assert.equal(await readSellerProductForm(declaredOversized), null);
});
