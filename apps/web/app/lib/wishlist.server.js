import { WISHLIST_BATCH_SIZE } from "./wishlist.js";

export const MAX_WISHLIST_BODY_BYTES = 8192;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readWishlistChange(request) {
  const length = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > MAX_WISHLIST_BODY_BYTES) return { error: 413 };
  if (!request.body) return { error: 400 };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WISHLIST_BODY_BYTES) {
        await reader.cancel();
        return { error: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { error: 400 };
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)
      || !Array.isArray(body.add) || !Array.isArray(body.remove)
      || body.add.length > WISHLIST_BATCH_SIZE || body.remove.length > WISHLIST_BATCH_SIZE
      || [...body.add, ...body.remove].some((id) => typeof id !== "string" || !UUID.test(id))) return { error: 400 };
    return { add: [...new Set(body.add)], remove: [...new Set(body.remove)] };
  } catch {
    return { error: 400 };
  }
}
