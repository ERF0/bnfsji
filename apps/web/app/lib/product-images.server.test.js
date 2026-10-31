import assert from "node:assert/strict";
import test from "node:test";
import { inspectMetadataFreeWebp, signProductImages, verifyProductImageTransform } from "./product-images.server.js";

function webp(chunks) {
  const u32le = (value) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
  const bytes = ["RIFF", 0, 0, 0, 0, "WEBP"];
  for (const [tag, data] of chunks) bytes.push(tag, ...u32le(data.length), ...data, ...(data.length % 2 ? [0] : []));
  const result = new Uint8Array(bytes.reduce((length, value) => length + (typeof value === "string" ? value.length : 1), 0));
  let offset = 0;
  for (const value of bytes) {
    if (typeof value === "string") { for (const char of value) result[offset++] = char.charCodeAt(0); }
    else result[offset++] = value;
  }
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  return result;
}

test("transformed WebP verification rejects metadata, malformed chunks and oversized dimensions", () => {
  const pixel = ["VP8L", [0x2f, 0, 0, 0, 0]];
  assert.deepEqual(inspectMetadataFreeWebp(webp([pixel])), { width: 1, height: 1 });
  assert.equal(inspectMetadataFreeWebp(webp([["EXIF", [1]], pixel])), null);
  assert.equal(inspectMetadataFreeWebp(webp([["XMP ", [1]], pixel])), null);
  const oversized = ["VP8X", [0, 0, 0, 0, 0x40, 0x06, 0, 0, 0, 0]];
  assert.equal(inspectMetadataFreeWebp(webp([oversized])), null);
  assert.equal(inspectMetadataFreeWebp(new Uint8Array([1, 2, 3])), null);
});

test("signed image transforms are same-origin, WebP-only, bounded and attached per product", async () => {
  const imageBytes = webp([["VP8L", [0x2f, 0, 0, 0, 0]]]);
  let signedOptions;
  const supabase = { storage: { from(bucket) { assert.equal(bucket, "product-images"); return {
    async createSignedUrl(path, expiresIn, options) {
      assert.equal(path, "shop/product/photo.webp");
      assert.equal(expiresIn, 60);
      signedOptions = options;
      return { data: { signedUrl: "https://project.supabase.co/storage/v1/render/image/sign/photo?token=secret" }, error: null };
    },
  }; } } };
  assert.equal(await verifyProductImageTransform(supabase, "shop/product/photo.webp", {
    supabaseUrl: "https://project.supabase.co",
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.accept, "image/webp");
      return new Response(imageBytes, { headers: { "content-type": "image/webp" } });
    },
  }), true);
  assert.equal(signedOptions.transform.width, 1600);
  const crossOriginStorage = { storage: { from() { return { async createSignedUrl() { return { data: { signedUrl: "https://attacker.invalid/image" }, error: null }; } }; } } };
  assert.equal(await verifyProductImageTransform(crossOriginStorage, "shop/product/photo.webp", {
    supabaseUrl: "https://project.supabase.co", fetchImpl: async () => { throw new Error("must not fetch cross-origin"); },
  }), false);
  assert.equal(await verifyProductImageTransform(supabase, "shop/product/photo.webp", {
    supabaseUrl: "https://project.supabase.co",
    fetchImpl: async () => new Response(imageBytes, { headers: { "content-type": "image/webp-extra" } }),
  }), false);

  const calls = [];
  const storage = { storage: { from() { return { async createSignedUrl(path, _expires, options) {
    calls.push({ path, options });
    return { data: { signedUrl: `https://project.supabase.co/signed/${path}` }, error: null };
  } }; } } };
  const signed = await signProductImages(storage, [
    { id: "b", product_id: "p", storage_path: "b.webp", status: "active", sort_order: 1 },
    { id: "private", product_id: "p", storage_path: "private.webp", status: "pending", sort_order: 0 },
    { id: "a", product_id: "p", storage_path: "a.webp", status: "active", sort_order: 0 },
  ], 400, 1800);
  assert.equal(signed.ok, true);
  assert.deepEqual(signed.byProduct.get("p").map(({ id }) => id), ["a", "b"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.transform.quality, 80);
});
