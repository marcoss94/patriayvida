import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RouteLoadingProps = {
  message?: string;
  className?: string;
  compact?: boolean;
};

export function RouteLoading({
  message = "Cargando...",
  className,
  compact = false,
}: RouteLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        "flex w-full items-center justify-center rounded-2xl border border-border/70 bg-card/40 p-6",
        compact ? "min-h-[180px]" : "min-h-[280px]",
        className
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 aria-hidden="true" className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <span className="sr-only">Actualizando contenido</span>
      </div>
    </div>
  );
}
