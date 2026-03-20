import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CircleCheck,
  CreditCard,
  MapPin,
  PackageSearch,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { PaymentStatusBadge } from "@/components/account/payment-status-badge";
import { updateAdminOrderStatusAction } from "@/app/admin/pedidos/actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getAllowedStatusTransitions,
  formatOrderDate,
  formatOrderReference,
  getDeliveryMethodLabel,
  getOrderStatusMeta,
  getPaymentStatusMeta,
  parseShippingAddress,
  type OrderRow,
} from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/currency";
import type { Json } from "@/types/database";

type AdminPedidoDetallePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

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

type NoticeTone = "success" | "error" | "neutral";

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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export default async function AdminPedidoDetallePage({
  params,
  searchParams,
}: AdminPedidoDetallePageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const notice = getNotice(resolvedSearchParams.notice);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("orders")
    .select(
      `
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
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const order = data as unknown as AdminOrderDetailRow;
  const shippingSnapshot = parseShippingAddress(order.shipping_address);
  const lineItems = (order.order_items ?? []).map((item) => ({
    ...item,
    unit_price: Number(item.unit_price),
  }));
  const subtotal = Number(order.subtotal);
  const shippingCost = Number(order.shipping_cost);
  const total = Number(order.total);
  const allowedTransitions = getAllowedStatusTransitions(order.status);
  const canUpdateStatus = allowedTransitions.length > 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-[0_24px_90px_rgba(10,15,30,0.45)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_24%)]" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <Link
                href="/admin/pedidos"
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
                  Pedido creado el {formatOrderDate(order.created_at)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.status} mpStatus={order.mp_status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailItem label="Pedido" value={order.id} />
            <DetailItem label="Cliente ID" value={order.user_id} />
            <DetailItem label="Entrega" value={getDeliveryMethodLabel(order.delivery_method)} />
            <DetailItem
              label="Pago"
              value={getPaymentStatusMeta({ status: order.status, mp_status: order.mp_status }).label}
            />
          </div>
        </div>
      </section>

      {notice ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${getNoticeClasses(notice.tone)}`}>
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,1fr)]">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-3 text-slate-100">
              <PackageSearch className="size-5 text-red-300" />
              <h3 className="text-xl font-bold text-white">Items del pedido</h3>
            </div>
            <p className="text-sm text-slate-400">
              Cantidades y precios unitarios congelados al momento de la compra.
            </p>
          </div>

          <div className="space-y-3">
            {lineItems.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-900/55 px-4 py-4 text-sm text-slate-400">
                Este pedido no tiene líneas registradas.
              </p>
            ) : (
              lineItems.map((item) => (
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
                      <p className="text-lg font-bold text-white">
                        {formatPrice(item.quantity * item.unit_price)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 text-slate-100">
                <RefreshCcw className="size-5 text-red-300" />
                <h3 className="text-xl font-bold text-white">Actualizar estado</h3>
              </div>
              <p className="text-sm text-slate-400">Aplicá transición operativa según el flujo permitido.</p>
            </div>

            <div className="space-y-4">
              <DetailItem label="Estado actual" value={getOrderStatusMeta(order.status).label} />

              {canUpdateStatus ? (
                <form action={updateAdminOrderStatusAction} className="space-y-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="returnPath" value={`/admin/pedidos/${order.id}`} />

                  <label className="flex flex-col gap-2 text-sm text-slate-300">
                    Nuevo estado
                    <select
                      name="nextStatus"
                      defaultValue={allowedTransitions[0]}
                      className="h-10 rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none transition-colors duration-200 focus:border-red-500"
                    >
                      {allowedTransitions.map((status) => (
                        <option key={status} value={status}>
                          {getOrderStatusMeta(status).label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Button type="submit" className="w-full bg-red-600 text-white hover:bg-red-700">
                    <CircleCheck className="size-4" />
                    Confirmar cambio
                  </Button>
                </form>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-900/55 px-4 py-4 text-sm text-slate-300">
                  Estado terminal. Este pedido no admite nuevas transiciones.
                </p>
              )}

              <p className="text-xs text-slate-500">
                Flujo habilitado: pending → paid/preparing/cancelled, paid → preparing/cancelled,
                preparing → shipped/cancelled, shipped → delivered.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 text-slate-100">
                <UserRound className="size-5 text-red-300" />
                <h3 className="text-xl font-bold text-white">Cliente y entrega</h3>
              </div>
              <p className="text-sm text-slate-400">Snapshot capturado en checkout.</p>
            </div>

            <div className="space-y-3">
              <DetailItem label="Nombre" value={shippingSnapshot.fullName ?? order.profile?.full_name ?? "Sin dato"} />
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
                <MapPin className="size-5 text-red-300" />
                <h3 className="text-xl font-bold text-white">Metadata del pedido</h3>
              </div>
              <p className="text-sm text-slate-400">Identificadores operativos para seguimiento interno.</p>
            </div>

            <div className="space-y-3">
              <DetailItem label="ID pedido" value={order.id} />
              <DetailItem label="ID cliente" value={order.user_id} />
              <DetailItem label="Creado" value={formatOrderDate(order.created_at)} />
              <DetailItem label="Actualizado" value={formatOrderDate(order.updated_at)} />
              <DetailItem label="mp_status" value={order.mp_status ?? "Sin dato"} />
              <DetailItem label="mp_payment_id" value={order.mp_payment_id ?? "Sin dato"} />
              <DetailItem label="mp_preference_id" value={order.mp_preference_id ?? "Sin dato"} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-3 text-slate-100">
                <CreditCard className="size-5 text-red-300" />
                <h3 className="text-xl font-bold text-white">Totales</h3>
              </div>
              <p className="text-sm text-slate-400">Resumen económico del pedido.</p>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3">
                <span>Subtotal</span>
                <span className="font-medium text-slate-100">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-3">
                <span>Envío</span>
                <span className="font-medium text-slate-100">
                  {shippingCost === 0 ? "Gratis" : formatPrice(shippingCost)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900/75 px-3 py-3 text-base">
                <span className="font-semibold text-white">Total</span>
                <span className="text-xl font-bold text-white">{formatPrice(total)}</span>
              </div>
            </div>

            <div className="mt-4">
              <Link href="/admin/pedidos" className={cn(buttonVariants({ variant: "outline", className: "w-full" }))}>
                Volver al listado
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
