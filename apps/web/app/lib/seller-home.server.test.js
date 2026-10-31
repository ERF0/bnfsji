import assert from "node:assert/strict";
import test from "node:test";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { loader } from "./seller-home.server.js";

const userId = "00000000-0000-4000-8000-000000000001";
const shopId = "00000000-0000-4000-8000-000000000002";

function contextFor({ claims = null, supabase = null } = {}) {
  return new Map([[supabaseClaimsContext, claims], [supabaseAuthContext, supabase]]);
}

test("seller workspace keeps signed-out state explicit", async () => {
  assert.deepEqual(await loader({ params: { locale: "en" }, context: contextFor() }), {
    locale: "en", userId: null, state: "signed-out",
  });
});

test("seller workspace derives setup status from authorized catalog and owner delivery data", async () => {
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push([name, args]);
      if (name === "list_catalog_shops") return { data: [{ shop_id: shopId, name_ar: "متجر", name_en: "Shop" }], error: null };
      if (name === "get_owned_shop") return { data: [{ shop_id: shopId }], error: null };
      if (name === "list_shop_catalog") return { data: [{ product_id: "p1" }], error: null };
      if (name === "get_my_delivery_settings") return { data: [{ shop_id: shopId, seller_fee_fils: 2500 }], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const result = await loader({ params: { locale: "ar" }, context: contextFor({ claims: { sub: userId }, supabase }) });
  assert.deepEqual(result, {
    locale: "ar", userId, state: "shop", shop: { shop_id: shopId, name_ar: "متجر", name_en: "Shop" },
    isOwner: true, productCount: 1, deliveryConfigured: true,
  });
  assert.deepEqual(calls.map(([name]) => name).sort(), ["get_my_delivery_settings", "get_owned_shop", "list_catalog_shops", "list_shop_catalog"].sort());
});

test("seller workspace shows application status when no catalog shop is available", async () => {
  const application = { id: "application-1", status: "submitted", rejection_reason: null };
  const supabase = {
    async rpc(name) {
      if (name === "list_catalog_shops" || name === "get_owned_shop") return { data: [], error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    from(table) {
      assert.equal(table, "seller_applications");
      return { select(columns) {
        assert.equal(columns, "id,status,rejection_reason");
        return { eq(field, value) {
          assert.equal(field, "applicant_user_id");
          assert.equal(value, userId);
          return { maybeSingle: async () => ({ data: application, error: null }) };
        } };
      } };
    },
  };
  const result = await loader({ params: { locale: "en" }, context: contextFor({ claims: { sub: userId }, supabase }) });
  assert.deepEqual(result, { locale: "en", userId, state: "application", application });
});

test("seller workspace rejects unsupported locale instead of defaulting silently", async () => {
  await assert.rejects(loader({ params: { locale: "fr" }, context: contextFor() }), (error) => error instanceof Response && error.status === 404);
});
