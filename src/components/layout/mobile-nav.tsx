"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  User,
  Heart,
  Package,
  LogOut,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { CartButton } from "@/components/cart/cart-button";

interface MobileNavProps {
  user: {
    email: string;
    fullName: string | null;
    initials: string;
    isAdmin: boolean;
  } | null;
}

export function MobileNav({ user }: MobileNavProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <CartButton />

      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-foreground"
            />
          }
        >
          <Menu className="size-5" />
          <span className="sr-only">Menú</span>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-72 border-border bg-background"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-foreground">
              Patria y Vida
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 py-2">
            <nav className="flex flex-col gap-1">
              <SheetClose
                render={
                  <Link
                    href="/productos"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                  />
                }
              >
                <LayoutGrid className="size-4" />
                Catálogo
              </SheetClose>

              <SheetClose
                render={
                  <Link
                    href="/productos"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                  />
                }
              >
                <Package className="size-4" />
                Productos
              </SheetClose>

              {user?.isAdmin && (
                <SheetClose
                  render={
                    <Link
                      href="/admin"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-primary"
                    />
                  }
                >
                  <Settings className="size-4" />
                  Admin
                </SheetClose>
              )}
            </nav>

            <Separator className="bg-border" />

            {user ? (
              <div className="flex flex-col gap-1">
                <div className="px-3 py-2">
                  {user.fullName && (
                    <p className="text-sm font-medium text-foreground">
                      {user.fullName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <SheetClose
                  render={
                    <Link
                      href="/cuenta"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                    />
                  }
                >
                  <User className="size-4" />
                  Mi perfil
                </SheetClose>
                <SheetClose
                  render={
                    <Link
                      href="/cuenta/pedidos"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                    />
                  }
                >
                  <Package className="size-4" />
                  Mis pedidos
                </SheetClose>
                <SheetClose
                  render={
                    <Link
                      href="/cuenta/favoritos"
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                    />
                  }
                >
                  <Heart className="size-4" />
                  Favoritos
                </SheetClose>
                <Separator className="bg-border" />
                <button
                  onClick={handleSignOut}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors duration-200 hover:bg-destructive/10"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 px-3">
                <Button
                  render={<Link href="/login" />}
                  className="w-full cursor-pointer rounded-lg bg-primary font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                >
                  Iniciar sesión
                </Button>
                <Button
                  render={<Link href="/registro" />}
                  variant="outline"
                  className="w-full cursor-pointer rounded-lg border-border transition-colors duration-200"
                >
                  Crear cuenta
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
