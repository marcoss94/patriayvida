"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/stores/cart-store";
import {
  getCartItemCount,
  getCartLineMaxQuantity,
  sanitizeCartQuantity,
} from "@/lib/cart";
import { formatPrice, formatStock } from "@/lib/utils/currency";

export function CartPageContent() {
  const { cart, clearItems, isHydrated, removeItem, subtotal, updateQuantity } = useCart();

  if (!isHydrated) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-10">
        <Card className="w-full border-slate-800 bg-slate-950/55 py-0 shadow-[0_20px_80px_rgba(10,15,30,0.45)]">
          <CardHeader className="gap-3 border-b border-slate-800 px-6 pt-6 pb-6 sm:px-7">
            <Badge className="bg-slate-800 text-slate-200">Cargando</Badge>
            <CardTitle className="text-3xl font-bold text-white">
              Estamos recuperando tu carrito.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base text-slate-400">
              En un instante vas a volver a ver los productos que elegiste.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-10">
        <Card className="w-full border-slate-800 bg-slate-950/55 py-0 shadow-[0_20px_80px_rgba(10,15,30,0.45)]">
          <CardHeader className="gap-3 border-b border-slate-800 px-6 pt-6 pb-6 sm:px-7">
            <Badge className="bg-slate-800 text-slate-200">Carrito vacío</Badge>
            <CardTitle className="text-3xl font-bold text-white">
              Todavía no sumaste ninguna prenda a la trinchera.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base text-slate-400">
              Volvé al catálogo, elegí tus prendas favoritas y armá tu pedido desde ahí.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-between gap-3 border-slate-800 bg-slate-950/70 px-6 py-5 sm:px-7">
            <span className="text-sm text-slate-500">Subtotal actual: {formatPrice(0)}</span>
            <Button
              render={<Link href="/productos" />}
              className="bg-red-600 font-semibold text-white hover:bg-red-700"
            >
              <ShoppingBag data-icon="inline-start" />
              Ir a productos
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Badge className="bg-slate-800 text-slate-200">Tu selección</Badge>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Revisá tu pedido
            </h1>
            <p className="text-sm text-slate-400 sm:text-base">
              Confirmá talles, cantidades y subtotal antes de finalizar la compra.
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={clearItems}
            className="border border-red-500/20"
          >
            <Trash2 data-icon="inline-start" />
            Vaciar carrito
          </Button>
        </div>

        <Card className="border-slate-800 bg-slate-950/45 py-0">
          <CardContent className="flex flex-col px-0">
            {cart.items.map((item, index) => (
              <div key={item.variantId} className="flex flex-col gap-0">
                {index > 0 ? <Separator className="bg-slate-800" /> : null}
                <div className="grid gap-5 px-4 py-5 sm:grid-cols-[104px_minmax(0,1fr)] lg:grid-cols-[104px_minmax(0,1fr)_220px]">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl ?? "/placeholder-product.jpg"}
                      alt={item.productName}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-2">
                        <Link
                          href={`/productos/${item.slug}`}
                          className="text-xl font-semibold text-white transition-colors hover:text-red-400"
                        >
                          {item.productName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                          <Badge className="bg-slate-800 text-slate-200">
                            {item.size ?? item.variantName}
                          </Badge>
                          <span>{item.variantName}</span>
                          <span className="text-slate-600">•</span>
                          <span>{formatStock(item.stock)}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Total linea
                        </p>
                        <p className="text-xl font-semibold text-white">
                          {formatPrice(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          Precio unitario
                        </span>
                        <span className="text-base font-medium text-slate-100">
                          {formatPrice(item.unitPrice)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <QuantityControl
                          quantity={item.quantity}
                          maxQuantity={getCartLineMaxQuantity(item.stock)}
                          onChange={(quantity) =>
                            updateQuantity(item.variantId, quantity)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeItem(item.variantId)}
                          className="text-slate-400 hover:text-red-300"
                        >
                          <Trash2 data-icon="inline-start" />
                          Quitar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <aside className="w-full lg:sticky lg:top-24 lg:max-w-sm">
        <Card className="border-slate-800 bg-slate-950/70 py-0 shadow-[0_18px_70px_rgba(10,15,30,0.4)]">
          <CardHeader className="gap-3 border-b border-slate-800 px-6 pt-6 pb-5 sm:px-7">
            <Badge className="bg-red-600/90 text-white">Resumen</Badge>
            <CardTitle className="text-2xl font-bold text-white">
              Total del carrito
            </CardTitle>
            <CardDescription className="text-sm text-slate-400">
              El costo de envío se suma en el siguiente paso según la opción que elijas.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 px-6 py-5 sm:px-7">
            <SummaryRow label="Productos" value={String(getCartItemCount(cart))} />
            <SummaryRow label="Variantes" value={String(cart.items.length)} />
            <Separator className="bg-slate-800" />
            <SummaryRow label="Subtotal" value={formatPrice(subtotal)} prominent />
          </CardContent>

          <CardFooter className="flex-col gap-3 border-slate-800 bg-slate-950/80 px-6 py-5 sm:px-7">
            <Button
              render={<Link href="/checkout" />}
              className="h-11 w-full bg-red-600 text-base font-semibold text-white hover:bg-red-700"
            >
              Finalizar compra
            </Button>
            <Button
              render={<Link href="/productos" />}
              variant="outline"
              className="w-full border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
            >
              Seguir comprando
            </Button>
          </CardFooter>
        </Card>
      </aside>
    </div>
  );
}

function QuantityControl({
  quantity,
  maxQuantity,
  onChange,
}: {
  quantity: number;
  maxQuantity: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={quantity <= 1}
        onClick={() => onChange(quantity - 1)}
        className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
      >
        <Minus />
        <span className="sr-only">Restar unidad</span>
      </Button>

      <Input
        type="number"
        min={1}
        max={maxQuantity}
        value={quantity}
        onChange={(event) =>
          onChange(sanitizeCartQuantity(Number(event.target.value), maxQuantity))
        }
        className="w-20 border-slate-700 bg-slate-900/60 text-center text-slate-100"
      />

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={quantity >= maxQuantity}
        onClick={() => onChange(quantity + 1)}
        className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
      >
        <Plus />
        <span className="sr-only">Sumar unidad</span>
      </Button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  prominent = false,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={prominent ? "text-base text-slate-300" : "text-sm text-slate-400"}>
        {label}
      </span>
      <span className={prominent ? "text-2xl font-bold text-white" : "text-sm font-medium text-slate-100"}>
        {value}
      </span>
    </div>
  );
}
