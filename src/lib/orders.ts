import type { Json, Tables } from "@/types/database";

export type OrderRow = Tables<"orders">;

type ShippingAddressSnapshot = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
};

function isRecord(value: Json | null): value is Record<string, Json | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringField(record: Record<string, Json | undefined>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function formatOrderReference(orderId: string) {
  return `PYV-${orderId.slice(0, 8).toUpperCase()}`;
}

export function formatOrderDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-UY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getOrderStatusMeta(status: OrderRow["status"]) {
  switch (status) {
    case "pending":
      return { label: "Pendiente", tone: "pending" as const };
    case "paid":
      return { label: "Pagado", tone: "success" as const };
    case "preparing":
      return { label: "Preparando", tone: "accent" as const };
    case "shipped":
      return { label: "Enviado", tone: "accent" as const };
    case "delivered":
      return { label: "Entregado", tone: "success" as const };
    case "cancelled":
      return { label: "Cancelado", tone: "danger" as const };
    default:
      return { label: status, tone: "neutral" as const };
  }
}

function getMpStatusBase(mpStatus: string | null) {
  return mpStatus?.split(":", 1)[0] ?? null;
}

export function getPaymentStatusMeta(order: Pick<OrderRow, "status" | "mp_status">) {
  if (["paid", "preparing", "shipped", "delivered"].includes(order.status)) {
    return { label: "Pago acreditado", tone: "success" as const };
  }

  if (order.status === "cancelled") {
    return { label: "Orden cancelada", tone: "danger" as const };
  }

  switch (getMpStatusBase(order.mp_status)) {
    case "approved":
    case "authorized":
      return { label: "Pago aprobado", tone: "success" as const };
    case "pending":
    case "in_process":
      return { label: "Pago pendiente", tone: "pending" as const };
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return { label: "Pago rechazado", tone: "danger" as const };
    case "preference_created":
    case "preference_pending":
      return { label: "Pago iniciado", tone: "neutral" as const };
    case "merchant_order":
      return { label: "Pago conciliando", tone: "neutral" as const };
    default:
      return { label: "Sin confirmacion", tone: "neutral" as const };
  }
}

export function getDeliveryMethodLabel(deliveryMethod: OrderRow["delivery_method"]) {
  return deliveryMethod === "shipping" ? "Envio" : "Retiro";
}

export function parseShippingAddress(shippingAddress: Json | null): ShippingAddressSnapshot {
  if (!isRecord(shippingAddress)) {
    return {
      fullName: null,
      email: null,
      phone: null,
      address: null,
      city: null,
      notes: null,
    };
  }

  return {
    fullName: getStringField(shippingAddress, "full_name"),
    email: getStringField(shippingAddress, "email"),
    phone: getStringField(shippingAddress, "phone"),
    address: getStringField(shippingAddress, "address"),
    city: getStringField(shippingAddress, "city"),
    notes: getStringField(shippingAddress, "notes"),
  };
}

export function getOrderItemCount(items: Array<{ quantity: number }> | null | undefined) {
  return (items ?? []).reduce((total, item) => total + item.quantity, 0);
}
