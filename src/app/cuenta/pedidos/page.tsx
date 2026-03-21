import Link from "next/link";
import { Package2, ReceiptText } from "lucide-react";
import { OrderStatusTabs } from "@/components/orders/order-status-tabs";
import { PaymentStatusBadge } from "@/components/account/payment-status-badge";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  BUSINESS_ORDER_STATUSES,
  getDeliveryMethodLabel,
  formatOrderDate,
  formatOrderReference,
  getOrderStatusMeta,
  getOrderItemCount,
  isBusinessOrderStatus,
  type BusinessOrderStatus,
  type OrderRow,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/currency";

const ORDER_STATUS_TABS = [
  { value: "all", label: "Todos" },
  ...BUSINESS_ORDER_STATUSES.map((status) => ({
    value: status,
    label: getOrderStatusMeta(status).label,
  })),
] as const;

type UserOrdersPageProps = {
  searchParams: Promise<{ status?: string }>;
};

function parseStatusFilter(rawValue: string | undefined): BusinessOrderStatus | "all" {
  if (!rawValue) {
    return "all";
  }

  return isBusinessOrderStatus(rawValue) ? rawValue : "all";
}

function buildOrdersListPath(status: BusinessOrderStatus | "all") {
  if (status === "all") {
    return "/cuenta/pedidos";
  }

  return `/cuenta/pedidos?status=${status}`;
}

type OrderListRow = {
  id: string;
  created_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  total: number;
  delivery_method: OrderRow["delivery_method"];
  order_items: Array<{ quantity: number }> | null;
};

export default async function PedidosPage({ searchParams }: UserOrdersPageProps) {
  const resolvedSearchParams = await searchParams;
  const statusFilter = parseStatusFilter(resolvedSearchParams.status);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, mp_status, total, delivery_method, order_items(quantity)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("No pudimos cargar tus pedidos.");
  }

  const orders = ((data ?? []) as unknown as OrderListRow[]).map((order) => ({
    ...order,
    total: Number(order.total),
    itemCount: getOrderItemCount(order.order_items),
  }));

  const filteredOrders =
    statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter);
  const latestVisibleOrder = filteredOrders[0] ?? orders[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_24px_90px_rgba(10,15,30,0.45)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_24%)]" />
        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-4 text-red-200">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
              <ReceiptText className="size-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Mis pedidos</h2>
              <p className="text-sm text-slate-400 sm:text-base">
                Seguí el estado de tus compras y consultá cada detalle cuando lo necesites.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Pedidos visibles</p>
              <p className="mt-3 text-2xl font-bold text-white">{filteredOrders.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Última actividad</p>
              <p className="mt-3 text-sm font-medium text-slate-100">
                {latestVisibleOrder ? formatOrderDate(latestVisibleOrder.created_at) : "Todavía sin compras"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Ítems acumulados</p>
              <p className="mt-3 text-2xl font-bold text-white">
                {filteredOrders.reduce((total, order) => total + order.itemCount, 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <OrderStatusTabs
        tabs={ORDER_STATUS_TABS}
        activeValue={statusFilter}
        getHref={buildOrdersListPath}
        ariaLabel="Filtrar mis pedidos por estado"
      />

      {orders.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-300">
            <Package2 className="size-5" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">Todavía no hiciste pedidos</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Cuando completes una compra, acá vas a encontrar el estado, el total y el detalle de cada pedido.
          </p>
          <div className="mt-5">
            <Link
              href="/productos"
              className={cn(buttonVariants({ variant: "brand" }))}
            >
              Explorar productos
            </Link>
          </div>
        </section>
      ) : filteredOrders.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h3 className="text-xl font-bold text-white">No hay pedidos en este estado</h3>
          <p className="mt-2 text-sm text-slate-400">
            Probá con otra pestaña para revisar tu historial completo.
          </p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="px-4 py-3 text-left font-semibold">Pedido</th>
                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Pago</th>
                  <th className="hidden px-4 py-3 text-left font-semibold xl:table-cell">Entrega</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="hidden px-4 py-3 text-right font-semibold lg:table-cell">Ítems</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-800/70 last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      <p className="font-semibold text-white">{formatOrderReference(order.id)}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{order.id}</p>
                    </td>
                    <td className="hidden px-4 py-4 align-top text-slate-300 md:table-cell">
                      {formatOrderDate(order.created_at)}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="hidden px-4 py-4 align-top md:table-cell">
                      <PaymentStatusBadge status={order.status} mpStatus={order.mp_status} />
                    </td>
                    <td className="hidden px-4 py-4 align-top text-slate-200 xl:table-cell">
                      {getDeliveryMethodLabel(order.delivery_method)}
                    </td>
                    <td className="px-4 py-4 text-right align-top font-semibold text-white">
                      {formatPrice(order.total)}
                    </td>
                    <td className="hidden px-4 py-4 text-right align-top text-slate-300 lg:table-cell">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <Link
                        href={`/cuenta/pedidos/${order.id}`}
                        className={cn(
                          buttonVariants({
                            variant: "brand",
                            size: "sm",
                            className:
                              "font-semibold",
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
    </div>
  );
}
