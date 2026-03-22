import Link from "next/link";
import { Package2, ReceiptText } from "lucide-react";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { PaymentStatusBadge } from "@/components/account/payment-status-badge";
import { OrderStatusTabs } from "@/components/orders/order-status-tabs";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatOrderDate, formatOrderReference, getDeliveryMethodLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/currency";
import { ORDER_STATUS_TABS, buildUserOrdersListPath, loadUserOrdersPageData } from "./data";

type UserOrdersPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function PedidosPage({ searchParams }: UserOrdersPageProps) {
  const pageData = await loadUserOrdersPageData(await searchParams);

  if (!pageData) {
    return null;
  }

  const { statusFilter, orders, filteredOrders, latestVisibleOrder, visibleItemCount } = pageData;

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
              <p className="mt-3 text-2xl font-bold text-white">{visibleItemCount}</p>
            </div>
          </div>
        </div>
      </section>

      <OrderStatusTabs
        tabs={ORDER_STATUS_TABS}
        activeValue={statusFilter}
        getHref={buildUserOrdersListPath}
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
            <Link href="/productos" className={cn(buttonVariants({ variant: "brand" }))}>
              Explorar productos
            </Link>
          </div>
        </section>
      ) : filteredOrders.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-300">
            <Package2 className="size-5" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">No hay pedidos en este estado</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Probá con otra pestaña para revisar tu historial completo o ver compras recientes.
          </p>
          <div className="mt-5">
            <Link href="/cuenta/pedidos" className={cn(buttonVariants({ variant: "outline" }))}>
              Ver todos los pedidos
            </Link>
          </div>
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
                            className: "font-semibold",
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
