import { calculateTrustedQuote } from "../../../apps/web/app/lib/quote.server.js";

const singleSellerRequest = {
  version: 1,
  currency: "JOD",
  delivery_charge_fils: 600,
  sellers: [{ seller_id: "seller-single", discounted_item_subtotal_fils: 12_345, plan: "standard" }],
};

const mixedSellerRequest = {
  version: 1,
  currency: "JOD",
  delivery_charge_fils: 1,
  sellers: [
    { seller_id: "seller-a", discounted_item_subtotal_fils: 1_000, plan: "standard" },
    { seller_id: "seller-b", discounted_item_subtotal_fils: 1_000, plan: "annual_subscription" },
  ],
};

export default {
  async fetch(request, env) {
    if (request.method !== "GET" || new URL(request.url).pathname !== "/run") {
      return new Response("Not Found", { status: 404 });
    }
    try {
      const single = await calculateTrustedQuote(env, singleSellerRequest);
      const mixed = await calculateTrustedQuote(env, mixedSellerRequest);
      if (single.buyer_total_fils !== 12_945 || single.commission_fils !== 864 ||
          mixed.buyer_total_fils !== 2_001 || mixed.commission_fils !== 90 ||
          mixed.sellers[0].seller_id !== "seller-a" || mixed.sellers[0].delivery_allocation_fils !== 1 ||
          mixed.sellers[1].delivery_allocation_fils !== 0) {
        return Response.json({ ok: false, reason: "quote invariant mismatch" }, { status: 500 });
      }
      return Response.json({ ok: true, single_buyer_total_fils: single.buyer_total_fils, mixed_buyer_total_fils: mixed.buyer_total_fils });
    } catch {
      return Response.json({ ok: false, reason: "private quote call failed validation" }, { status: 502 });
    }
  },
};
