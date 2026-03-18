import Link from "next/link";
import { ArrowRight, Package2, ReceiptText } from "lucide-react";
import { PaymentStatusBadge } from "@/components/account/payment-status-badge";
import { OrderStatusBadge } from "@/components/account/order-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatOrderDate,
  formatOrderReference,
  getOrderItemCount,
  type OrderRow,
} from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils/currency";

type OrderListRow = {
  id: string;
  created_at: string;
  status: OrderRow["status"];
  mp_status: OrderRow["mp_status"];
  total: number;
  order_items: Array<{ quantity: number }> | null;
};

export default async function PedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, mp_status, total, order_items(quantity)")
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

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/70 shadow-[0_24px_90px_rgba(10,15,30,0.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,24,44,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(234,179,8,0.09),transparent_24%)]" />
      <div className="relative z-10 flex flex-col gap-6 p-6">
        <Card className="border-slate-800 bg-slate-950/55 py-0">
          <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-4 text-red-200">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                <ReceiptText className="size-5" />
              </div>
              <div className="flex flex-col gap-2">
                <CardTitle className="text-2xl font-bold text-white sm:text-3xl">
                  Mis pedidos
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 sm:text-base">
                  Seguí el estado de tus compras y consultá cada detalle cuando lo necesites.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 px-6 py-6 sm:px-8 sm:grid-cols-3">
            <div className="flex min-h-28 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Total de pedidos</p>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
            </div>
            <div className="flex min-h-28 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Última actividad</p>
              <p className="text-sm font-medium leading-6 text-slate-100">
                {orders[0] ? formatOrderDate(orders[0].created_at) : "Todavía sin compras"}
              </p>
            </div>
            <div className="flex min-h-28 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Items acumulados</p>
              <p className="text-2xl font-bold text-white">
                {orders.reduce((total, order) => total + order.itemCount, 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        {orders.length === 0 ? (
          <Card className="border-slate-800 bg-slate-950/60 py-0">
            <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-8">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/70 text-slate-300">
                <Package2 className="size-5" />
              </div>
              <CardTitle className="text-xl font-bold text-white">Todavía no hiciste pedidos</CardTitle>
              <CardDescription className="max-w-2xl text-sm text-slate-400">
                Cuando completes una compra, acá vas a encontrar el estado, el total y el detalle de cada pedido.
              </CardDescription>
            </CardHeader>
            <CardFooter className="border-slate-800 bg-slate-950/80 px-6 py-6 sm:px-8">
              <Button render={<Link href="/productos" />} className="bg-red-600 text-white hover:bg-red-700">
                Explorar productos
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <Card key={order.id} className="border-slate-800 bg-slate-950/60 py-0">
                <CardHeader className="gap-4 border-b border-slate-800 px-6 py-6 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-bold text-white">
                      {formatOrderReference(order.id)}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-400">
                      Creado el {formatOrderDate(order.created_at)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.status} mpStatus={order.mp_status} />
                  </div>
                </CardHeader>

                <CardContent className="grid gap-4 px-6 py-6 sm:px-6 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex min-h-24 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Referencia</p>
                    <p className="text-sm font-medium leading-6 text-slate-100">{order.id}</p>
                  </div>
                  <div className="flex min-h-24 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Items</p>
                    <p className="text-sm font-medium text-slate-100">{order.itemCount}</p>
                  </div>
                  <div className="flex min-h-24 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Total</p>
                    <p className="text-lg font-bold text-white">{formatPrice(order.total)}</p>
                  </div>
                  <div className="flex min-h-24 flex-col justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Detalle</p>
                    <p className="text-sm font-medium leading-6 text-slate-100">Seguimiento y resumen de envío</p>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4 border-slate-800 bg-slate-950/80 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="max-w-2xl text-sm leading-6 text-slate-400">
                    Disponible para consultar desde tu cuenta cuando quieras.
                  </p>
                  <Button
                    render={<Link href={`/cuenta/pedidos/${order.id}`} />}
                    className="bg-red-600 text-white hover:bg-red-700"
                  >
                    Ver detalle
                    <ArrowRight className="size-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
