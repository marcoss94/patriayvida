"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { getCartLineMaxQuantity } from "@/lib/cart";
import { formatPrice } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart-store";
import { useCartPreviewStore } from "@/stores/cart-preview-store";

export function CartPreviewSheet() {
  const { cart, subtotal, isHydrated, removeItem, updateQuantity } = useCart();
  const { isOpen, highlightedVariantId, setOpen, close } = useCartPreviewStore();

  const items = isHydrated ? cart.items : [];

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full border-slate-800 bg-slate-950/98 text-slate-100 sm:max-w-md"
      >
        <SheetHeader className="border-b border-slate-800 pb-4">
          <SheetTitle className="text-lg text-white">Ya está en el carrito</SheetTitle>
          <SheetDescription className="text-slate-400">
            Revisá lo que sumaste y seguí comprando cuando quieras.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {items.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">Tu carrito está vacío.</p>
          ) : (
            <div className="space-y-3 py-4">
              {items.map((item) => {
                const isHighlighted = item.variantId === highlightedVariantId;

                return (
                  <article
                    key={item.variantId}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900">
                        <Image
                          src={item.imageUrl || "/placeholder-product.jpg"}
                          alt={item.productName}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-100">
                            {item.productName}
                          </p>
                          {isHighlighted ? (
                            <Badge className="bg-emerald-600/90 text-[0.65rem] text-white">
                              Nuevo
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.size ? `Talle ${item.size}` : item.variantName}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                          <span className="text-slate-300">{formatPrice(item.unitPrice * item.quantity)}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <QuantityButtons
                              quantity={item.quantity}
                              maxQuantity={getCartLineMaxQuantity(item.stock)}
                              onDecrease={() => updateQuantity(item.variantId, item.quantity - 1)}
                              onIncrease={() => updateQuantity(item.variantId, item.quantity + 1)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeItem(item.variantId)}
                              className="h-8 w-8 text-slate-400 hover:text-red-300"
                            >
                              <Trash2 />
                              <span className="sr-only">Quitar del carrito</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-slate-800 bg-slate-950/95">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Subtotal</span>
              <span className="text-lg font-bold text-white">{formatPrice(subtotal)}</span>
            </div>
            <Separator className="bg-slate-800" />
            <Link
              href="/carrito"
              onClick={close}
              className={cn(
                buttonVariants({ variant: "brand" }),
                "h-11 w-full text-base font-semibold"
              )}
            >
              Ir al carrito
            </Link>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function QuantityButtons({
  quantity,
  maxQuantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number;
  maxQuantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-1 py-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={quantity <= 1}
        onClick={onDecrease}
        className="h-6 w-6 rounded-sm text-slate-200 hover:bg-slate-800"
      >
        <Minus className="size-3.5" />
        <span className="sr-only">Restar unidad</span>
      </Button>

      <span className="w-5 text-center text-xs font-semibold text-slate-200">{quantity}</span>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={quantity >= maxQuantity}
        onClick={onIncrease}
        className="h-6 w-6 rounded-sm text-slate-200 hover:bg-slate-800"
      >
        <Plus className="size-3.5" />
        <span className="sr-only">Sumar unidad</span>
      </Button>
    </div>
  );
}
