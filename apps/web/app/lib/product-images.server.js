export const PRODUCT_IMAGE_BUCKET = "product-images";
export const PRODUCT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_COUNT = 10;
export const PRODUCT_IMAGE_TRANSFORM = Object.freeze({ width: 1600, height: 1600, resize: "contain", quality: 80 });
const MAX_TRANSFORMED_BYTES = 5 * 1024 * 1024;

function readU24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readU32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

export function inspectMetadataFreeWebp(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20
      || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF"
      || String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP"
      || readU32LE(bytes, 4) + 8 !== bytes.length) return null;

  let offset = 12;
  let dimensions = null;
  while (offset + 8 <= bytes.length) {
    const tag = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const length = readU32LE(bytes, offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > bytes.length) return null;
    if (tag === "EXIF" || tag === "XMP " || tag === "ICCP") return null;
    if (tag === "VP8X" && length >= 10) dimensions = { width: readU24LE(bytes, start + 4) + 1, height: readU24LE(bytes, start + 7) + 1 };
    if (tag === "VP8 " && length >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a) {
      dimensions = { width: (bytes[start + 6] | (bytes[start + 7] << 8)) & 0x3fff, height: (bytes[start + 8] | (bytes[start + 9] << 8)) & 0x3fff };
    }
    if (tag === "VP8L" && length >= 5 && bytes[start] === 0x2f) {
      dimensions = {
        width: 1 + bytes[start + 1] + ((bytes[start + 2] & 0x3f) << 8),
        height: 1 + ((bytes[start + 2] >> 6) | (bytes[start + 3] << 2) | ((bytes[start + 4] & 0x0f) << 10)),
      };
    }
    offset = end + (length & 1);
  }
  if (offset !== bytes.length || !dimensions || dimensions.width < 1 || dimensions.height < 1
      || dimensions.width > PRODUCT_IMAGE_TRANSFORM.width || dimensions.height > PRODUCT_IMAGE_TRANSFORM.height) return null;
  return dimensions;
}

async function readBoundedBody(response) {
  if (response.headers.get("content-length") && Number(response.headers.get("content-length")) > MAX_TRANSFORMED_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_TRANSFORMED_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function verifyProductImageTransform(supabase, path, { fetchImpl = fetch, supabaseUrl } = {}) {
  const { data, error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(path, 60, { transform: PRODUCT_IMAGE_TRANSFORM });
  if (error || !data?.signedUrl) return false;
  let signedUrl;
  try {
    signedUrl = new URL(data.signedUrl);
    if (signedUrl.protocol !== "https:" || !supabaseUrl || signedUrl.origin !== new URL(supabaseUrl).origin) return false;
  } catch {
    return false;
  }
  let response;
  try {
    response = await fetchImpl(signedUrl, { headers: { accept: "image/webp" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
  } catch {
    return false;
  }
  if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/webp") return false;
  const bytes = await readBoundedBody(response);
  return inspectMetadataFreeWebp(bytes) !== null;
}

export async function signProductImages(supabase, rows, width = 400, expiresIn = 3600) {
  if (!rows.length) return { ok: true, byProduct: new Map() };
  const safeRows = rows.filter((row) => row.status === "active");
  if (!safeRows.length) return { ok: true, byProduct: new Map() };
  const results = await Promise.all(safeRows.map((row) => supabase.storage.from(PRODUCT_IMAGE_BUCKET).createSignedUrl(
    row.storage_path, expiresIn, { transform: { width, height: width, resize: "contain", quality: 80 } },
  )));
  if (results.some(({ data, error }) => error || typeof data?.signedUrl !== "string")) return { ok: false, byProduct: new Map() };
  const byProduct = new Map();
  for (const [index, row] of safeRows.entries()) {
    const src = results[index].data.signedUrl;
    const images = byProduct.get(row.product_id) ?? [];
    images.push({ id: row.id, src, sort_order: row.sort_order });
    byProduct.set(row.product_id, images);
  }
  for (const images of byProduct.values()) images.sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id));
  return { ok: true, byProduct };
}
