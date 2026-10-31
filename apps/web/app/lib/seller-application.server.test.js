import assert from "node:assert/strict";
import test from "node:test";
import { ADDRESS_PROOF_MAX_BYTES, validateAddressProof, validateSellerApplication } from "./seller-application.server.js";

function file(type, bytes) {
  return { type, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
}

test("address proof accepts only matching PDF, JPEG and PNG signatures", async () => {
  assert.deepEqual(await validateAddressProof(file("application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d])), { extension: "pdf", contentType: "application/pdf" });
  assert.deepEqual(await validateAddressProof(file("image/jpeg", [0xff, 0xd8, 0xff])), { extension: "jpg", contentType: "image/jpeg" });
  assert.deepEqual(await validateAddressProof(file("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { extension: "png", contentType: "image/png" });
  assert.equal(await validateAddressProof(file("image/png", [0x25, 0x50, 0x44, 0x46, 0x2d])), null);
  assert.equal(await validateAddressProof(file("text/html", [0x3c, 0x68, 0x74, 0x6d, 0x6c])), null);
  assert.equal(await validateAddressProof({ type: "application/pdf", size: ADDRESS_PROOF_MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }), null);
  assert.equal(await validateAddressProof({ type: "application/pdf", size: 0, arrayBuffer: async () => new ArrayBuffer(0) }), null);
});

test("seller application fields are trimmed and bounded", () => {
  assert.deepEqual(validateSellerApplication({ store_name_ar: " متجر ", store_name_en: " Shop ", contact: " +962 ", address: " Amman " }), {
    store_name_ar: "متجر", store_name_en: "Shop", contact: "+962", address: "Amman",
  });
  assert.equal(validateSellerApplication({ store_name_ar: " ", store_name_en: "Shop", contact: "x", address: "y" }), null);
  assert.equal(validateSellerApplication({ store_name_ar: "متجر", store_name_en: "x".repeat(121), contact: "x", address: "y" }), null);
});
