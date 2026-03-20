import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils/currency';
import type { ProductCardData } from '@/types/product';

export type ProductCardProps = {
  product: ProductCardData;
};

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = product.images?.[0] || '/placeholder-product.jpg';
  const productUrl = `/productos/${product.slug}`;
  const productWithHints = product as ProductCardData & {
    brand?: string | null;
    seller?: string | null;
    compare_at_price?: number | null;
    compare_price?: number | null;
    discount_percentage?: number | null;
  };

  const compareAtPrice =
    productWithHints.compare_at_price ?? productWithHints.compare_price ?? null;
  const hasDiscount =
    typeof compareAtPrice === 'number' && compareAtPrice > product.base_price;
  const computedDiscount = hasDiscount
    ? Math.round(((compareAtPrice - product.base_price) / compareAtPrice) * 100)
    : null;
  const discountHint =
    typeof productWithHints.discount_percentage === 'number'
      ? Math.max(0, Math.round(productWithHints.discount_percentage))
      : computedDiscount;

  const metaLine = productWithHints.brand || productWithHints.seller || product.category.name;

  return (
    <Card className="group relative gap-0 overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-900/45 p-0 py-0 text-slate-100 transition-all duration-200 hover:border-slate-500/50 hover:bg-slate-900/70 hover:shadow-md hover:shadow-black/20">
      {/* Product Image */}
      <Link href={productUrl} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-900/60">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      {/* Product Info */}
      <Link href={productUrl} className="block p-3 sm:p-4">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            {metaLine}
          </p>

          <h3 className="line-clamp-2 text-sm leading-5 font-semibold text-slate-100 transition-colors group-hover:text-slate-50 sm:text-base">
            {product.name}
          </h3>

          <div className="pt-1">
            <span className="text-xl font-semibold text-white sm:text-2xl">
              {formatPrice(product.base_price)}
            </span>
          </div>

          <p className="flex min-h-5 items-center gap-2 text-xs text-slate-400">
            {hasDiscount ? (
              <>
                <span className="line-through">
                  {formatPrice(compareAtPrice)}
                </span>
                <span className="text-emerald-400/90">
                  -{discountHint}%
                </span>
              </>
            ) : (
              <span>Sin promo activa</span>
            )}
          </p>
        </div>
      </Link>
    </Card>
  );
}
