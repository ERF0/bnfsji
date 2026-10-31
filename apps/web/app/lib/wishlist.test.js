import test from "node:test";
import assert from "node:assert/strict";
import { isCompleteWishlistResolution, mergeWishlistIds, normalizeWishlistIds, partitionWishlistProducts, readWishlist, toggleWishlistId, writeWishlist } from "./wishlist.js";

const a = "a0000000-0000-4000-8000-000000000001";
const b = "b0000000-0000-4000-8000-000000000002";

function storageWith(value = null) {
  let stored = value;
  return { getItem: () => stored, setItem: (_key, next) => { stored = next; }, value: () => stored };
}

test("guest wishlist stores unique valid product IDs and ignores malformed storage", () => {
  const storage = storageWith(JSON.stringify([a, a, "bad", b]));
  assert.deepEqual(readWishlist(storage), [a, b]);
  writeWishlist(readWishlist(storage), storage);
  assert.deepEqual(JSON.parse(storage.value()), [a, b]);
  assert.deepEqual(readWishlist(storageWith("{")), []);
});

test("wishlist toggles and sign-in merge preserve unique products", () => {
  assert.deepEqual(toggleWishlistId([a], a), []);
  assert.deepEqual(toggleWishlistId([a], b), [a, b]);
  assert.deepEqual(mergeWishlistIds([a, b], [b]), [a, b]);
  assert.deepEqual(normalizeWishlistIds(["not-a-uuid"]), []);
});

test("wishlist keeps unresolved saved IDs visible without inventing product data", () => {
  const current = { id: a, title_en: "Current listing" };
  const unexpected = { id: "a0000000-0000-4000-8000-000000000003", title_en: "Not saved" };
  assert.deepEqual(partitionWishlistProducts([a, b], [unexpected, current]), { products: [current], unavailableIds: [b] });
  assert.deepEqual(partitionWishlistProducts([b], []), { products: [], unavailableIds: [b] });
});

test("wishlist requires a complete response for the exact requested IDs", () => {
  assert.equal(isCompleteWishlistResolution([a, b], [a, b]), true);
  assert.equal(isCompleteWishlistResolution([a, b], [a]), false);
  assert.equal(isCompleteWishlistResolution([a], [b]), false);
  assert.equal(isCompleteWishlistResolution([a], null), false);
});
