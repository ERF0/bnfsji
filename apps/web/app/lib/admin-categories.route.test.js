import assert from "node:assert/strict";
import test from "node:test";
import { cloudflareContext } from "./cloudflare-context.server.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { action } from "./admin-categories.server.js";

const proposalId = "00000000-0000-4000-8000-000000000001";

function contextFor(supabase) {
  return new Map([
    [supabaseAuthContext, supabase],
    [supabaseClaimsContext, { sub: "00000000-0000-4000-8000-000000000002", aal: "aal2" }],
    [cloudflareContext, { env: { PUBLIC_SITE_URL: "https://shop.example.test" } }],
  ]);
}

function post(fields) {
  return new Request("https://shop.example.test/en/admin/categories", {
    method: "POST", headers: { Origin: "https://shop.example.test" }, body: new URLSearchParams(fields),
  });
}

test("category proposal action stores bilingual names in the pending approval workflow", async () => {
  const calls = [];
  const supabase = { async rpc(name, args) { calls.push([name, args]); return { data: proposalId, error: null }; } };
  const result = await action({ request: post({ intent: "propose", slug: "home-goods", name_ar: "المنزل", name_en: "Home goods" }), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { proposed: true });
  assert.deepEqual(calls, [["propose_category", { p_slug: "home-goods", p_name_ar: "المنزل", p_name_en: "Home goods" }]]);
  assert.deepEqual(await action({ request: post({ intent: "propose", slug: "Home Goods", name_ar: "Home", name_en: "Home" }), params: { locale: "en" }, context: contextFor(supabase) }), { error: "failed" });
});

test("category approval action delegates activation to the owner-gated database function", async () => {
  const calls = [];
  const supabase = { async rpc(name, args) { calls.push([name, args]); return { data: null, error: null }; } };
  const result = await action({ request: post({ intent: "approve-category", proposal_id: proposalId }), params: { locale: "en" }, context: contextFor(supabase) });
  assert.deepEqual(result, { reviewed: true });
  assert.deepEqual(calls, [["review_category_proposal", { p_proposal_id: proposalId, p_decision: "approve" }]]);
});
