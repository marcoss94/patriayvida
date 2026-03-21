import {
  formatOrderDate,
  getOrderItemCount,
  getOrderStatusMeta,
  isBusinessOrderStatus,
  type BusinessOrderStatus,
  type OrderRow,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const ORDER_STATUS_TABS = [
  { value: "all", label: "Todos" },
  ...(["pending", "paid", "preparing", "shipped", "delivered", "cancelled"] as const).map((status) => ({
    value: status,
    label: getOrderStatusMeta(status).label,
  })),
] as const;

type OrderListRow = {
  id: string;
  created_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  total: number;
  delivery_method: OrderRow["delivery_method"];
  order_items: Array<{ quantity: number }> | null;
};

export type UserOrdersListItem = OrderListRow & {
  itemCount: number;
};

export function parseUserOrderStatusFilter(rawValue: string | undefined): BusinessOrderStatus | "all" {
  if (!rawValue) {
    return "all";
  }

  return isBusinessOrderStatus(rawValue) ? rawValue : "all";
}

export function buildUserOrdersListPath(status: BusinessOrderStatus | "all") {
  if (status === "all") {
    return "/cuenta/pedidos";
  }

  return `/cuenta/pedidos?status=${status}`;
}

export function buildUserOrdersViewModel(
  orders: OrderListRow[],
  statusFilter: BusinessOrderStatus | "all"
) {
  const normalizedOrders: UserOrdersListItem[] = orders.map((order) => ({
    ...order,
    total: Number(order.total),
    itemCount: getOrderItemCount(order.order_items),
  }));
  const filteredOrders =
    statusFilter === "all"
      ? normalizedOrders
      : normalizedOrders.filter((order) => order.status === statusFilter);

  return {
    orders: normalizedOrders,
    filteredOrders,
    latestVisibleOrder: filteredOrders[0] ?? normalizedOrders[0] ?? null,
    visibleItemCount: filteredOrders.reduce((total, order) => total + order.itemCount, 0),
  };
}

export async function loadUserOrdersPageData(
  searchParams: { status?: string },
  deps: {
    createClient?: typeof createClient;
  } = {}
) {
  const supabase = await (deps.createClient ?? createClient)();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const statusFilter = parseUserOrderStatusFilter(searchParams.status);
  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, mp_status, total, delivery_method, order_items(quantity)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No pudimos cargar tus pedidos.");
  }

  return {
    statusFilter,
    ...buildUserOrdersViewModel((data ?? []) as unknown as OrderListRow[], statusFilter),
    lastActivityLabel: (data as OrderListRow[] | null)?.[0]
      ? formatOrderDate(((data as OrderListRow[])[0] as OrderListRow).created_at)
      : "Todavia sin compras",
  };
}
