import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/cloudflare-context.server.js";
import { setBrowserSecurityHeaders } from "../app/lib/security-headers.js";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const routerContext = new RouterContextProvider();
    routerContext.set(cloudflareContext, { env, ctx });
    const response = await requestHandler(request, routerContext);
    const headers = setBrowserSecurityHeaders(new Headers(response.headers));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
