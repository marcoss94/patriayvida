import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/shop/product-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';

type SearchParams = Promise<{
  categoria?: string;
}>;

type ProductosPageProps = {
  searchParams: SearchParams;
};

export const metadata: Metadata = {
  title: 'Productos | Patria y Vida',
  description: 'Descubre nuestra colección completa de remeras con diseños únicos. Calidad premium, envío a todo el país.',
};

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  const params = await searchParams;
  const categorySlug = params.categoria;

  const supabase = await createClient();

  // Fetch all active categories for filter tabs
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('sort_order', { ascending: true });

  // Fetch products with optional category filter
  let query = supabase
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

  // Apply category filter if present
  if (categorySlug) {
    query = query.eq('categories.slug', categorySlug);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
  }

  // Transform data to match ProductCardData type
  const productsData = (products || []).map((p) => {
    // Supabase returns category as an object when using !inner join
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-4xl font-bold text-white">Productos</h1>
        <p className="text-lg text-slate-400">
          Explorá nuestra colección completa
        </p>
      </div>

      {/* Category Filter Tabs */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link href="/productos" scroll={false}>
          <Badge
            variant={!categorySlug ? 'default' : 'secondary'}
            className={
              !categorySlug
                ? 'cursor-pointer bg-red-600 hover:bg-red-700'
                : 'cursor-pointer bg-slate-700/50 hover:bg-slate-700'
            }
          >
            Todos
          </Badge>
        </Link>
        {categories?.map((cat) => (
          <Link
            key={cat.id}
            href={`/productos?categoria=${cat.slug}`}
            scroll={false}
          >
            <Badge
              variant={categorySlug === cat.slug ? 'default' : 'secondary'}
              className={
                categorySlug === cat.slug
                  ? 'cursor-pointer bg-red-600 hover:bg-red-700'
                  : 'cursor-pointer bg-slate-700/50 hover:bg-slate-700'
              }
            >
              {cat.name}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Products Grid */}
      {productsData.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
          <ShoppingBag className="h-16 w-16 text-slate-600" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-300">
              No hay productos disponibles
            </h2>
            <p className="text-slate-500">
              {categorySlug
                ? 'Probá con otra categoría o volvé más tarde.'
                : 'Volvé más tarde para ver nuestros productos.'}
            </p>
          </div>
          {categorySlug && (
            <Link
              href="/productos"
              className="mt-4 text-red-400 hover:text-red-300"
            >
              Ver todos los productos
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productsData.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
