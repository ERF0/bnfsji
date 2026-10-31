import { Link } from "react-router";
import { useWishlist } from "./wishlist-provider.jsx";

export function WishlistLink({ locale }) {
  const { ids, status } = useWishlist();
  const label = locale === "ar" ? "المفضلة" : "Wishlist";
  return <Link className="language-link wishlist-link" to={`/${locale}/wishlist`} aria-label={`${label}${status === "ready" && ids.length ? ` (${ids.length})` : ""}`}>
    {label}{status === "ready" && ids.length > 0 && <span className="cart-count" aria-hidden="true">{new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-JO").format(ids.length)}</span>}
  </Link>;
}

export function WishlistButton({ productId, locale }) {
  const { isSaved, isPending, status, toggle } = useWishlist();
  const saved = isSaved(productId);
  const pending = isPending(productId) || status === "loading";
  const label = locale === "ar"
    ? saved ? "إزالة من المفضلة" : "أضف إلى المفضلة"
    : saved ? "Remove from wishlist" : "Save to wishlist";
  return <button className="wishlist-button" type="button" aria-label={label} aria-pressed={saved} disabled={pending || status === "error"} onClick={() => { void toggle(productId); }}>
    <span aria-hidden="true">{saved ? "♥" : "♡"}</span><span>{label}</span>
  </button>;
}
