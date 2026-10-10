import { cn } from "@/lib/cn";

/** Engineer's scale rule: tick marks every 10%, solid hazard fill for work done. */
export function ProgressRule({ value, label, className }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-3 flex-1 border border-ink bg-paper" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
        <div className="absolute inset-y-0 left-0 bg-hazard" style={{ width: `${v}%` }} />
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} aria-hidden className={cn("absolute bottom-0 w-px bg-ink/50", i % 2 === 0 ? "h-1.5" : "h-1")} style={{ left: `${(i + 1) * 10}%` }} />
        ))}
      </div>
      <span className="w-10 text-right font-display text-xs font-bold tabular">{v}%</span>
    </div>
  );
}
