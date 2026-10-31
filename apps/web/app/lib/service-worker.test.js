import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../../public/service-worker.js", import.meta.url), "utf8");

function createWorker(fetchImpl) {
  const listeners = new Map();
  const puts = [];
  const precache = [];
  const cache = {
    addAll: async (paths) => precache.push(...paths),
    put: async (request, response) => puts.push({ request, response }),
  };
  const matches = [];
  const self = {
    location: { origin: "https://market.example" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  const caches = {
    open: async () => cache,
    match: async (request) => { matches.push(request); return undefined; },
    keys: async () => ["bnafsaji-static-v1", "other-cache"],
    delete: async () => true,
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, URL, Response, Promise, Set });
  return { listeners, puts, precache, matches };
}

test("install precaches only the offline shell and fixed brand assets", async () => {
  const worker = createWorker(async () => new Response("network"));
  let installPromise;
  worker.listeners.get("install")({ waitUntil: (promise) => { installPromise = promise; } });
  await installPromise;
  assert.deepEqual(worker.precache, ["/offline.html", "/offline.css", "/manifest.webmanifest", "/bnafsaji.svg", "/icon-180.png", "/icon-192.png", "/icon-512.png"]);
});

test("navigation is never cached and failed navigation receives only the static offline page", async () => {
  const worker = createWorker(async () => new Response("private account response"));
  const successful = { request: { method: "GET", url: "https://market.example/en/account", mode: "navigate" }, respondWith(value) { this.response = value; } };
  worker.listeners.get("fetch")(successful);
  assert.equal(await (await successful.response).text(), "private account response");
  assert.equal(worker.puts.length, 0);

  const offlineWorker = createWorker(async () => { throw new Error("offline"); });
  const event = { request: { method: "GET", url: "https://market.example/en/orders", mode: "navigate" }, respondWith(value) { this.response = value; } };
  offlineWorker.listeners.get("fetch")(event);
  await event.response;
  assert.deepEqual(offlineWorker.matches, ["/offline.html"]);
  assert.equal(offlineWorker.puts.length, 0);
});

test("only fixed same-origin brand assets are cached; app chunks, APIs and mutations bypass the worker cache", async () => {
  const worker = createWorker(async () => new Response("static asset"));
  const staticEvent = { request: { method: "GET", url: "https://market.example/icon-192.png", mode: "no-cors" }, respondWith(value) { this.response = value; } };
  worker.listeners.get("fetch")(staticEvent);
  assert.equal(await (await staticEvent.response).text(), "static asset");
  assert.equal(worker.puts.length, 1);

  for (const request of [
    { method: "GET", url: "https://market.example/api/orders", mode: "cors" },
    { method: "GET", url: "https://market.example/assets/app.js", mode: "no-cors" },
    { method: "POST", url: "https://market.example/en/checkout", mode: "same-origin" },
    { method: "GET", url: "https://third-party.example/assets/app.js", mode: "no-cors" },
  ]) {
    let intercepted = false;
    worker.listeners.get("fetch")({ request, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
  assert.equal(worker.puts.length, 1);
});
