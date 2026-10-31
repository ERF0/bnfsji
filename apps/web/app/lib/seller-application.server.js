const PROOF_TYPES = new Map([
  ["application/pdf", { extension: "pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] }],
  ["image/jpeg", { extension: "jpg", signature: [0xff, 0xd8, 0xff] }],
  ["image/png", { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
]);

export const ADDRESS_PROOF_MAX_BYTES = 10 * 1024 * 1024;

export function validateAddressProof(file) {
  if (!file || typeof file.arrayBuffer !== "function" || !Number.isSafeInteger(file.size)
      || file.size < 1 || file.size > ADDRESS_PROOF_MAX_BYTES) return null;
  const type = PROOF_TYPES.get(file.type);
  if (!type) return null;
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    if (bytes.length !== file.size || !type.signature.every((byte, index) => bytes[index] === byte)) return null;
    return { extension: type.extension, contentType: file.type };
  });
}

export function validateSellerApplication(input) {
  const fields = ["store_name_ar", "store_name_en", "contact", "address"];
  const limits = { store_name_ar: 120, store_name_en: 120, contact: 160, address: 1000 };
  const result = {};
  for (const field of fields) {
    const value = input?.[field];
    if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > limits[field]) return null;
    result[field] = value.trim();
  }
  return result;
}
