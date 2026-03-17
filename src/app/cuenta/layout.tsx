import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { User, Package, Heart } from "lucide-react";

export default async function CuentaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/cuenta");
  }

  const navItems = [
    { href: "/cuenta", label: "Mi perfil", icon: User },
    { href: "/cuenta/pedidos", label: "Mis pedidos", icon: Package },
    { href: "/cuenta/favoritos", label: "Favoritos", icon: Heart },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Mi cuenta</h1>
      <div className="flex flex-col gap-8 md:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 md:w-56">
          <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 md:flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
