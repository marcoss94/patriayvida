import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/shop/product-card';
import { ProductGridSkeleton } from '@/components/shop/product-grid-skeleton';
import { PageContainer } from '@/components/layout/page-container';
import { ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

type ProductosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Productos | Patria y Vida',
  description: 'Descubre nuestra colección completa de remeras con diseños únicos. Calidad premium, envío a todo el país.',
};

async function ProductosCatalogo() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      slug,
      base_price,
      images,
      category:categories!inner(
        name,
        slug
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
  }

  const productsData = (products || []).map((p) => {
    const category = p.category as unknown as { name: string; slug: string };

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      base_price: p.base_price,
      images: p.images,
      category: {
        name: category.name,
        slug: category.slug,
      },
    };
  });

  return (
    <>
      {productsData.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
          <ShoppingBag className="h-16 w-16 text-slate-600" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-300">
              No hay productos disponibles
            </h2>
            <p className="text-slate-500">
              Volvé más tarde para ver nuestros productos.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
          {productsData.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  await searchParams;

  return (
    <PageContainer className="py-6 sm:py-8">
      <div className="mb-6 space-y-2 sm:mb-8">
        <h1 className="text-4xl font-bold text-white">Productos</h1>
        <p className="text-base text-slate-400 sm:text-lg">
          Explorá nuestra colección completa
        </p>
      </div>

      <Suspense
        key="all-products"
        fallback={
          <ProductGridSkeleton />
        }
      >
        <ProductosCatalogo />
      </Suspense>
    </PageContainer>
  );
}
