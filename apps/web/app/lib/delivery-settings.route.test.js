import assert from "node:assert/strict";
import test from "node:test";
import { cloudflareContext } from "./cloudflare-context.server.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { ownerDeliveryAction, sellerDeliveryAction } from "./delivery-settings.server.js";

const shopId = "00000000-0000-4000-8000-000000000005";
function contextFor(supabase, claims = { sub: "00000000-0000-4000-8000-000000000001", aal: "aal2" }) {
  return new Map([[supabaseAuthContext, supabase], [supabaseClaimsContext, claims], [cloudflareContext, { env: { PUBLIC_SITE_URL: "https://shop.example.test" } }]]);
}
function post(path, fields, origin = "https://shop.example.test") {
  return new Request(`https://shop.example.test${path}`, { method: "POST", headers: { Origin: origin }, body: new URLSearchParams(fields) });
}

test("seller delivery action verifies ownership and converts JOD exactly to fils", async () => {
  const calls = [];
  const supabase = { async rpc(name, args) {
    calls.push([name, args]);
    if (name === "get_owned_shop") return { data: [{ shop_id: shopId }], error: null };
    return { data: 2750, error: null };
  } };
  const result = await sellerDeliveryAction({ request: post("/en/seller/delivery", { intent: "save-seller-fee", shop_id: shopId, fee_jod: "2.75" }), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { saved: true });
  assert.deepEqual(calls[1], ["set_shop_delivery_fee", { p_shop_id: shopId, p_fee_fils: 2750 }]);
  assert.deepEqual(await sellerDeliveryAction({ request: post("/en/seller/delivery", { intent: "save-seller-fee", shop_id: shopId, fee_jod: "2.1234" }), params: { locale: "en" }, context: contextFor(supabase) }), { error: "invalid" });
  assert.deepEqual(await sellerDeliveryAction({ request: post("/en/seller/delivery", { intent: "save-seller-fee", shop_id: shopId, fee_jod: "2.75" }, "https://evil.example"), params: { locale: "en" }, context: contextFor(supabase) }), { error: "failed" });
});

test("platform delivery action requires a verified MFA owner session", async () => {
  let saved = false;
  const supabase = { async rpc(name) {
    if (name === "is_platform_owner") return { data: true, error: null };
    if (name === "set_platform_delivery_fee") saved = true;
    return { data: null, error: null };
  } };
  const lowAal = await ownerDeliveryAction({ request: post("/en/owner/delivery", { intent: "save-platform-fee", fee_jod: "3" }), params: { locale: "en" }, context: contextFor(supabase, { sub: "owner", aal: "aal1" }) });
  assert.deepEqual(lowAal, { error: "mfa" });
  assert.equal(saved, false);
  const result = await ownerDeliveryAction({ request: post("/en/owner/delivery", { intent: "save-platform-fee", fee_jod: "3.001" }), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { saved: true });
  assert.equal(saved, true);
});
