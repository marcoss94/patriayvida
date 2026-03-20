import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { User, Package } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";

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
  ];

  return (
    <PageContainer className="py-8">
      <header className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground">Mi cuenta</h1>
        <nav aria-label="Navegación principal de cuenta" className="rounded-2xl border border-border/80 bg-card/60 p-2">
          <div className="flex flex-wrap gap-2">
            {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:border-border hover:bg-secondary hover:text-foreground"
                >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="mt-6">{children}</main>
    </PageContainer>
  );
}
