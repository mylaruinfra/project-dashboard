import { cn } from "@/lib/cn";

/** Circular status pin — one of the few curves DESIGN.md allows. */
export function StatusDot({ tone = "ink", className }: { tone?: "ink" | "hazard" | "steel" | "indigo"; className?: string }) {
  const bg = { ink: "bg-ink", hazard: "bg-hazard", steel: "bg-steel", indigo: "bg-indigo" }[tone];
  return <span aria-hidden className={cn("inline-block size-2 rounded-dot", bg, className)} />;
}
