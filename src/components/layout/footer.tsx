import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";

const footerLinks = [
  { href: "/productos", label: "Catálogo" },
  { href: "/sobre-nosotros", label: "Sobre nosotros" },
  { href: "/carrito", label: "Carrito" },
  { href: "/cuenta", label: "Mi cuenta" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/80 bg-background/95">
      <PageContainer className="flex flex-col gap-5 py-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl space-y-2">
            <p className="text-lg font-semibold text-foreground">Patria y Vida</p>
            <p className="text-sm text-muted-foreground">
              Tienda uruguaya con identidad cubana, compras simples y seguimiento claro de cada pedido.
            </p>
          </div>

          <nav
            aria-label="Enlaces del pie de página"
            className="flex flex-wrap items-center gap-2 sm:justify-end"
          >
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <a
              href="https://www.instagram.com/patriayvida/"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Instagram
            </a>
          </nav>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

        <p className="text-xs leading-5 text-muted-foreground">© {year} Patria y Vida. Hecho en Uruguay.</p>
      </PageContainer>
    </footer>
  );
}
