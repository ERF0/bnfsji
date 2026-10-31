import test from "node:test";
import assert from "node:assert/strict";
import { authConfigured, publicSiteUrl, sameOriginPost, safeMfaReturnTo } from "./auth-config.js";

test("auth requires Supabase credentials and a secure canonical site origin", () => {
  assert.equal(authConfigured({}), false);
  assert.equal(authConfigured({ SUPABASE_URL: "https://project.supabase.co" }), false);
  assert.equal(authConfigured({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key" }), false);
  assert.equal(authConfigured({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public-key", PUBLIC_SITE_URL: "https://market.example" }), true);
});

test("MFA returns to localized administration destinations and rejects arbitrary redirects", () => {
  for (const locale of ["ar", "en"]) {
    for (const path of ["/admin", "/owner", "/owner/admins", "/owner/delivery", "/admin/sellers", "/admin/categories"]) {
      assert.equal(safeMfaReturnTo(`/${locale}${path}`, locale), `/${locale}${path}`);
    }
    for (const value of [null, "/admin", "https://attacker.example", "//attacker.example", `/${locale}/owner/../account`, `/${locale}/owner?redirect=https://attacker.example`]) {
      assert.equal(safeMfaReturnTo(value, locale), `/${locale}/account`);
    }
  }
});

test("OAuth callback origin accepts HTTPS and local development only", () => {
  assert.equal(publicSiteUrl("https://market.example/path"), "https://market.example");
  assert.equal(publicSiteUrl("http://localhost:5173"), "http://localhost:5173");
  assert.equal(publicSiteUrl("http://market.example"), null);
  assert.equal(publicSiteUrl("javascript:alert(1)"), null);
  assert.equal(publicSiteUrl("not a url"), null);
});

test("state-changing auth forms require the configured same-origin Origin header", () => {
  const request = (url, origin) => ({ url, headers: new Headers(origin ? { Origin: origin } : {}) });
  assert.equal(sameOriginPost(request("https://market.example/en/account", "https://market.example"), "https://market.example"), true);
  assert.equal(sameOriginPost(request("https://market.example/en/account", "https://attacker.example"), "https://market.example"), false);
  assert.equal(sameOriginPost(request("https://attacker.example/en/account", "https://attacker.example"), "https://market.example"), false);
  assert.equal(sameOriginPost(request("https://market.example/en/account"), "https://market.example"), false);
});
