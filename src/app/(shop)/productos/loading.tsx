import { ProductGridSkeleton } from "@/components/shop/product-grid-skeleton";
import { PageContainer } from "@/components/layout/page-container";

export default function ProductosLoading() {
  return (
    <PageContainer className="py-6 sm:py-8">
      <div className="mb-6 space-y-2 sm:mb-8" aria-hidden="true">
        <div className="h-10 w-44 animate-pulse rounded bg-slate-700/70" />
        <div className="h-5 w-80 max-w-full animate-pulse rounded bg-slate-800/70" />
      </div>
      <ProductGridSkeleton />
    </PageContainer>
  );
}
