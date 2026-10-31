import test from "node:test";
import assert from "node:assert/strict";
import { calculateTrustedQuote } from "./quote.server.js";

const request = {
  version: 1,
  currency: "JOD",
  delivery_charge_fils: 11,
  sellers: [
    { seller_id: "seller-a", discounted_item_subtotal_fils: 1000, plan: "standard" },
    { seller_id: "seller-b", discounted_item_subtotal_fils: 2000, plan: "annual_subscription" },
  ],
};

const response = {
  currency: "JOD",
  item_subtotal_fils: 3000,
  commission_fils: 110,
  delivery_charge_fils: 11,
  buyer_total_fils: 3011,
  sellers: [
    { seller_id: "seller-a", discounted_item_subtotal_fils: 1000, commission_fils: 70, delivery_allocation_fils: 4, item_proceeds_fils: 930 },
    { seller_id: "seller-b", discounted_item_subtotal_fils: 2000, commission_fils: 40, delivery_allocation_fils: 7, item_proceeds_fils: 1960 },
  ],
};

function serviceReturning(body, status = 200) {
  let calledRequest;
  return {
    get calledRequest() { return calledRequest; },
    binding: { async fetch(req) {
      calledRequest = req;
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    } },
  };
}

test("sends the trusted quote contract over the private service binding and reconciles its result", async () => {
  const fake = serviceReturning(response);
  assert.deepEqual(await calculateTrustedQuote({ QUOTE_SERVICE: fake.binding }, request), response);
  assert.equal(fake.calledRequest.url, "https://quote.internal/v1/quote");
  assert.equal(fake.calledRequest.method, "POST");
  assert.deepEqual(await fake.calledRequest.json(), request);
});

test("rejects missing service, duplicate seller, and unsafe fils before calling the service", async () => {
  await assert.rejects(calculateTrustedQuote({}, request), /not configured/);
  await assert.rejects(calculateTrustedQuote({ QUOTE_SERVICE: { fetch() { throw new Error("must not run"); } } }, {
    ...request, sellers: [request.sellers[0], request.sellers[0]],
  }), /unique/);
  await assert.rejects(calculateTrustedQuote({ QUOTE_SERVICE: { fetch() { throw new Error("must not run"); } } }, {
    ...request, delivery_charge_fils: Number.MAX_SAFE_INTEGER + 1,
  }), /safe integer/);
});

test("rejects a quote response with altered sellers or inconsistent totals", async () => {
  const fake = serviceReturning({ ...response, sellers: [{ ...response.sellers[0], seller_id: "attacker" }, response.sellers[1]] });
  await assert.rejects(calculateTrustedQuote({ QUOTE_SERVICE: fake.binding }, request), /mismatched seller/);
  const badTotals = serviceReturning({ ...response, buyer_total_fils: 3000 });
  await assert.rejects(calculateTrustedQuote({ QUOTE_SERVICE: badTotals.binding }, request), /do not reconcile/);
});

test("fails closed on a non-success response or malformed JSON", async () => {
  const failure = serviceReturning({}, 503);
  await assert.rejects(calculateTrustedQuote({ QUOTE_SERVICE: failure.binding }, request), /503/);
  const malformed = { fetch: async () => new Response("not json", { headers: { "content-type": "application/json" } }) };
  await assert.rejects(calculateTrustedQuote({ QUOTE_SERVICE: malformed }, request), /invalid JSON/);
});
