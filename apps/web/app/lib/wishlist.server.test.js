import test from "node:test";
import assert from "node:assert/strict";
import { MAX_WISHLIST_BODY_BYTES, readWishlistChange } from "./wishlist.server.js";
import { WISHLIST_BATCH_SIZE } from "./wishlist.js";

const a = "a0000000-0000-4000-8000-000000000001";

test("wishlist changes accept bounded, valid IDs and deduplicate them", async () => {
  const request = new Request("https://market.example/en/wishlist/items", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ add: [a, a], remove: [] }),
  });
  assert.deepEqual(await readWishlistChange(request), { add: [a], remove: [] });
});

test("wishlist changes reject invalid IDs, excessive batches, malformed and oversized streamed JSON", async () => {
  const invalid = new Request("https://market.example/en/wishlist/items", { method: "POST", body: JSON.stringify({ add: ["bad"], remove: [] }) });
  assert.deepEqual(await readWishlistChange(invalid), { error: 400 });
  const many = new Request("https://market.example/en/wishlist/items", { method: "POST", body: JSON.stringify({ add: Array(WISHLIST_BATCH_SIZE + 1).fill(a), remove: [] }) });
  assert.deepEqual(await readWishlistChange(many), { error: 400 });
  const broken = new Request("https://market.example/en/wishlist/items", { method: "POST", body: "{" });
  assert.deepEqual(await readWishlistChange(broken), { error: 400 });
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_WISHLIST_BODY_BYTES + 1)); controller.close(); } });
  const oversized = new Request("https://market.example/en/wishlist/items", { method: "POST", body, duplex: "half" });
  assert.deepEqual(await readWishlistChange(oversized), { error: 413 });
});
