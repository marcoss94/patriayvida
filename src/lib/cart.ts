export const CART_STORAGE_KEY = "patriayvida-cart";
export const CART_QUANTITY_CAP = 10;

export interface CartItem {
  productId: string;
  variantId: string;
  slug: string;
  productName: string;
  variantName: string;
  size: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  stock: number;
}

export interface Cart {
  items: CartItem[];
}

export type CartItemInput = Omit<CartItem, "quantity"> & {
  quantity: number;
};

type UnknownRecord = Record<string, unknown>;

export const EMPTY_CART: Cart = {
  items: [],
};

export function getCartLineMaxQuantity(
  stock: number,
  cap = CART_QUANTITY_CAP
): number {
  if (!Number.isFinite(stock) || stock <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(stock), cap);
}

export function sanitizeCartQuantity(
  quantity: number,
  stock: number,
  cap = CART_QUANTITY_CAP
): number {
  const max = getCartLineMaxQuantity(stock, cap);

  if (max === 0) {
    return 0;
  }

  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.max(1, Math.min(Math.trunc(quantity), max));
}

export function getCartSubtotal(cart: Cart): number {
  return cart.items.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0
  );
}

export function getCartTotal(cart: Cart): number {
  return getCartSubtotal(cart);
}

export function getCartItemCount(cart: Cart): number {
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}

export function createCartItem(input: CartItemInput): CartItem | null {
  const quantity = sanitizeCartQuantity(input.quantity, input.stock);

  if (quantity === 0) {
    return null;
  }

  return {
    ...input,
    imageUrl: input.imageUrl ?? null,
    size: input.size ?? null,
    quantity,
    stock: Math.max(0, Math.trunc(input.stock)),
    unitPrice: Math.trunc(input.unitPrice),
  };
}

export function addCartItem(cart: Cart, input: CartItemInput): Cart {
  const nextItem = createCartItem(input);

  if (!nextItem) {
    return cart;
  }

  const existingItem = cart.items.find(
    (item) => item.variantId === nextItem.variantId
  );

  if (!existingItem) {
    return {
      items: [...cart.items, nextItem],
    };
  }

  return {
    items: cart.items.map((item) => {
      if (item.variantId !== nextItem.variantId) {
        return item;
      }

      return {
        ...nextItem,
        quantity: sanitizeCartQuantity(
          item.quantity + nextItem.quantity,
          nextItem.stock
        ),
      };
    }),
  };
}

export function updateCartItemQuantity(
  cart: Cart,
  variantId: string,
  quantity: number
): Cart {
  const item = cart.items.find((entry) => entry.variantId === variantId);

  if (!item) {
    return cart;
  }

  const nextQuantity = sanitizeCartQuantity(quantity, item.stock);

  if (nextQuantity === 0) {
    return removeCartItem(cart, variantId);
  }

  return {
    items: cart.items.map((entry) =>
      entry.variantId === variantId
        ? {
            ...entry,
            quantity: nextQuantity,
          }
        : entry
    ),
  };
}

export function removeCartItem(cart: Cart, variantId: string): Cart {
  return {
    items: cart.items.filter((item) => item.variantId !== variantId),
  };
}

export function clearCart(): Cart {
  return EMPTY_CART;
}

export function parseStoredCart(rawValue: string | null): Cart {
  if (!rawValue) {
    return EMPTY_CART;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      return EMPTY_CART;
    }

    const items = parsed.items
      .map((item) => parseStoredCartItem(item))
      .filter((item): item is CartItem => item !== null);

    return { items };
  } catch {
    return EMPTY_CART;
  }
}

export function serializeCart(cart: Cart): string {
  return JSON.stringify(cart);
}

function parseStoredCartItem(value: unknown): CartItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const productId = getString(value.productId);
  const variantId = getString(value.variantId);
  const slug = getString(value.slug);
  const productName = getString(value.productName);
  const variantName = getString(value.variantName);
  const unitPrice = getNumber(value.unitPrice);
  const quantity = getNumber(value.quantity);
  const stock = getNumber(value.stock);

  if (
    !productId ||
    !variantId ||
    !slug ||
    !productName ||
    !variantName ||
    unitPrice === null ||
    quantity === null ||
    stock === null
  ) {
    return null;
  }

  return createCartItem({
    productId,
    variantId,
    slug,
    productName,
    variantName,
    size: getNullableString(value.size),
    imageUrl: getNullableString(value.imageUrl),
    unitPrice,
    quantity,
    stock,
  });
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
