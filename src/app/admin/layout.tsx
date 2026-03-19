import Link from "next/link";
import { LayoutDashboard, Package, Settings, ShoppingBag, Tag } from "lucide-react";
import { requireAdminRouteAccess } from "@/lib/admin-auth";

const adminNavItems = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: Package },
  { href: "/admin/productos", label: "Productos", icon: ShoppingBag },
  { href: "/admin/categorias", label: "Categorías", icon: Tag },
  { href: "/admin/config", label: "Configuración", icon: Settings },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminRouteAccess("/admin");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground">Administración</h1>
        <nav
          aria-label="Navegación principal de administración"
          className="rounded-2xl border border-border/80 bg-card/60 p-2"
        >
          <div className="flex flex-wrap gap-2">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:border-border hover:bg-secondary hover:text-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mt-6">{children}</main>
    </div>
  );
}
