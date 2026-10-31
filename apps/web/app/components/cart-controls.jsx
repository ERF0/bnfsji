import { Link } from "react-router";
import { useState } from "react";
import { MAX_CART_LINES } from "../lib/cart.js";
import { useCart } from "./cart-provider.jsx";

export function CartLink({ locale, text }) {
  const { itemCount, ready } = useCart();
  return <Link className="language-link cart-link" to={`/${locale}/cart`} aria-label={`${text}${ready ? ` (${itemCount})` : ""}`}>
    {text}{ready && itemCount > 0 && <span className="cart-count" aria-hidden="true">{new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-JO").format(itemCount)}</span>}
  </Link>;
}

export function AddToCartButton({ product, text }) {
  const { addItem, lines } = useCart();
  const [added, setAdded] = useState(false);
  const capped = lines.length >= MAX_CART_LINES && !lines.some((line) => line.variant_id === product?.variant_id);
  return <button className="button button-secondary cart-add-button" type="button" disabled={!product?.variant_id || capped} onClick={() => { addItem(product); setAdded(true); }}>
    {capped ? text.limit : added ? text.added : text.add}
  </button>;
}
