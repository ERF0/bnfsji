import assert from "node:assert/strict";
import test from "node:test";
import { cloudflareContext } from "./cloudflare-context.server.js";
import { supabaseAuthContext, supabaseClaimsContext } from "./auth-context.server.js";
import { action, loader } from "./account.server.js";

const userId = "00000000-0000-4000-8000-000000000001";

function contextFor({ claims = null, supabase = null } = {}) {
  return new Map([
    [cloudflareContext, { env: { SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key", PUBLIC_SITE_URL: "https://shop.example" } }],
    [supabaseAuthContext, supabase],
    [supabaseClaimsContext, claims],
  ]);
}

test("account loader does not query seller data for a signed-out visitor", async () => {
  const result = await loader({ params: { locale: "en" }, context: contextFor() });
  assert.equal(result.email, null);
  assert.equal(result.sellerSetup, null);
});

test("account loader scopes seller setup lookup to the authenticated account", async () => {
  const calls = [];
  const supabase = { from(table) {
    assert.equal(table, "seller_applications");
    return { select(columns) {
      assert.equal(columns, "status");
      return { eq(field, value) {
        calls.push([field, value]);
        return { maybeSingle: async () => ({ data: { status: "rejected" }, error: null }) };
      } };
    } };
  } };
  const result = await loader({ params: { locale: "en" }, context: contextFor({ claims: { sub: userId, email: "seller@example.test" }, supabase }) });
  assert.equal(result.email, "seller@example.test");
  assert.deepEqual(result.sellerSetup, { state: "ready", status: "rejected" });
  assert.deepEqual(calls, [["applicant_user_id", userId]]);
});

test("account loader fails closed when seller state cannot be read", async () => {
  const supabase = { from() { return { select() { return { eq() { return { maybeSingle: async () => ({ data: null, error: new Error("denied") }) }; } }; } }; } };
  const result = await loader({ params: { locale: "en" }, context: contextFor({ claims: { sub: userId }, supabase }) });
  assert.deepEqual(result.sellerSetup, { state: "unavailable" });
});

test("account sign-out keeps the same-origin boundary and redirects after auth succeeds", async () => {
  let signOutCalls = 0;
  const supabase = { auth: { async signOut() { signOutCalls += 1; return { error: null }; } } };
  const context = contextFor({ claims: { sub: userId }, supabase });
  const crossOrigin = await action({
    request: new Request("https://shop.example/en/account", { method: "POST", headers: { Origin: "https://attacker.example" }, body: new URLSearchParams({ intent: "sign-out" }) }),
    params: { locale: "en" }, context,
  });
  assert.deepEqual(crossOrigin, { error: "failed" });
  assert.equal(signOutCalls, 0);
  const response = await action({
    request: new Request("https://shop.example/en/account", { method: "POST", headers: { Origin: "https://shop.example" }, body: new URLSearchParams({ intent: "sign-out" }) }),
    params: { locale: "en" }, context,
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/en/account");
  assert.equal(signOutCalls, 1);
});
