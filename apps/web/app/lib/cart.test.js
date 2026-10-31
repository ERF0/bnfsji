import test from "node:test";
import assert from "node:assert/strict";
import { addCartItem, cartItemSubtotalFils, cartVariantIds, readCart, removeCartItem, setCartQuantity, writeCart } from "./cart.js";

const itemA = {
  product_id: "a0000000-0000-4000-8000-000000000001",
  variant_id: "c0000000-0000-4000-8000-000000000001",
  product_slug: "shirt", shop_slug: "shop-a", title_ar: "قميص", title_en: "Shirt",
  shop_name_ar: "متجر أ", shop_name_en: "Shop A",
};
const itemB = { ...itemA, product_id: "b0000000-0000-4000-8000-000000000002", variant_id: "d0000000-0000-4000-8000-000000000002", shop_slug: "shop-b" };

function storageWith(value = null) {
  let stored = value;
  return {
    getItem: () => stored,
    setItem: (_key, next) => { stored = next; },
    value: () => stored,
  };
}

test("cart keeps products from multiple sellers and increments matching items", () => {
  let lines = addCartItem([], itemA);
  lines = addCartItem(lines, itemB);
  lines = addCartItem(lines, itemA);
  assert.equal(lines.length, 2);
  assert.equal(lines.find((line) => line.variant_id === itemA.variant_id).quantity, 2);
  assert.deepEqual(cartVariantIds(lines), [itemA.variant_id, itemB.variant_id].sort());
});

test("cart keeps separate selectable SKUs for one product", () => {
  const secondSize = { ...itemA, variant_id: "c0000000-0000-4000-8000-000000000002" };
  const lines = addCartItem(addCartItem([], itemA), secondSize);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].product_id, lines[1].product_id);
  assert.notEqual(lines[0].variant_id, lines[1].variant_id);
});

test("cart quantity updates and removal do not create invalid lines", () => {
  const lines = [addCartItem([], itemA)[0], addCartItem([], itemB)[0]];
  assert.equal(setCartQuantity(lines, itemA.variant_id, 0).length, 1);
  assert.equal(setCartQuantity(lines, itemA.variant_id, 1.5), lines);
  assert.equal(removeCartItem(lines, itemB.variant_id)[0].variant_id, itemA.variant_id);
});

test("storage ignores malformed records and cart totals use refreshed server prices", () => {
  const storage = storageWith(JSON.stringify([addCartItem([], itemA)[0], { product_id: "not-a-uuid", quantity: 100 }]));
  const lines = readCart(storage);
  assert.equal(lines.length, 1);
  writeCart(lines, storage);
  assert.equal(readCart(storage).length, 1);
  const products = new Map([[itemA.variant_id, { price_fils: 1250 }]]);
  assert.equal(cartItemSubtotalFils(setCartQuantity(lines, itemA.variant_id, 3), products), 3750);
});

test("cart subtotal refuses values that cannot be represented safely as integer fils", () => {
  const line = { ...addCartItem([], itemA)[0], quantity: Number.MAX_SAFE_INTEGER };
  const products = new Map([[itemA.variant_id, { price_fils: 2 }]]);
  assert.equal(cartItemSubtotalFils([line], products), null);
});

test("cart stops at its bounded line count", () => {
  const lines = Array.from({ length: 100 }, (_, index) => ({
    ...itemA,
    product_id: `a0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    variant_id: `b0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    quantity: 1,
  }));
  assert.equal(addCartItem(lines, { ...itemA, product_id: "c0000000-0000-4000-8000-000000000003", variant_id: "e0000000-0000-4000-8000-000000000003" }), lines);
});
