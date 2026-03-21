import { parseShippingAddress, type OrderRow } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type OrderDetailRow = {
  id: string;
  created_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  mp_payment_id: OrderRow["mp_payment_id"];
  mp_preference_id: OrderRow["mp_preference_id"];
  delivery_method: OrderRow["delivery_method"];
  shipping_address: Json | null;
  shipping_cost: number;
  subtotal: number;
  total: number;
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

export const USER_ORDER_DETAIL_SELECT = `
  id,
  created_at,
  status,
  mp_status,
  mp_payment_id,
  mp_preference_id,
  delivery_method,
  shipping_address,
  shipping_cost,
  subtotal,
  total,
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

export async function loadUserOrderDetail(
  id: string,
  deps: {
    createClient?: typeof createClient;
    onNotFound?: () => never;
  } = {}
) {
  const supabase = await (deps.createClient ?? createClient)();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select(USER_ORDER_DETAIL_SELECT)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return deps.onNotFound?.();
  }

  const order = data as unknown as OrderDetailRow;

  return {
    order,
    shippingSnapshot: parseShippingAddress(order.shipping_address),
    lineItems: (order.order_items ?? []).map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
    })),
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shipping_cost),
    total: Number(order.total),
  };
}
