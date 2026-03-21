import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sobre nosotros | Patria y Vida",
  description:
    "Conocé la historia, la misión y los valores detrás de Patria y Vida.",
};

export default function SobreNosotrosPage() {
  return (
    <div className="relative">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cuba-blue-deep/30 via-background to-background" />
        <PageContainer className="relative z-10 py-12 sm:py-16">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold tracking-[0.24em] text-cuba-red-light uppercase">
              Sobre nosotros
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Identidad cubana, energía uruguaya
            </h1>
            <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Somos una tienda creada para quienes usan la ropa como una forma
              de decir quiénes son. Diseño, cultura y actitud en cada pieza.
            </p>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-10 sm:py-14">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-border/70 bg-card/50 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-foreground">Quiénes somos</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Un proyecto independiente nacido en Uruguay, inspirado por la
              fuerza visual y cultural de Cuba. Combinamos producción cuidada
              con diseños que no pasan desapercibidos.
            </p>
          </article>

          <article className="rounded-2xl border border-border/70 bg-card/50 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-foreground">
              Por qué lo construimos
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Porque faltaba una propuesta local con identidad fuerte y mensaje
              claro. Queremos que cada producto te represente de verdad, sin
              fórmulas vacías.
            </p>
          </article>

          <article className="rounded-2xl border border-border/70 bg-card/50 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-foreground">
              Valores y misión
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Apostamos por autenticidad, calidad y respeto por la comunidad.
              Nuestra misión es acercar productos con historia, carácter y una
              experiencia de compra simple.
            </p>
          </article>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/productos"
            className={cn(
              buttonVariants({
                className: "rounded-lg px-6 font-semibold",
              })
            )}
          >
            Ver catálogo
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
