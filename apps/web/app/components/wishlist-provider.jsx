import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { mergeWishlistIds, normalizeWishlistIds, readWishlist, toggleWishlistId, WISHLIST_BATCH_SIZE, writeWishlist } from "../lib/wishlist.js";

const WishlistContext = createContext(null);
async function sendChange(locale, add, remove = []) {
  const response = await fetch(`/${locale}/wishlist/items`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ add, remove }),
  });
  if (!response.ok) throw new Error("wishlist update failed");
  return normalizeWishlistIds((await response.json()).ids);
}

export function WishlistProvider({ children, userId, locale }) {
  const [guestIds, setGuestIds] = useState([]);
  const [guestReady, setGuestReady] = useState(false);
  const [account, setAccount] = useState({ userId: null, ids: [], status: "guest" });
  const [pendingIds, setPendingIds] = useState([]);

  useEffect(() => { setGuestIds(readWishlist()); setGuestReady(true); }, []);
  useEffect(() => { if (guestReady && !userId) writeWishlist(guestIds); }, [guestIds, guestReady, userId]);

  useEffect(() => {
    if (!guestReady) return undefined;
    if (!userId) {
      setAccount({ userId: null, ids: [], status: "guest" });
      return undefined;
    }
    let cancelled = false;
    setAccount({ userId, ids: [], status: "loading" });
    (async () => {
      try {
        const response = await fetch(`/${locale}/wishlist/items`, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("wishlist load failed");
        let ids = normalizeWishlistIds((await response.json()).ids);
        for (let offset = 0; offset < guestIds.length; offset += WISHLIST_BATCH_SIZE) {
          ids = await sendChange(locale, guestIds.slice(offset, offset + WISHLIST_BATCH_SIZE));
        }
        if (guestIds.length) {
          writeWishlist([]);
          setGuestIds([]);
        }
        if (!cancelled) setAccount({ userId, ids: mergeWishlistIds(ids), status: "ready" });
      } catch {
        if (!cancelled) setAccount({ userId, ids: [], status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [guestReady, userId, locale]);

  const accountReady = Boolean(userId && account.userId === userId && account.status === "ready");
  const ids = userId ? accountReady ? account.ids : [] : guestIds;
  const status = userId ? account.userId === userId ? account.status : "loading" : guestReady ? "ready" : "loading";

  async function toggle(productId) {
    if (!guestReady || pendingIds.includes(productId)) return false;
    if (!userId) {
      setGuestIds((current) => toggleWishlistId(current, productId));
      return true;
    }
    if (!accountReady) return false;
    const remove = account.ids.includes(productId);
    setPendingIds((current) => [...current, productId]);
    try {
      const next = await sendChange(locale, remove ? [] : [productId], remove ? [productId] : []);
      setAccount({ userId, ids: next, status: "ready" });
      return true;
    } catch {
      setAccount((current) => current.userId === userId ? { ...current, status: "error" } : current);
      return false;
    } finally {
      setPendingIds((current) => current.filter((id) => id !== productId));
    }
  }

  const value = useMemo(() => ({
    ids, status, isSaved: (id) => ids.includes(id), isPending: (id) => pendingIds.includes(id), toggle,
  }), [ids, status, pendingIds, userId, locale, accountReady, guestReady]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const wishlist = useContext(WishlistContext);
  if (!wishlist) throw new Error("useWishlist must be used within WishlistProvider");
  return wishlist;
}
