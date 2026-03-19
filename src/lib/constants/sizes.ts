/**
 * Fixed t-shirt sizes for the store.
 * These are the only valid variant sizes — no free-text allowed.
 */
export const AVAILABLE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export type TShirtSize = (typeof AVAILABLE_SIZES)[number];
