"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/stores/cart-store";
import {
  getCartLineMaxQuantity,
  sanitizeCartQuantity,
} from "@/lib/cart";
import {
  formatPrice,
  formatStock,
  hasStock,
} from "@/lib/utils/currency";

type PurchaseVariant = {
  id: string;
  name: string;
  size: string;
  stock: number;
  price: number;
};

type ProductPurchasePanelProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    basePrice: number;
    imageUrl: string | null;
  };
  variants: PurchaseVariant[];
};

type Notice = {
  tone: "error" | "success";
  message: string;
};

export function ProductPurchasePanel({
  product,
  variants,
}: ProductPurchasePanelProps) {
  const { addItem, isHydrated } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedVariantId, variants]
  );

  const currentPrice = selectedVariant?.price ?? product.basePrice;
  const maxQuantity = selectedVariant
    ? getCartLineMaxQuantity(selectedVariant.stock)
    : 1;

  function handleSelectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setQuantity(1);
    setNotice(null);
  }

  function handleQuantityChange(nextValue: number) {
    if (!selectedVariant) {
      return;
    }

    setQuantity(sanitizeCartQuantity(nextValue, selectedVariant.stock));
    setNotice(null);
  }

  function handleAddToCart() {
    if (!selectedVariant) {
      setNotice({
        tone: "error",
        message: "Elegí un talle disponible antes de agregar el producto.",
      });
      return;
    }

    if (!hasStock(selectedVariant.stock)) {
      setNotice({
        tone: "error",
        message: "Ese talle ya no tiene stock disponible.",
      });
      return;
    }

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      slug: product.slug,
      productName: product.name,
      variantName: selectedVariant.name,
      size: selectedVariant.size,
      imageUrl: product.imageUrl,
      unitPrice: selectedVariant.price,
      quantity,
      stock: selectedVariant.stock,
    });

    setNotice({
      tone: "success",
      message: `${product.name} (${selectedVariant.size}) se agregó al carrito.`,
    });
  }

  const hasAvailableVariants = variants.some((variant) => hasStock(variant.stock));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-medium text-slate-200">Seleccionar talle</p>
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-900/70 text-slate-300"
          >
            {hasAvailableVariants ? "Elegí tu variante" : "Sin stock"}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {variants.map((variant) => {
            const available = hasStock(variant.stock);
            const selected = selectedVariantId === variant.id;

            return (
              <button
                key={variant.id}
                type="button"
                disabled={!available}
                onClick={() => handleSelectVariant(variant.id)}
                aria-pressed={selected}
                aria-label={`Talle ${variant.size}${!available ? " (sin stock)" : ""}`}
                className={cnPurchaseOption({ available, selected })}
              >
                <span>{variant.size}</span>
                <span className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-slate-400">
                  {available ? "Stock" : "Agotado"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="min-h-5 text-sm text-slate-400">
          {selectedVariant
            ? formatStock(selectedVariant.stock)
            : "Seleccioná un talle para habilitar la compra."}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-base font-medium text-slate-200">Cantidad</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!selectedVariant || quantity <= 1}
            onClick={() => handleQuantityChange(quantity - 1)}
            className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
          >
            <Minus />
            <span className="sr-only">Restar unidad</span>
          </Button>

          <Input
            id="quantity"
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            disabled={!selectedVariant}
            onChange={(event) => handleQuantityChange(Number(event.target.value))}
            className="w-24 border-slate-700 bg-slate-900/60 text-center text-slate-100"
          />

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!selectedVariant || quantity >= maxQuantity}
            onClick={() => handleQuantityChange(quantity + 1)}
            className="border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
          >
            <Plus />
            <span className="sr-only">Sumar unidad</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-700/50 pt-6">
        <div className="flex items-end justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-4 shadow-[0_0_0_1px_rgba(204,41,54,0.08)]">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Precio unitario
            </span>
            <span className="text-4xl font-bold text-white">
              {formatPrice(currentPrice)}
            </span>
          </div>
          {selectedVariant ? (
            <Badge className="bg-red-600/90 text-white">
              {selectedVariant.size}
            </Badge>
          ) : null}
        </div>

        <Button
          type="button"
          size="lg"
          onClick={handleAddToCart}
          disabled={!isHydrated || !hasAvailableVariants}
          className="h-12 w-full bg-red-600 text-base font-semibold text-white hover:bg-red-700 disabled:bg-slate-800 disabled:text-slate-500"
        >
          <ShoppingBag data-icon="inline-start" />
          {!isHydrated
            ? "Preparando carrito"
            : hasAvailableVariants
              ? "Agregar al carrito"
              : "Sin stock disponible"}
        </Button>

        {notice ? (
          <div
            className={
              notice.tone === "success"
                ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
                : "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
            }
          >
            <div className="flex items-start gap-3">
              {notice.tone === "success" ? <Check className="mt-0.5 size-4" /> : null}
              <div className="flex flex-col gap-1">
                <span>{notice.message}</span>
                {notice.tone === "success" ? (
                  <Link
                    href="/carrito"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition-colors hover:text-white"
                  >
                    Ir al carrito
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!hasAvailableVariants ? (
          <p className="text-center text-sm text-slate-500">
            Este producto no tiene variantes disponibles en este momento.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function cnPurchaseOption({
  available,
  selected,
}: {
  available: boolean;
  selected: boolean;
}): string {
  if (!available) {
    return "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-center font-semibold text-slate-600 line-through";
  }

  if (selected) {
    return "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-red-500 bg-red-500/12 px-4 py-3 text-center font-semibold text-white shadow-[0_0_22px_rgba(204,41,54,0.18)]";
  }

  return "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/55 px-4 py-3 text-center font-semibold text-slate-100 transition-all hover:border-red-500/70 hover:bg-slate-800/80";
}
