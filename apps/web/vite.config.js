import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const productionShowcaseStub = fileURLToPath(new URL("./app/lib/showcase-data-production.js", import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: mode === "production" ? [{ find: /^(?:\.\.\/lib\/|\.\/)?showcase-data\.js$/, replacement: productionShowcaseStub }] : [],
  },
  plugins: [cloudflare({
    viteEnvironment: { name: "ssr" },
    ...(mode === "development" ? { config: { compatibility_date: "2026-10-19" } } : {}),
  }), reactRouter()],
}));
