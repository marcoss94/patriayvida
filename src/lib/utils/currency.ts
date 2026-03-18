/**
 * Formats a price in Uruguayan pesos (UYU).
 *
 * The database stores full currency units, so `990` means `$ 990`.
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Formats stock count with contextual message
 * @param stock - Available units
 * @returns User-friendly stock message
 */
export function formatStock(stock: number): string {
  if (stock === 0) return 'Sin stock';
  if (stock <= 3) return `Quedan ${stock}`;
  return `${stock} disponibles`;
}

/**
 * Checks if a variant has available stock
 */
export function hasStock(stock: number): boolean {
  return stock > 0;
}

/**
 * Gets the maximum quantity a user can add to cart
 * @param stock - Available stock
 * @param maxAllowed - Maximum allowed per purchase (default 10)
 */
export function getMaxQuantity(stock: number, maxAllowed = 10): number {
  return Math.min(stock, maxAllowed);
}
