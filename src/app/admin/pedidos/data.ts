import {
  BUSINESS_ORDER_STATUSES,
  formatOrderReference,
  formatShippingAddressSummary,
  getOrderItemCount,
  getOrderStatusMeta,
  isBusinessOrderStatus,
  parseShippingAddress,
  type BusinessOrderStatus,
  type OrderRow,
} from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const PAGE_SIZE = 20;

type AdminOrderListRow = {
  id: string;
  created_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  mp_payment_id: OrderRow["mp_payment_id"];
  subtotal: number;
  shipping_cost: number;
  total: number;
  delivery_method: OrderRow["delivery_method"];
  shipping_address: Json | null;
  order_items: Array<{ quantity: number }> | null;
  profile: { full_name: string | null } | null;
};

export type AdminOrderListItem = {
  id: string;
  created_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  mp_payment_id: OrderRow["mp_payment_id"];
  subtotal: number;
  shippingCost: number;
  total: number;
  delivery_method: OrderRow["delivery_method"];
  itemCount: number;
  customerName: string;
  customerEmail: string;
  shippingSummary: string | null;
};

type NoticeTone = "success" | "error" | "neutral";

export const ADMIN_ORDER_STATUS_TABS = [
  { value: "all", label: "Todos" },
  ...BUSINESS_ORDER_STATUSES.map((status) => ({
    value: status,
    label: getOrderStatusMeta(status).label,
  })),
] as const;

export function parseAdminOrderStatusFilter(rawValue: string | undefined): BusinessOrderStatus | "all" {
  if (!rawValue) {
    return "all";
  }

  return isBusinessOrderStatus(rawValue) ? rawValue : "all";
}

export function parseAdminOrdersPage(rawValue: string | undefined) {
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export function getAdminOrdersNotice(notice: string | undefined): { tone: NoticeTone; text: string } | null {
  switch (notice) {
    case "status_updated":
      return { tone: "success", text: "Estado actualizado correctamente." };
    case "forbidden":
      return { tone: "error", text: "No tenés permisos para actualizar este pedido." };
    case "invalid_payload":
      return { tone: "error", text: "No pudimos interpretar la actualización solicitada." };
    case "order_not_found":
      return { tone: "error", text: "El pedido ya no existe o no está disponible." };
    case "unsupported_status":
      return { tone: "error", text: "El pedido tiene un estado no gestionable desde este panel." };
    case "no_change":
      return { tone: "neutral", text: "No hubo cambios porque ya tenía ese estado." };
    case "invalid_transition":
      return { tone: "error", text: "La transición de estado no está permitida." };
    case "update_failed":
      return { tone: "error", text: "No pudimos guardar el nuevo estado. Probá nuevamente." };
    default:
      return null;
  }
}

export function getAdminOrdersNoticeClasses(tone: NoticeTone) {
  if (tone === "success") {
    return "border-emerald-500/30 bg-emerald-500/12 text-emerald-100";
  }

  if (tone === "error") {
    return "border-red-500/30 bg-red-500/12 text-red-100";
  }

  return "border-slate-700 bg-slate-900/65 text-slate-200";
}

export function buildAdminOrdersListPath(params: {
  status: BusinessOrderStatus | "all";
  query: string;
  page?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.query) {
    searchParams.set("q", params.query);
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const queryString = searchParams.toString();
  return queryString ? `/admin/pedidos?${queryString}` : "/admin/pedidos";
}

export function mapAdminOrders(rows: AdminOrderListRow[]) {
  return rows.map<AdminOrderListItem>((order) => {
    const shippingSnapshot = parseShippingAddress(order.shipping_address);

    return {
      id: order.id,
      created_at: order.created_at,
      status: order.status,
      mp_status: order.mp_status,
      mp_payment_id: order.mp_payment_id,
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shipping_cost),
      total: Number(order.total),
      delivery_method: order.delivery_method,
      itemCount: getOrderItemCount(order.order_items),
      customerName: shippingSnapshot.fullName ?? order.profile?.full_name ?? "Sin nombre",
      customerEmail: shippingSnapshot.email ?? "Sin email",
      shippingSummary: formatShippingAddressSummary(shippingSnapshot),
    };
  });
}

export function filterAdminOrdersByQuery(orders: AdminOrderListItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return orders;
  }

  return orders.filter((order) => {
    const searchableText = [
      order.id,
      formatOrderReference(order.id),
      order.customerName,
      order.customerEmail,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

export function paginateAdminOrders(orders: AdminOrderListItem[], requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  return {
    totalPages,
    currentPage,
    pageOrders: orders.slice(pageStart, pageStart + PAGE_SIZE),
  };
}

function sanitizeAdminOrdersSearchValue(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
}

export function buildAdminOrdersSearchFilter(query: string) {
  const sanitizedQuery = sanitizeAdminOrdersSearchValue(query);

  if (!sanitizedQuery) {
    return null;
  }

  const wildcard = `*${sanitizedQuery}*`;
  const clauses = [
    `shipping_address->>full_name.ilike.${wildcard}`,
    `shipping_address->>email.ilike.${wildcard}`,
  ];

  return clauses.join(",");
}

async function fetchAdminOrdersPage(params: {
  createAdminClient: typeof createAdminClient;
  statusFilter: BusinessOrderStatus | "all";
  query: string;
  page: number;
}) {
  const admin = params.createAdminClient();
  const pageStart = (params.page - 1) * PAGE_SIZE;
  const searchFilter = buildAdminOrdersSearchFilter(params.query);

  let ordersQuery = admin
    .from("orders")
    .select(
      `
        id,
        created_at,
        status,
        mp_status,
        mp_payment_id,
        subtotal,
        shipping_cost,
        total,
        delivery_method,
        shipping_address,
        order_items(quantity),
        profile:profiles!orders_user_id_fkey(full_name)
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(pageStart, pageStart + PAGE_SIZE - 1);

  if (params.statusFilter !== "all") {
    ordersQuery = ordersQuery.eq("status", params.statusFilter);
  }

  if (searchFilter) {
    ordersQuery = ordersQuery.or(searchFilter);
  }

  return ordersQuery;
}

export async function loadAdminOrdersPageData(
  searchParams: { status?: string; q?: string; page?: string; notice?: string },
  deps: {
    createAdminClient?: typeof createAdminClient;
  } = {}
) {
  const statusFilter = parseAdminOrderStatusFilter(searchParams.status);
  const query = searchParams.q?.trim() ?? "";
  const requestedPage = parseAdminOrdersPage(searchParams.page);
  const createClient = deps.createAdminClient ?? createAdminClient;

  const initialPage = await fetchAdminOrdersPage({
    createAdminClient: createClient,
    statusFilter,
    query,
    page: requestedPage,
  });
  let { data, error } = initialPage;
  const { count } = initialPage;

  if (error) {
    throw new Error("No pudimos cargar los pedidos de administracion.");
  }

  const totalMatchingOrders = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatchingOrders / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  if (currentPage !== requestedPage && totalMatchingOrders > 0) {
    const fallbackPage = await fetchAdminOrdersPage({
      createAdminClient: createClient,
      statusFilter,
      query,
      page: currentPage,
    });

    data = fallbackPage.data;
    error = fallbackPage.error;

    if (error) {
      throw new Error("No pudimos cargar los pedidos de administracion.");
    }
  }

  const mappedOrders = mapAdminOrders((data ?? []) as unknown as AdminOrderListRow[]);

  return {
    statusFilter,
    query,
    requestedPage,
    notice: getAdminOrdersNotice(searchParams.notice),
    mappedOrders,
    totalMatchingOrders,
    currentPage,
    totalPages,
    pageOrders: mappedOrders,
    hasActiveFilters: statusFilter !== "all" || query.length > 0,
  };
}
