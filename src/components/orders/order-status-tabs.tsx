import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BusinessOrderStatus } from "@/lib/orders";

type StatusTabValue = BusinessOrderStatus | "all";

type OrderStatusTab = {
  value: StatusTabValue;
  label: string;
};

type OrderStatusTabsProps = {
  tabs: readonly OrderStatusTab[];
  activeValue: StatusTabValue;
  getHref: (value: StatusTabValue) => string;
  ariaLabel?: string;
};

export function OrderStatusTabs({
  tabs,
  activeValue,
  getHref,
  ariaLabel = "Filtrar pedidos por estado",
}: OrderStatusTabsProps) {
  return (
    <nav aria-label={ariaLabel}>
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
        {tabs.map((tab) => {
          const isActive = activeValue === tab.value;

          return (
            <Link
              key={tab.value}
              href={getHref(tab.value)}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "inline-flex min-h-9 min-w-[8.5rem] flex-1 items-center justify-center rounded-xl border px-4 py-1 text-sm font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 sm:min-w-0 sm:flex-none",
                isActive
                  ? "border-red-500/60 bg-red-500/15 text-red-100"
                  : "border-slate-800 bg-slate-900/55 text-slate-300 hover:border-slate-700 hover:text-white"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
