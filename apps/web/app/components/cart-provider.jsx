import { createContext, useContext, useEffect, useState } from "react";
import { addCartItem, readCart, removeCartItem, setCartQuantity, writeCart } from "../lib/cart.js";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeCart(lines);
  }, [lines, ready]);

  const cart = {
    lines,
    ready,
    itemCount: lines.reduce((count, line) => count + line.quantity, 0),
    addItem: (product) => setLines((current) => addCartItem(current, product)),
    setQuantity: (id, quantity) => setLines((current) => setCartQuantity(current, id, quantity)),
    removeItem: (id) => setLines((current) => removeCartItem(current, id)),
  };

  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used within CartProvider");
  return cart;
}
