import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
        {/* Deep navy gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cuba-blue-deep via-background to-background" />

        {/* Subtle blue glow — upper area */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(26,43,94,0.35)_0%,_transparent_50%)]" />

        {/* Faint red glow — bottom accent */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(204,41,54,0.06)_0%,_transparent_40%)]" />

        <div className="relative z-10 mx-auto max-w-3xl">
          {/* Small tag — red accent */}
          <div className="mb-6 inline-flex items-center rounded-full border border-cuba-red/25 bg-cuba-red/8 px-4 py-1.5 text-xs font-medium text-cuba-red-light">
            Tu tienda online en Uruguay
          </div>

          {/* Main heading */}
          <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Patria y Vida
          </h1>

          {/* Red divider line */}
          <div className="mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-cuba-red/50 to-transparent" />

          {/* Decorative star — Cuban flag reference */}
          <div className="mt-4 text-sm tracking-[0.5em] text-cuba-red/40">
            ★
          </div>



          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Encontrá los mejores productos con envío a todo el país. Calidad,
            variedad y los mejores precios en un solo lugar.
          </p>

          {/* CTA — white primary button */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              render={<Link href="/productos" />}
              size="lg"
              className="cursor-pointer gap-2 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90"
            >
              Explorar productos
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Bottom fade gradient */}
        <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-background to-transparent" />
      </section>
    </div>
  );
}
