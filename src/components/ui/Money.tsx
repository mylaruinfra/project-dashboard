import { formatINR, formatINRCompact } from "@/lib/money";
import { cn } from "@/lib/cn";

/** Renders paise. null means "hidden for this role" and shows a dash. */
export function Money({ value, compact, className }: { value: number | null | undefined; compact?: boolean; className?: string }) {
  if (value === null || value === undefined) return <span className={cn("text-steel", className)}>—</span>;
  return <span className={cn("tabular whitespace-nowrap", value < 0 && "text-hazard", className)}>{compact ? formatINRCompact(value) : formatINR(value)}</span>;
}
