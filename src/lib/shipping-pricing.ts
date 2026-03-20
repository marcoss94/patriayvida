export const SHIPPING_BASE_UYU = 150;
export const SHIPPING_LONG_DISTANCE_UYU = 180;
export const SHIPPING_DISTANCE_THRESHOLD_KM = 9;

export function getShippingRule(
  distanceKm: number | null,
  deliveryMethod: "shipping" | "pickup",
) {
  if (deliveryMethod === "pickup") {
    return "pickup_no_shipping" as const;
  }

  if (distanceKm !== null && distanceKm > SHIPPING_DISTANCE_THRESHOLD_KM) {
    return "distance_gt_5km" as const;
  }

  return "distance_lte_5km_or_unknown" as const;
}

export function getShippingAmount(
  distanceKm: number | null,
  deliveryMethod: "shipping" | "pickup",
) {
  if (deliveryMethod === "pickup") {
    return 0;
  }

  if (distanceKm !== null && distanceKm > SHIPPING_DISTANCE_THRESHOLD_KM) {
    return SHIPPING_LONG_DISTANCE_UYU;
  }

  return SHIPPING_BASE_UYU;
}
