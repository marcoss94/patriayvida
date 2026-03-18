"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import {
  addCartItem,
  CART_STORAGE_KEY,
  clearCart,
  EMPTY_CART,
  getCartItemCount,
  getCartSubtotal,
  parseStoredCart,
  removeCartItem,
  serializeCart,
  updateCartItemQuantity,
  type Cart,
  type CartItemInput,
} from "@/lib/cart";

type CartStoreState = {
  cart: Cart;
  isHydrated: boolean;
  hydrate: () => void;
  addItem: (item: CartItemInput) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearItems: () => void;
};

type CartSnapshot = {
  cart: Cart;
  isHydrated: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (item: CartItemInput) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearItems: () => void;
};

function writeCartToStorage(cart: Cart) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(cart));
}

export const useCartStore = create<CartStoreState>((set, get) => ({
  cart: EMPTY_CART,
  isHydrated: false,
  hydrate: () => {
    if (get().isHydrated || typeof window === "undefined") {
      return;
    }

    set({
      cart: parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY)),
      isHydrated: true,
    });
  },
  addItem: (item) => {
    const cart = addCartItem(get().cart, item);
    writeCartToStorage(cart);
    set({ cart, isHydrated: true });
  },
  updateQuantity: (variantId, quantity) => {
    const cart = updateCartItemQuantity(get().cart, variantId, quantity);
    writeCartToStorage(cart);
    set({ cart, isHydrated: true });
  },
  removeItem: (variantId) => {
    const cart = removeCartItem(get().cart, variantId);
    writeCartToStorage(cart);
    set({ cart, isHydrated: true });
  },
  clearItems: () => {
    const cart = clearCart();
    writeCartToStorage(cart);
    set({ cart, isHydrated: true });
  },
}));

export function useCart(): CartSnapshot {
  const hydrate = useCartStore((state) => state.hydrate);
  const cart = useCartStore((state) => state.cart);
  const isHydrated = useCartStore((state) => state.isHydrated);
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearItems = useCartStore((state) => state.clearItems);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return useMemo(
    () => ({
      cart,
      isHydrated,
      itemCount: getCartItemCount(cart),
      subtotal: getCartSubtotal(cart),
      addItem,
      updateQuantity,
      removeItem,
      clearItems,
    }),
    [cart, isHydrated, addItem, updateQuantity, removeItem, clearItems]
  );
}
