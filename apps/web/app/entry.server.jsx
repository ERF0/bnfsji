import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { createContentSecurityPolicy } from "./lib/security-headers.js";

export const streamTimeout = 5_000;

function createNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export default async function handleRequest(request, responseStatusCode, responseHeaders, routerContext) {
  const nonce = createNonce();
  responseHeaders.set("Content-Security-Policy", createContentSecurityPolicy(nonce));

  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }

  let shellRendered = false;
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    {
      signal: AbortSignal.timeout(streamTimeout + 1_000),
      onError(error) {
        if (shellRendered) console.error(error);
        responseStatusCode = 500;
      },
    },
  );
  shellRendered = true;

  if ((request.headers.get("user-agent") && isbot(request.headers.get("user-agent"))) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
