import test from "node:test";
import assert from "node:assert/strict";
import { createContentSecurityPolicy, setBrowserSecurityHeaders } from "./security-headers.js";

test("browser security headers set safe defaults without changing cache policy", () => {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  assert.equal(setBrowserSecurityHeaders(headers), headers);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("Permissions-Policy"), "camera=(), geolocation=(), microphone=()");
  assert.equal(headers.get("X-Permitted-Cross-Domain-Policies"), "none");
  assert.equal(headers.get("Cache-Control"), "private, no-store");
});

test("CSP allows only same-origin assets and the response nonce for inline scripts", () => {
  const policy = createContentSecurityPolicy("Y3NwLW5vbmNlLXRlc3Q=");
  assert.match(policy, /script-src 'self' 'nonce-Y3NwLW5vbmNlLXRlc3Q='/);
  assert.match(policy, /style-src 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|https?:\/\//);
});

test("CSP refuses a missing or malformed nonce", () => {
  assert.throws(() => createContentSecurityPolicy(""), TypeError);
  assert.throws(() => createContentSecurityPolicy("bad nonce"), TypeError);
});
