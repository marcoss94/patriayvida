import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/page-container";
import { ProductCard } from "@/components/shop/product-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowRight, Flame, ShieldCheck, Sparkles } from "lucide-react";

async function getHomeProducts() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      slug,
      base_price,
      images,
      category:categories!inner(
        name,
        slug
      )
    `
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(8);

  return (products || []).map((product) => {
    const category = product.category as unknown as { name: string; slug: string };

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      base_price: product.base_price,
      images: product.images,
      category: {
        name: category.name,
        slug: category.slug,
      },
    };
  });
}

export default async function Home() {
  const featuredProducts = await getHomeProducts();

  return (
    <div className="relative flex flex-1 flex-col">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cuba-blue-deep via-background to-background" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,_rgba(26,43,94,0.6)_0%,_transparent_52%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,_rgba(204,41,54,0.14)_0%,_transparent_46%)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cuba-red/20 blur-3xl" />

        <PageContainer className="relative z-10 py-12 text-center sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-cuba-red/30 bg-cuba-red/10 px-4 py-1.5 text-xs font-medium text-cuba-red-light">
              Diseño con garra y actitud real
            </div>

            <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Patria y Vida
            </h1>

            <div className="mx-auto mt-6 h-px w-28 bg-gradient-to-r from-transparent via-cuba-red/60 to-transparent" />

            <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Remeras y productos con identidad cubana para destacar sin vueltas.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/productos"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    className:
                      "gap-2 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-[0_10px_35px_rgba(204,41,54,0.25)] transition-all duration-200 hover:bg-primary/90",
                  })
                )}
              >
                Explorar catálogo
                <ArrowRight className="size-4" />
              </Link>

              <Link
                href="/carrito"
                className={cn(
                  buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className:
                      "rounded-xl border-border/80 bg-background/65 px-8 text-base text-foreground backdrop-blur transition-colors duration-200 hover:bg-secondary/80",
                  })
                )}
              >
                Ver carrito
              </Link>
            </div>

            <div className="mt-11 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/40 px-4 py-3 backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Flame className="size-4 text-cuba-red" />
                  Diseños con identidad
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/40 px-4 py-3 backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-cuba-red" />
                  Ediciones con personalidad
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/40 px-4 py-3 backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="size-4 text-cuba-red" />
                  Compra simple y segura
                </p>
              </div>
            </div>
          </div>
        </PageContainer>
        <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="pb-12 sm:pb-16">
        <PageContainer>
          <div className="mb-6 flex items-end justify-between gap-3 sm:mb-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.24em] text-cuba-red-light uppercase">
                Destacados
              </p>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Productos en tendencia
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                Selección actual de la tienda para que arranques con lo mejor.
              </p>
            </div>

            <Link
              href="/productos"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className: "rounded-lg border-border/70 bg-background/60",
                })
              )}
            >
              Ver todo
            </Link>
          </div>

          {featuredProducts.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card/40 px-6 py-10 text-center text-muted-foreground">
              <p className="text-base font-medium text-foreground">Todavía no hay productos destacados.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Estamos preparando nuevas publicaciones. Volvé en un rato para ver la próxima tanda.
              </p>
              <div className="mt-5">
                <Link
                  href="/productos"
                  className={cn(buttonVariants({ variant: "outline", className: "rounded-lg border-border/70 bg-background/60" }))}
                >
                  Ir al catálogo completo
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </PageContainer>
      </section>
    </div>
  );
}
