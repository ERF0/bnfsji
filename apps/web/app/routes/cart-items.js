import { loadCartVariants, loadProductsByIds } from "../lib/catalog.server.js";
import { cloudflareContext } from "../lib/cloudflare-context.server.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loader({ request, context }) {
  const params = new URL(request.url).searchParams;
  if (params.has("ids") === params.has("variants")) {
    return Response.json({ state: "invalid" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const productRequest = params.has("ids");
  const rawIds = params.get(productRequest ? "ids" : "variants") ?? "";
  const ids = rawIds ? [...new Set(rawIds.split(","))] : [];
  if (ids.length === 0 || ids.length > 100 || ids.some((id) => !UUID.test(id))) {
    return Response.json({ state: "invalid", ...(productRequest ? { requestedIds: [] } : { requestedVariantIds: [] }) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const env = context.get(cloudflareContext)?.env;
  if (productRequest) {
    const result = await loadProductsByIds(env, ids);
    return Response.json({ ...result, requestedIds: ids }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const rawQuantities = params.get("quantities");
  const quantities = rawQuantities?.split(",").map((value) => /^\d+$/.test(value) ? Number(value) : NaN);
  if (!quantities || quantities.length !== ids.length || quantities.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 1)) {
    return Response.json({ state: "invalid", requestedVariantIds: ids, requestedQuantities: [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const result = await loadCartVariants(env, ids, quantities);
  const quote = result.quote && {
    currency: result.quote.currency,
    item_subtotal_fils: result.quote.item_subtotal_fils,
    delivery_charge_fils: result.quote.delivery_charge_fils,
    buyer_total_fils: result.quote.buyer_total_fils,
  };
  return Response.json({ ...result, quote, requestedVariantIds: ids, requestedQuantities: quantities }, { headers: { "Cache-Control": "private, no-store" } });
}
