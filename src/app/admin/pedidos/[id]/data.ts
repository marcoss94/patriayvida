import {
  formatShippingAddressSummary,
  getAllowedStatusTransitions,
  parseShippingAddress,
  type OrderRow,
} from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AdminOrderDetailRow = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  mp_payment_id: OrderRow["mp_payment_id"];
  mp_preference_id: OrderRow["mp_preference_id"];
  delivery_method: OrderRow["delivery_method"];
  shipping_address: Json | null;
  shipping_cost: number;
  subtotal: number;
  total: number;
  profile: { full_name: string | null } | null;
  order_items:
    | Array<{
        id: string;
        quantity: number;
        unit_price: number;
        variant: {
          id: string;
          name: string;
          sku: string;
          attributes: { size?: string } | null;
          product: {
            id: string;
            name: string;
            slug: string;
          };
        };
      }>
    | null;
};

export const ADMIN_ORDER_DETAIL_SELECT = `
  id,
  user_id,
  created_at,
  updated_at,
  status,
  mp_status,
  mp_payment_id,
  mp_preference_id,
  delivery_method,
  shipping_address,
  shipping_cost,
  subtotal,
  total,
  profile:profiles!orders_user_id_fkey(full_name),
  order_items(
    id,
    quantity,
    unit_price,
    variant:product_variants!inner(
      id,
      name,
      sku,
      attributes,
      product:products!inner(
        id,
        name,
        slug
      )
    )
  )
`;

export function getAdminOrderOperationalFields(order: Pick<
  AdminOrderDetailRow,
  "id" | "user_id" | "created_at" | "updated_at" | "mp_status" | "mp_payment_id" | "mp_preference_id" | "delivery_method"
>, shippingSnapshot: ReturnType<typeof parseShippingAddress>) {
  return [
    { label: "ID pedido", value: order.id },
    { label: "ID cliente", value: order.user_id },
    { label: "Creado", value: order.created_at },
    { label: "Actualizado", value: order.updated_at },
    { label: "mp_status", value: order.mp_status ?? "Sin dato" },
    { label: "mp_payment_id", value: order.mp_payment_id ?? "Sin dato" },
    { label: "mp_preference_id", value: order.mp_preference_id ?? "Sin dato" },
    ...(order.delivery_method === "shipping"
      ? [
          {
            label: "Distancia estimada",
            value:
              shippingSnapshot.distanceKm === null
                ? "Sin dato"
                : `${shippingSnapshot.distanceKm.toFixed(2)} km`,
          },
          {
            label: "Regla de envío",
            value: shippingSnapshot.shippingRule ?? "Sin dato",
          },
          {
            label: "Geocode source",
            value: shippingSnapshot.geocodeSource ?? "Sin dato",
          },
        ]
      : []),
  ];
}

export async function loadAdminOrderDetail(
  id: string,
  deps: {
    createAdminClient?: typeof createAdminClient;
    onNotFound?: () => never;
  } = {}
) {
  const admin = (deps.createAdminClient ?? createAdminClient)();
  const { data, error } = await admin
    .from("orders")
    .select(ADMIN_ORDER_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return deps.onNotFound?.();
  }

  const order = data as unknown as AdminOrderDetailRow;
  const shippingSnapshot = parseShippingAddress(order.shipping_address);

  return {
    order,
    shippingSnapshot,
    shippingSummary: formatShippingAddressSummary(shippingSnapshot),
    lineItems: (order.order_items ?? []).map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
    })),
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shipping_cost),
    total: Number(order.total),
    allowedTransitions: getAllowedStatusTransitions(order.status),
    operationalFields: getAdminOrderOperationalFields(order, shippingSnapshot),
  };
}
