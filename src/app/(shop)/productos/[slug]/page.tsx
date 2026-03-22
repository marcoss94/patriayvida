import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PageContainer } from '@/components/layout/page-container';
import { ChevronRight, Home } from 'lucide-react';
import { ProductPurchasePanel } from '@/components/cart/product-purchase-panel';
import { ProductGallery } from '@/components/shop/product-gallery';
import type { Metadata } from 'next';
import type { ProductVariant } from '@/types/product';

type ProductDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from('products')
    .select('name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!product) {
    return {
      title: 'Producto no encontrado | Patria y Vida',
    };
  }

  return {
    title: `${product.name} | Patria y Vida`,
    description: product.description || `Comprá ${product.name} en Patria y Vida. Envío a todo el país.`,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch product with category and variants
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories!inner(
        id,
        name,
        slug,
        description
      ),
      variants:product_variants(
        id,
        name,
        sku,
        stock,
        price_override,
        attributes,
        is_active
      )
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('variants.is_active', true)
    .order('name', { referencedTable: 'product_variants', ascending: true })
    .single();

  if (error || !product) {
    notFound();
  }

  // Type assertion for joined data
  const category = product.category as unknown as {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };

  const variants = (product.variants || []) as unknown as ProductVariant[];

  // Calculate available sizes
  const sizes = variants
    .map((v) => {
      const attrs = v.attributes as { size?: string };
        return {
          id: v.id,
          name: v.name,
          size: attrs.size || v.name,
          stock: v.stock,
          price: v.price_override ?? product.base_price,
        };
      })
    .sort((a, b) => {
      // Sort sizes: XS, S, M, L, XL, XXL
      const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      const aIndex = order.indexOf(a.size);
      const bIndex = order.indexOf(b.size);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  const productImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images.filter(
          (image: unknown): image is string => typeof image === 'string' && image.length > 0
        )
      : [];
  const imageUrl = productImages[0] || '/placeholder-product.jpg';
  const galleryImages = productImages.length > 0 ? productImages : [imageUrl];

  return (
    <PageContainer className="py-8">
      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-red-400">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/productos" className="hover:text-red-400">
          Productos
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/productos" className="hover:text-red-400">
          {category.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-300">{product.name}</span>
      </nav>

      {/* Product Detail Grid */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,56%)_minmax(0,44%)] lg:items-start lg:gap-10">
        {/* Sticky Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductGallery images={galleryImages} productName={product.name} />
        </div>

        {/* Product Info */}
        <div className="min-w-0 space-y-6">
          {/* Category Badge */}
          <Badge variant="secondary" className="bg-slate-700/50 text-slate-300">
            {category.name}
          </Badge>

          {/* Product Name */}
          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white">{product.name}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Elegí talle y cantidad para sumar esta prenda al carrito sin salir de la ficha.
            </p>
          </div>

          <ProductPurchasePanel
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              basePrice: product.base_price,
              imageUrl,
            }}
            variants={sizes}
            description={product.description ?? null}
          />
        </div>
      </div>

      {/* Additional Product Info (placeholder for future sections) */}
      <div className="mt-12 space-y-6 border-t border-slate-700/50 pt-8">
        <h2 className="text-2xl font-bold text-white">Información adicional</h2>
        <div className="grid gap-4 text-slate-300 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold text-white">Envío</h3>
            <p className="text-sm text-slate-400">
              Envíos a todo el país. El costo final se confirma en checkout según la entrega que elijas.
            </p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-white">Cambios y devoluciones</h3>
            <p className="text-sm text-slate-400">
              Tenés 30 días para gestionar cambios. Si necesitás ayuda, escribinos desde tu cuenta.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
