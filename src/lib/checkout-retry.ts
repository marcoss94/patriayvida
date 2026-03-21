import type { Json, Tables } from "@/types/database";
import type { CheckoutOrderLine } from "@/lib/checkout";

export const RECENT_PENDING_ORDER_REUSE_WINDOW_MS = 30 * 60 * 1000;

type PendingOrderCandidate = Pick<
  Tables<"orders">,
  | "id"
  | "status"
  | "mp_payment_id"
  | "mp_preference_id"
  | "mp_status"
  | "delivery_method"
  | "shipping_cost"
  | "subtotal"
  | "total"
  | "shipping_address"
  | "created_at"
>;

type PendingOrderCandidateItem = Pick<
  Tables<"order_items">,
  "order_id" | "variant_id" | "quantity" | "unit_price"
>;

const RETRYABLE_MP_STATUSES = new Set([
  "abandoned",
  "cancelled",
  "charged_back",
  "order_items_error",
  "preference_created",
  "preference_error",
  "preference_missing_redirect",
  "preference_pending",
  "rejected",
  "refunded",
]);

const MATCHED_SHIPPING_ADDRESS_KEYS = [
  "full_name",
  "email",
  "phone",
  "address",
  "city",
  "notes",
  "shipping_rule",
  "shipping_price_uyu",
] as const;

function getMercadoPagoStatusBase(value: string | null) {
  return value?.split(":", 1)[0]?.trim().toLowerCase() || null;
}

function isRecord(value: Json | null): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeShippingValue(value: Json | undefined) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return value ?? null;
}

function normalizeOrderLines(orderLines: CheckoutOrderLine[]) {
  return [...orderLines]
    .map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
}

function normalizeOrderItems(orderItems: PendingOrderCandidateItem[]) {
  return [...orderItems]
    .map((item) => ({
      variantId: item.variant_id,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
}

function hasMatchingCart(
  orderItems: PendingOrderCandidateItem[],
  orderLines: CheckoutOrderLine[],
) {
  const normalizedItems = normalizeOrderItems(orderItems);
  const normalizedLines = normalizeOrderLines(orderLines);

  if (normalizedItems.length === 0 || normalizedItems.length !== normalizedLines.length) {
    return false;
  }

  return normalizedItems.every((item, index) => {
    const line = normalizedLines[index];

    return (
      item.variantId === line?.variantId &&
      item.quantity === line.quantity &&
      item.unitPrice === line.unitPrice
    );
  });
}

function hasMatchingShippingContext(
  order: Pick<
    PendingOrderCandidate,
    "delivery_method" | "shipping_cost" | "subtotal" | "total" | "shipping_address"
  >,
  checkout: Pick<
    PendingOrderCandidate,
    "delivery_method" | "shipping_cost" | "subtotal" | "total" | "shipping_address"
  >,
) {
  if (
    order.delivery_method !== checkout.delivery_method ||
    order.shipping_cost !== checkout.shipping_cost ||
    order.subtotal !== checkout.subtotal ||
    order.total !== checkout.total
  ) {
    return false;
  }

  const orderAddress = isRecord(order.shipping_address) ? order.shipping_address : {};
  const checkoutAddress = isRecord(checkout.shipping_address) ? checkout.shipping_address : {};

  return MATCHED_SHIPPING_ADDRESS_KEYS.every((key) => {
    return normalizeShippingValue(orderAddress[key]) === normalizeShippingValue(checkoutAddress[key]);
  });
}

export function canRetryPendingOrderPayment(
  order: Pick<PendingOrderCandidate, "status" | "mp_status" | "mp_payment_id">,
) {
  if (order.status !== "pending") {
    return false;
  }

  const mpStatusBase = getMercadoPagoStatusBase(order.mp_status);

  if (mpStatusBase === null) {
    return order.mp_payment_id === null;
  }

  return RETRYABLE_MP_STATUSES.has(mpStatusBase);
}

export function selectReusablePendingOrder(params: {
  currentTime?: Date;
  orderLines: CheckoutOrderLine[];
  orders: PendingOrderCandidate[];
  orderItems: PendingOrderCandidateItem[];
  checkout: Pick<
    PendingOrderCandidate,
    "delivery_method" | "shipping_cost" | "subtotal" | "total" | "shipping_address"
  >;
}) {
  const now = params.currentTime ?? new Date();

  return [...params.orders]
    .sort((left, right) => {
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    })
    .find((order) => {
      if (!canRetryPendingOrderPayment(order)) {
        return false;
      }

      const createdAt = new Date(order.created_at);

      if (
        Number.isNaN(createdAt.getTime()) ||
        now.getTime() - createdAt.getTime() > RECENT_PENDING_ORDER_REUSE_WINDOW_MS
      ) {
        return false;
      }

      const itemsForOrder = params.orderItems.filter((item) => item.order_id === order.id);

      return (
        hasMatchingCart(itemsForOrder, params.orderLines) &&
        hasMatchingShippingContext(order, params.checkout)
      );
    }) ?? null;
}
