export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

export interface Cart {
  items: CartItem[];
  deliveryMethod: "pickup" | "shipping";
}

export function getCartTotal(cart: Cart): number {
  return cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
}

export function getCartItemCount(cart: Cart): number {
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

export const EMPTY_CART: Cart = {
  items: [],
  deliveryMethod: "pickup",
};
