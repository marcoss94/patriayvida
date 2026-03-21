import Link from "next/link";
import { ClipboardList, Search } from "lucide-react";
import { OrderStatusTabs } from "@/components/orders/order-status-tabs";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { PaymentStatusBadge } from "@/components/account/payment-status-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  BUSINESS_ORDER_STATUSES,
  formatShippingAddressSummary,
  formatOrderDate,
  formatOrderReference,
  getDeliveryMethodLabel,
  getOrderItemCount,
  getOrderStatusMeta,
  isBusinessOrderStatus,
  parseShippingAddress,
  type BusinessOrderStatus,
  type OrderRow,
} from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/currency";
import type { Json } from "@/types/database";

const FETCH_LIMIT = 250;
const PAGE_SIZE = 20;

type AdminOrdersPageProps = {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    notice?: string;
  }>;
};

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

type AdminOrderListItem = {
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

const ORDER_STATUS_TABS = [
  { value: "all", label: "Todos" },
  ...BUSINESS_ORDER_STATUSES.map((status) => ({
    value: status,
    label: getOrderStatusMeta(status).label,
  })),
] as const;

function parseStatusFilter(rawValue: string | undefined): BusinessOrderStatus | "all" {
  if (!rawValue) {
    return "all";
  }

  return isBusinessOrderStatus(rawValue) ? rawValue : "all";
}

function parsePage(rawValue: string | undefined) {
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function getNotice(notice: string | undefined): { tone: NoticeTone; text: string } | null {
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

function getNoticeClasses(tone: NoticeTone) {
  if (tone === "success") {
    return "border-emerald-500/30 bg-emerald-500/12 text-emerald-100";
  }

  if (tone === "error") {
    return "border-red-500/30 bg-red-500/12 text-red-100";
  }

  return "border-slate-700 bg-slate-900/65 text-slate-200";
}

function buildListPath(params: {
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

export default async function AdminPedidosPage({ searchParams }: AdminOrdersPageProps) {
  const resolvedSearchParams = await searchParams;
  const statusFilter = parseStatusFilter(resolvedSearchParams.status);
  const query = resolvedSearchParams.q?.trim() ?? "";
  const requestedPage = parsePage(resolvedSearchParams.page);
  const notice = getNotice(resolvedSearchParams.notice);
  const admin = createAdminClient();

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
      `
    )
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (statusFilter !== "all") {
    ordersQuery = ordersQuery.eq("status", statusFilter);
  }

  const { data, error } = await ordersQuery;

  if (error) {
    throw new Error("No pudimos cargar los pedidos de administración.");
  }

  const mappedOrders = ((data ?? []) as unknown as AdminOrderListRow[]).map<AdminOrderListItem>((order) => {
    const shippingSnapshot = parseShippingAddress(order.shipping_address);
    const customerName = shippingSnapshot.fullName ?? order.profile?.full_name ?? "Sin nombre";
    const customerEmail = shippingSnapshot.email ?? "Sin email";
    const shippingSummary = formatShippingAddressSummary(shippingSnapshot);

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
      customerName,
      customerEmail,
      shippingSummary,
    };
  });

  const normalizedQuery = query.toLowerCase();
  const filteredOrders =
    normalizedQuery.length === 0
      ? mappedOrders
      : mappedOrders.filter((order) => {
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

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageOrders = filteredOrders.slice(pageStart, pageStart + PAGE_SIZE);
  const hasActiveFilters = statusFilter !== "all" || query.length > 0;
  const hasMoreResults = mappedOrders.length === FETCH_LIMIT;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_24px_90px_rgba(10,15,30,0.45)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_24%)]" />
        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-4 text-red-200">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
              <ClipboardList className="size-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Gestión de pedidos</h2>
              <p className="text-sm text-slate-400 sm:text-base">
                Seguimiento operativo y actualización de estados del flujo post-venta.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Pedidos visibles</p>
              <p className="mt-3 text-2xl font-bold text-white">{filteredOrders.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Último pedido</p>
              <p className="mt-3 text-sm font-medium text-slate-100">
                {mappedOrders[0] ? formatOrderDate(mappedOrders[0].created_at) : "Sin pedidos registrados"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Suma de la página</p>
              <p className="mt-3 text-lg font-bold text-white">
                {formatPrice(pageOrders.reduce((sum, order) => sum + order.total, 0))}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-white">Estado y búsqueda</h3>
          <p className="text-sm text-slate-400">Elegí un estado y buscá por referencia, nombre o email.</p>
        </div>

        <OrderStatusTabs
          tabs={ORDER_STATUS_TABS}
          activeValue={statusFilter}
          getHref={(status) => buildListPath({ status, query })}
          ariaLabel="Filtrar pedidos de administracion por estado"
        />

        {notice ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${getNoticeClasses(notice.tone)}`}>
            {notice.text}
          </div>
        ) : null}

        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            Buscar
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
              <input
                name="q"
                defaultValue={query}
                placeholder="PYV-xxxx, nombre o email"
                className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/70 pr-3 pl-9 text-sm text-slate-100 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-red-500"
              />
            </div>
          </label>

          {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}

          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" variant="brand">
              Aplicar
            </Button>
            {hasActiveFilters ? (
              <Link href="/admin/pedidos" className={cn(buttonVariants({ variant: "outline" }))}>
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>

        {hasMoreResults ? (
          <p className="text-xs text-slate-500">
            Mostrando los últimos {FETCH_LIMIT} pedidos para mantener la vista ágil.
          </p>
        ) : null}
      </section>

      {pageOrders.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h3 className="text-xl font-bold text-white">No encontramos pedidos</h3>
          <p className="mt-2 text-sm text-slate-400">Probá cambiar los filtros para ver más resultados.</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-4 py-3 text-left font-semibold">Pedido</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Pago</th>
                  <th className="hidden px-4 py-3 text-left font-semibold xl:table-cell">Entrega</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="hidden px-4 py-3 text-right font-semibold xl:table-cell">Items</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-800/70 last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">{formatOrderReference(order.id)}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{order.id}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="text-slate-100">{order.customerName}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{order.customerEmail}</p>
                    </td>
                    <td className="hidden px-4 py-4 align-top text-slate-300 lg:table-cell">
                      {formatOrderDate(order.created_at)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="hidden px-4 py-4 align-top md:table-cell">
                      <div className="space-y-2">
                        <PaymentStatusBadge status={order.status} mpStatus={order.mp_status} />
                        <div className="space-y-1 text-xs text-slate-500">
                          <p>MP status: {order.mp_status ?? "sin dato"}</p>
                          <p>MP id: {order.mp_payment_id ?? "sin dato"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 align-top text-slate-200 xl:table-cell">
                      <div className="space-y-1">
                        <p>{getDeliveryMethodLabel(order.delivery_method)}</p>
                        <p className="text-xs text-slate-500">
                          {order.shippingSummary ??
                            (order.delivery_method === "pickup" ? "Retiro en punto acordado" : "Sin direccion")}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right align-top font-semibold text-white">
                      <div className="space-y-1">
                        <p>{formatPrice(order.total)}</p>
                        <div className="hidden space-y-1 text-xs font-normal text-slate-500 lg:block">
                          <p>Subt. {formatPrice(order.subtotal)}</p>
                          <p>Envio {order.shippingCost === 0 ? "Gratis" : formatPrice(order.shippingCost)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-4 text-right align-top text-slate-300 xl:table-cell">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <Link
                        href={`/admin/pedidos/${order.id}`}
                        className={cn(
                           buttonVariants({
                             variant: "brand",
                             size: "sm",
                             className: "text-white",
                             })
                           )}
                        >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {filteredOrders.length > PAGE_SIZE ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
          <p className="text-sm text-slate-400">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            {currentPage <= 1 ? (
              <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")}>Anterior</span>
            ) : (
              <Link
                href={buildListPath({
                  status: statusFilter,
                  query,
                  page: currentPage - 1,
                })}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Anterior
              </Link>
            )}
            {currentPage >= totalPages ? (
              <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none opacity-50")}>Siguiente</span>
            ) : (
              <Link
                href={buildListPath({
                  status: statusFilter,
                  query,
                  page: currentPage + 1,
                })}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Siguiente
              </Link>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
