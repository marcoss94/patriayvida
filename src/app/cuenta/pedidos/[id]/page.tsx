import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard, MapPin, PackageSearch } from "lucide-react";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { PaymentStatusBadge } from "@/components/account/payment-status-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  formatOrderDate,
  formatOrderReference,
  getDeliveryMethodLabel,
  getOrderStatusMeta,
  getPaymentStatusMeta,
} from "@/lib/orders";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/currency";
import { loadUserOrderDetail } from "./data";

type PedidoDetallePageProps = {
  params: Promise<{ id: string }>;
};

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export default async function PedidoDetallePage({ params }: PedidoDetallePageProps) {
  const { id } = await params;
  const detail = await loadUserOrderDetail(id, { onNotFound: notFound });

  if (!detail) {
    return null;
  }

  const { order, shippingSnapshot, lineItems, subtotal, shippingCost, total } = detail;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_24px_90px_rgba(10,15,30,0.45)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_24%)]" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <Link
                href="/cuenta/pedidos"
                className={cn(
                  buttonVariants({
                    variant: "outline",
                    className: "border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900",
                  })
                )}
              >
                <ArrowLeft className="size-4" />
                Volver a pedidos
              </Link>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white sm:text-3xl">{formatOrderReference(order.id)}</h2>
                <p className="text-sm text-slate-400 sm:text-base">
                  Pedido realizado el {formatOrderDate(order.created_at)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.status} mpStatus={order.mp_status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailItem label="Pedido" value={formatOrderReference(order.id)} />
            <DetailItem label="Fecha" value={formatOrderDate(order.created_at)} />
            <DetailItem label="Entrega" value={getDeliveryMethodLabel(order.delivery_method)} />
            <DetailItem
              label="Estado del pago"
              value={getPaymentStatusMeta({ status: order.status, mp_status: order.mp_status }).label}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-3 text-slate-100">
              <PackageSearch className="size-5 text-red-300" />
              <h3 className="text-xl font-bold text-white">Ítems del pedido</h3>
            </div>
            <p className="text-sm text-slate-400">Cantidades, variante y precio congelado al momento de la compra.</p>
          </div>

          <div className="space-y-3">
            {lineItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/55 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-white">{item.variant.product.name}</p>
                    <p className="text-sm text-slate-400">
                      Variante: {item.variant.name}
                      {item.variant.attributes?.size ? ` · Talle ${item.variant.attributes.size}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">SKU {item.variant.sku}</p>
                  </div>
                  <div className="space-y-1 text-left sm:text-right">
                    <p className="text-sm text-slate-400">
                      {item.quantity} x {formatPrice(item.unit_price)}
                    </p>
                    <p className="text-lg font-bold text-white">{formatPrice(item.quantity * item.unit_price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 text-slate-100">
                <MapPin className="size-5 text-red-300" />
                <h3 className="text-xl font-bold text-white">Resumen de entrega</h3>
              </div>
              <p className="text-sm text-slate-400">Datos cargados para la entrega o el retiro de este pedido.</p>
            </div>

            <div className="space-y-3">
              <DetailItem label="Nombre" value={shippingSnapshot.fullName ?? "Sin dato"} />
              <DetailItem label="Email" value={shippingSnapshot.email ?? "Sin dato"} />
              <DetailItem label="Teléfono" value={shippingSnapshot.phone ?? "Sin dato"} />
              <DetailItem
                label="Dirección"
                value={
                  shippingSnapshot.address ??
                  (order.delivery_method === "pickup" ? "Retiro en punto acordado" : "Sin dato")
                }
              />
              <DetailItem label="Ciudad" value={shippingSnapshot.city ?? "Sin dato"} />
              {shippingSnapshot.notes ? <DetailItem label="Notas" value={shippingSnapshot.notes} /> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 text-slate-100">
                <CreditCard className="size-5 text-red-300" />
                <h3 className="text-xl font-bold text-white">Totales</h3>
              </div>
              <p className="text-sm text-slate-400">Resumen final de tu compra y su estado actual.</p>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <DetailItem label="Estado del pedido" value={getOrderStatusMeta(order.status).label} />
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3">
                <span>Subtotal</span>
                <span className="font-medium text-slate-100">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3">
                <span>Envío</span>
                <span className="font-medium text-slate-100">{shippingCost === 0 ? "Gratis" : formatPrice(shippingCost)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/75 px-3 py-3 text-base">
                <span className="font-semibold text-white">Total</span>
                <span className="text-xl font-bold text-white">{formatPrice(total)}</span>
              </div>
            </div>

            <div className="mt-4">
              <Link
                href="/productos"
                className={cn(
                  buttonVariants({
                    variant: "brand",
                    className: "h-11 w-full text-base font-semibold",
                  })
                )}
              >
                Seguir comprando
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
