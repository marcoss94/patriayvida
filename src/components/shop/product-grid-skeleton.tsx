type ProductGridSkeletonProps = {
  count?: number;
};

export function ProductGridSkeleton({ count = 8 }: ProductGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={index}
          className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/45"
          aria-hidden="true"
        >
          <div className="aspect-square animate-pulse bg-slate-800/70" />
          <div className="space-y-2 p-3 sm:p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-800/80" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-700/80" />
            <div className="h-4 w-8/12 animate-pulse rounded bg-slate-700/80" />
            <div className="pt-1">
              <div className="h-7 w-28 animate-pulse rounded bg-slate-600/80" />
            </div>
            <div className="h-3 w-24 animate-pulse rounded bg-slate-800/80" />
          </div>
        </article>
      ))}
    </div>
  );
}
