import { Badge } from "@/components/ui/badge";
import { getPaymentStatusMeta, type OrderRow } from "@/lib/orders";
import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-slate-700 bg-slate-900/70 text-slate-200",
  pending: "border-amber-500/30 bg-amber-500/12 text-amber-100",
  success: "border-emerald-500/30 bg-emerald-500/12 text-emerald-100",
  danger: "border-red-500/30 bg-red-500/12 text-red-100",
} as const;

export function PaymentStatusBadge({
  status,
  mpStatus,
}: {
  status: OrderRow["status"];
  mpStatus: OrderRow["mp_status"];
}) {
  const meta = getPaymentStatusMeta({ status, mp_status: mpStatus });

  return <Badge className={cn("border", toneClasses[meta.tone])}>{meta.label}</Badge>;
}
