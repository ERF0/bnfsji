import test from "node:test";
import assert from "node:assert/strict";
import { localizedSeoLinks } from "./catalog.js";

test("localized SEO links point to the configured origin and both language routes", () => {
  assert.deepEqual(localizedSeoLinks("https://shop.example", "/p/store/item"), [
    { tagName: "link", rel: "canonical", href: "https://shop.example/ar/p/store/item" },
    { tagName: "link", rel: "alternate", hrefLang: "ar-JO", href: "https://shop.example/ar/p/store/item" },
    { tagName: "link", rel: "alternate", hrefLang: "en-JO", href: "https://shop.example/en/p/store/item" },
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: "https://shop.example/ar/p/store/item" },
  ]);
});

test("localized SEO links reject malformed origins and unsafe paths", () => {
  assert.deepEqual(localizedSeoLinks("https://shop.example/?preview=1", "/p/store/item"), []);
  assert.deepEqual(localizedSeoLinks("https://shop.example", "//attacker.example/item"), []);
  assert.deepEqual(localizedSeoLinks("http://shop.example", "/p/store/item"), []);
  assert.deepEqual(localizedSeoLinks("https://shop.example", "/p/store/item", "fr"), []);
});

test("English routes keep their own canonical while exposing both translations", () => {
  const links = localizedSeoLinks("https://shop.example", "/p/store/item", "en");
  assert.equal(links[0].href, "https://shop.example/en/p/store/item");
  assert.equal(links.find((link) => link.hrefLang === "ar-JO").href, "https://shop.example/ar/p/store/item");
});
