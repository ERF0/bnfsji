import { sameOriginPost } from "../lib/auth-config.js";
import { cloudflareContext } from "../lib/cloudflare-context.server.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server.js";
import { PRODUCT_IMAGE_BUCKET, PRODUCT_IMAGE_MAX_BYTES, signProductImages, verifyProductImageTransform } from "../lib/product-images.server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FORM_BYTES = 64 * 1024;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

function storageUploadEndpoint(supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    const project = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
    return project
      ? `https://${project}.storage.supabase.co/storage/v1/upload/resumable`
      : `${url.origin}/storage/v1/upload/resumable`;
  } catch {
    return null;
  }
}

async function readForm(request) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_FORM_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FORM_BYTES) {
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

async function removeProductImage(supabase, shopId, imageId) {
  const { data: path, error: beginError } = await supabase.rpc("begin_seller_product_image_delete", {
    p_shop_id: shopId, p_image_id: imageId,
  });
  if (beginError || typeof path !== "string") return false;
  const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  if (storageError) return false;
  const { error: completeError } = await supabase.rpc("complete_seller_product_image_delete", {
    p_shop_id: shopId, p_image_id: imageId,
  });
  return !completeError;
}

export async function loader({ request, params, context }) {
  if (!new Set(["ar", "en"]).has(params.locale)) return json({ error: "not-found" }, 404);
  if (!context.get(supabaseClaimsContext)?.sub) return json({ error: "sign-in" }, 401);
  const supabase = context.get(supabaseAuthContext);
  if (!supabase) return json({ error: "unavailable" }, 503);
  const url = new URL(request.url);
  const shopId = url.searchParams.get("shop_id");
  const productId = url.searchParams.get("product_id");
  if (![shopId, productId].every((value) => typeof value === "string" && UUID.test(value))) return json({ error: "invalid" }, 400);
  const { data, error } = await supabase.from("product_images")
    .select("id,product_id,storage_path,content_type,sort_order,status")
    .eq("shop_id", shopId).eq("product_id", productId).order("sort_order").order("id");
  if (error) return json({ error: "unavailable" }, 503);
  const signed = await signProductImages(supabase, data ?? [], 400, 1800);
  if (!signed.ok) return json({ error: "images-unavailable" }, 503);
  const images = (data ?? []).map((image) => ({
    id: image.id,
    status: image.status,
    sort_order: image.sort_order,
    src: signed.byProduct.get(productId)?.find((item) => item.id === image.id)?.src ?? null,
  }));
  return json({ images });
}

export async function action({ request, params, context }) {
  if (!new Set(["ar", "en"]).has(params.locale)) return json({ error: "not-found" }, 404);
  const claims = context.get(supabaseClaimsContext);
  const supabase = context.get(supabaseAuthContext);
  const env = context.get(cloudflareContext)?.env;
  if (!claims?.sub) return json({ error: "sign-in" }, 401);
  if (!supabase || !sameOriginPost(request, env?.PUBLIC_SITE_URL)) return json({ error: "forbidden" }, 403);
  let form;
  try { form = await readForm(request); } catch { return json({ error: "invalid" }, 400); }
  if (!form) return json({ error: "invalid" }, 400);
  const intent = form.get("intent");
  const shopId = form.get("shop_id");
  const productId = form.get("product_id");
  if (typeof shopId !== "string" || !UUID.test(shopId) || typeof productId !== "string" || !UUID.test(productId)) return json({ error: "invalid" }, 400);

  if (intent === "begin-upload") {
    const contentType = form.get("content_type");
    const sizeText = form.get("size");
    const imageId = crypto.randomUUID();
    if (typeof contentType !== "string" || !MIME_TYPES.has(contentType)
        || typeof sizeText !== "string" || !/^\d{1,8}$/.test(sizeText)
        || !Number.isSafeInteger(Number(sizeText)) || Number(sizeText) < 1 || Number(sizeText) > PRODUCT_IMAGE_MAX_BYTES) {
      return json({ error: "invalid-image" }, 400);
    }
    const { data: reserved, error: reserveError } = await supabase.rpc("begin_seller_product_image_upload", {
      p_shop_id: shopId, p_product_id: productId, p_image_id: imageId, p_content_type: contentType,
    });
    if (reserveError || !Array.isArray(reserved) || reserved.length !== 1) return json({ error: "upload-unavailable" }, 409);
    const storagePath = reserved[0].storage_path;
    const { data: signed, error: signError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).createSignedUploadUrl(storagePath);
    const endpoint = storageUploadEndpoint(env?.SUPABASE_URL);
    if (signError || !signed?.token || !endpoint) {
      await removeProductImage(supabase, shopId, imageId);
      return json({ error: "upload-unavailable" }, 503);
    }
    return json({ image_id: imageId, path: storagePath, token: signed.token, endpoint, content_type: contentType });
  }

  const imageId = form.get("image_id");
  if (typeof imageId !== "string" || !UUID.test(imageId)) return json({ error: "invalid" }, 400);

  if (intent === "finalize-upload") {
    const { data: image, error: imageError } = await supabase.from("product_images")
      .select("id,storage_path,status,content_type")
      .eq("id", imageId).eq("shop_id", shopId).eq("product_id", productId).maybeSingle();
    if (imageError || !image || !["pending", "active"].includes(image.status)) return json({ error: "image-not-found" }, 404);
    const valid = await verifyProductImageTransform(supabase, image.storage_path, { supabaseUrl: env?.SUPABASE_URL });
    if (!valid) {
      await removeProductImage(supabase, shopId, imageId);
      return json({ error: "image-processing-failed" }, 422);
    }
    const { error: activateError } = await supabase.rpc("activate_seller_product_image", { p_shop_id: shopId, p_image_id: imageId });
    if (activateError) return json({ error: "image-processing-failed" }, 503);
    return json({ success: true, image_id: imageId });
  }

  if (intent === "delete-image") {
    return await removeProductImage(supabase, shopId, imageId)
      ? json({ success: true })
      : json({ error: "delete-pending" }, 503);
  }

  if (intent === "reorder-images") {
    const rawOrder = form.get("image_ids");
    let imageIds;
    try { imageIds = JSON.parse(rawOrder); } catch { return json({ error: "invalid" }, 400); }
    if (!Array.isArray(imageIds) || imageIds.length > 10 || imageIds.some((id) => typeof id !== "string" || !UUID.test(id))) return json({ error: "invalid" }, 400);
    const { error } = await supabase.rpc("reorder_seller_product_images", {
      p_shop_id: shopId, p_product_id: productId, p_image_ids: imageIds,
    });
    return error ? json({ error: "reorder-failed" }, 409) : json({ success: true });
  }

  return json({ error: "invalid" }, 400);
}
