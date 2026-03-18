import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { formatPrice } from '@/lib/utils/currency';
import type { ProductCardData } from '@/types/product';

export type ProductCardProps = {
  product: ProductCardData;
};

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = product.images?.[0] || '/placeholder-product.jpg';
  const productUrl = `/productos/${product.slug}`;

  return (
    <Card className="group relative overflow-hidden border-slate-700/50 bg-slate-800/40 backdrop-blur transition-all hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10">
      {/* Favorites action pending backend support */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-slate-900/80 p-2 text-slate-400 backdrop-blur"
      >
        <Heart className="h-5 w-5" />
      </div>

      {/* Product Image */}
      <Link href={productUrl} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-900/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </Link>

      {/* Product Info */}
      <div className="space-y-3 p-4">
        {/* Category Badge */}
        <Badge
          variant="secondary"
          className="bg-slate-700/50 text-xs text-slate-300 hover:bg-slate-700"
        >
          {product.category.name}
        </Badge>

        {/* Product Name */}
        <Link href={productUrl}>
          <h3 className="line-clamp-2 text-lg font-semibold text-slate-100 transition-colors hover:text-red-400">
            {product.name}
          </h3>
        </Link>

        {/* Price & CTA */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-2xl font-bold text-white">
            {formatPrice(product.base_price)}
          </span>
          <Button
            render={
              <Link href={productUrl} />
            }
            size="sm"
            className="bg-red-600 hover:bg-red-700"
          >
            Ver producto
          </Button>
        </div>
      </div>
    </Card>
  );
}
