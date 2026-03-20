"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCart } from "@/stores/cart-store";

type CartButtonProps = {
  buttonClassName?: string;
  badgeClassName?: string;
};

export function CartButton({
  buttonClassName,
  badgeClassName,
}: CartButtonProps) {
  const { itemCount, isHydrated } = useCart();
  const showBadge = isHydrated && itemCount > 0;

  return (
    <Link
      href="/carrito"
      aria-label={
        showBadge ? `Abrir carrito con ${itemCount} productos` : "Abrir carrito"
      }
      className={cn(
        buttonVariants({
          variant: "ghost",
          size: "icon",
        }),
        "relative cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground",
        buttonClassName
      )}
    >
      <ShoppingCart className="size-5" />
      {showBadge ? (
        <Badge
          className={cn(
            "absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent p-0 text-[0.65rem] font-bold text-accent-foreground",
            badgeClassName
          )}
        >
          {itemCount > 99 ? "99+" : itemCount}
        </Badge>
      ) : null}
    </Link>
  );
}
