import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Package,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CartButton } from "@/components/cart/cart-button";
import { PageContainer } from "@/components/layout/page-container";
import { cn } from "@/lib/utils";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let fullName: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, full_name")
      .eq("id", user.id)
      .single();

    isAdmin = profile?.is_admin ?? false;
    fullName = profile?.full_name ?? null;
  }

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <PageContainer className="flex h-16 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex cursor-pointer items-center gap-2 transition-colors duration-200 hover:opacity-80"
        >
          <span className="text-xl font-bold tracking-tight text-foreground">
            Patria y Vida
          </span>
        </Link>

        {/* Desktop Nav — Center */}
        <nav className="hidden items-center gap-2 md:flex">
          <Link
            href="/productos"
            className={cn(
              buttonVariants({
                variant: "outline",
                size: "sm",
                className:
                  "cursor-pointer gap-2 rounded-full border-border px-4 text-sm font-medium transition-colors duration-200 hover:border-primary hover:text-primary",
              })
            )}
          >
            <LayoutGrid className="size-4" />
            Catálogo
          </Link>

          <Link
            href="/sobre-nosotros"
            className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            Sobre nosotros
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-primary"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="size-3.5" />
                Admin
              </span>
            </Link>
          )}
        </nav>

        {/* Right side — Actions */}
        <div className="hidden items-center gap-1 md:flex">
          {/* Cart */}
          <CartButton />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="relative ml-1 size-9 cursor-pointer rounded-full"
                  />
                }
              >
                <Avatar className="size-9 border border-border">
                  <AvatarFallback className="bg-secondary text-sm font-medium text-secondary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 border-border bg-card"
                align="end"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      {fullName && (
                        <p className="text-sm font-medium leading-none text-card-foreground">
                          {fullName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <Link
                    href="/cuenta"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className:
                          "w-full justify-start rounded-md px-1.5 text-sm font-normal transition-colors duration-200",
                      })
                    )}
                  >
                    <User className="mr-2 size-4" />
                    Mi perfil
                  </Link>
                  <Link
                    href="/cuenta/pedidos"
                    className={cn(
                      buttonVariants({
                        variant: "ghost",
                        size: "sm",
                        className:
                          "w-full justify-start rounded-md px-1.5 text-sm font-normal transition-colors duration-200",
                      })
                    )}
                  >
                    <Package className="mr-2 size-4" />
                    Mis pedidos
                  </Link>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-border" />
                <SignOutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className={cn(
                buttonVariants({
                  size: "sm",
                  className:
                    "ml-2 cursor-pointer rounded-lg bg-primary font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90",
                })
              )}
            >
              Iniciar sesión
            </Link>
          )}
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden">
          <MobileNav
            user={
              user
                ? {
                    email: user.email ?? "",
                    fullName,
                    initials,
                    isAdmin,
                  }
                : null
            }
          />
        </div>
      </PageContainer>
    </header>
  );
}
