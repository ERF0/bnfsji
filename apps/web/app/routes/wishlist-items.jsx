import { cloudflareContext } from "../lib/cloudflare-context.server.js";
import { supabaseAuthContext, supabaseClaimsContext } from "../lib/auth-context.server.js";
import { normalizeLocale } from "../lib/catalog.js";
import { sameOriginPost } from "../lib/auth-config.js";
import { readWishlistChange } from "../lib/wishlist.server.js";

const PAGE_SIZE = 500;

async function loadIds(supabase, userId) {
  const ids = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("wishlist_items")
      .select("product_id").eq("user_id", userId)
      .order("created_at", { ascending: false }).order("product_id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return null;
    ids.push(...(data ?? []).map((row) => row.product_id));
    if (!data || data.length < PAGE_SIZE) return ids;
  }
}

function response(payload, status = 200) {
  return Response.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
}

function getSession(context, params) {
  const locale = normalizeLocale(params.locale);
  const supabase = context.get(supabaseAuthContext);
  const userId = context.get(supabaseClaimsContext)?.sub;
  return locale && supabase && userId ? { locale, supabase, userId } : null;
}

export async function loader({ context, params }) {
  const session = getSession(context, params);
  if (!session) return response({ error: "unauthorized" }, 401);
  const ids = await loadIds(session.supabase, session.userId);
  return ids ? response({ ids }) : response({ error: "unavailable" }, 503);
}

export async function action({ request, context, params }) {
  const session = getSession(context, params);
  if (!session) return response({ error: "unauthorized" }, 401);
  const env = context.get(cloudflareContext)?.env;
  if (!sameOriginPost(request, env?.PUBLIC_SITE_URL)) return response({ error: "forbidden" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return response({ error: "invalid" }, 415);
  const change = await readWishlistChange(request);
  if (change.error) return response({ error: "invalid" }, change.error);

  if (change.add.length) {
    const { data: visible, error: lookupError } = await session.supabase.from("products")
      .select("id").in("id", change.add);
    if (lookupError) return response({ error: "unavailable" }, 503);
    const ids = (visible ?? []).map((product) => product.id);
    if (ids.length) {
      const rows = ids.map((productId) => ({ user_id: session.userId, product_id: productId }));
      const { error } = await session.supabase.from("wishlist_items")
        .upsert(rows, { onConflict: "user_id,product_id", ignoreDuplicates: true });
      if (error) return response({ error: "unavailable" }, 503);
    }
  }

  if (change.remove.length) {
    const { error } = await session.supabase.from("wishlist_items")
      .delete().eq("user_id", session.userId).in("product_id", change.remove);
    if (error) return response({ error: "unavailable" }, 503);
  }

  const ids = await loadIds(session.supabase, session.userId);
  return ids ? response({ ids }) : response({ error: "unavailable" }, 503);
}

