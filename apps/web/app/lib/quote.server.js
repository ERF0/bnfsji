const MAX_SELLERS = 50;
const MAX_SAFE_FILS = Number.MAX_SAFE_INTEGER;

function requireFils(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer in fils`);
  }
}

function validateInput(input) {
  if (!input || input.version !== 1 || input.currency !== "JOD") {
    throw new TypeError("Unsupported quote version or currency");
  }
  requireFils(input.delivery_charge_fils, "delivery_charge_fils");
  if (!Array.isArray(input.sellers) || input.sellers.length < 1 || input.sellers.length > MAX_SELLERS) {
    throw new TypeError(`sellers must contain 1-${MAX_SELLERS} entries`);
  }
  const ids = new Set();
  for (const seller of input.sellers) {
    if (!seller || typeof seller.seller_id !== "string" || !seller.seller_id.trim() || ids.has(seller.seller_id)) {
      throw new TypeError("seller IDs must be non-empty and unique");
    }
    ids.add(seller.seller_id);
    requireFils(seller.discounted_item_subtotal_fils, "discounted_item_subtotal_fils");
    if (!new Set(["standard", "annual_subscription"]).has(seller.plan)) {
      throw new TypeError("seller plan must be resolved to a supported entitlement");
    }
  }
}

function validateResponse(quote, input) {
  const expectedSellers = new Map(input.sellers.map((seller) => [seller.seller_id, seller]));
  if (!quote || quote.currency !== "JOD" || !Array.isArray(quote.sellers) || quote.sellers.length !== expectedSellers.size) {
    throw new Error("Quote service returned an invalid response");
  }
  for (const field of ["item_subtotal_fils", "commission_fils", "delivery_charge_fils", "buyer_total_fils"]) {
    requireFils(quote[field], field);
  }
  let subtotal = 0;
  let commissions = 0;
  let delivery = 0;
  const seen = new Set();
  for (const seller of quote.sellers) {
    if (!seller || typeof seller.seller_id !== "string" || !expectedSellers.has(seller.seller_id) || seen.has(seller.seller_id)) {
      throw new Error("Quote service returned mismatched seller rows");
    }
    seen.add(seller.seller_id);
    for (const field of ["discounted_item_subtotal_fils", "commission_fils", "delivery_allocation_fils", "item_proceeds_fils"]) {
      requireFils(seller[field], field);
    }
    const inputSeller = expectedSellers.get(seller.seller_id);
    const rateBasisPoints = inputSeller.plan === "standard" ? 700n : 200n;
    const expectedCommission = Number((BigInt(inputSeller.discounted_item_subtotal_fils) * rateBasisPoints + 5000n) / 10000n);
    if (seller.discounted_item_subtotal_fils !== inputSeller.discounted_item_subtotal_fils ||
        seller.commission_fils !== expectedCommission) {
      throw new Error("Quote service changed a trusted subtotal or commission rate");
    }
    if (seller.commission_fils > seller.discounted_item_subtotal_fils ||
        seller.item_proceeds_fils !== seller.discounted_item_subtotal_fils - seller.commission_fils) {
      throw new Error("Quote service returned inconsistent seller proceeds");
    }
    subtotal += seller.discounted_item_subtotal_fils;
    commissions += seller.commission_fils;
    delivery += seller.delivery_allocation_fils;
  }
  if ([subtotal, commissions, delivery].some((value) => !Number.isSafeInteger(value)) ||
      subtotal !== quote.item_subtotal_fils || commissions !== quote.commission_fils ||
      delivery !== quote.delivery_charge_fils ||
      quote.delivery_charge_fils !== input.delivery_charge_fils ||
      quote.item_subtotal_fils + quote.delivery_charge_fils > MAX_SAFE_FILS ||
      quote.buyer_total_fils !== quote.item_subtotal_fils + quote.delivery_charge_fils) {
    throw new Error("Quote service returned totals that do not reconcile");
  }
  return quote;
}

/**
 * Invoke the private Rust Worker. Callers must load prices, discounts, and the
 * seller's active subscription entitlement from trusted server state first.
 */
export async function calculateTrustedQuote(env, input) {
  validateInput(input);
  if (!env?.QUOTE_SERVICE || typeof env.QUOTE_SERVICE.fetch !== "function") {
    throw new Error("Private quote service is not configured");
  }
  const response = await env.QUOTE_SERVICE.fetch(new Request("https://quote.internal/v1/quote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
  if (!response.ok) throw new Error(`Private quote service failed with ${response.status}`);
  let quote;
  try {
    quote = await response.json();
  } catch {
    throw new Error("Private quote service returned invalid JSON");
  }
  return validateResponse(quote, input);
}
