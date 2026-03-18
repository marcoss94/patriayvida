import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOrderStatusMeta, type OrderRow } from "@/lib/orders";

const toneClasses = {
  neutral: "border-slate-700 bg-slate-900/70 text-slate-200",
  pending: "border-amber-500/30 bg-amber-500/12 text-amber-100",
  accent: "border-sky-500/30 bg-sky-500/12 text-sky-100",
  success: "border-emerald-500/30 bg-emerald-500/12 text-emerald-100",
  danger: "border-red-500/30 bg-red-500/12 text-red-100",
} as const;

export function OrderStatusBadge({ status }: { status: OrderRow["status"] }) {
  const meta = getOrderStatusMeta(status);

  return <Badge className={cn("border", toneClasses[meta.tone])}>{meta.label}</Badge>;
}
