import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "inverse" | "hazard";
}

/** One cell of a KPI strip. "inverse" is the title-block reverse video from DESIGN.md. */
export function KpiCell({ label, value, sub, tone = "default" }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-between gap-2 p-4 lg:p-5", tone === "inverse" ? "bg-ink text-white" : "bg-paper")}>
      <span className={cn("label-technical", tone === "inverse" ? "text-hazard" : tone === "hazard" ? "text-hazard" : "text-steel")}>{label}</span>
      <span className={cn("font-display text-[1.375rem] leading-7 font-bold tracking-tight tabular lg:text-[1.75rem] lg:leading-8", tone === "hazard" && "text-hazard")}>{value}</span>
      {sub ? <span className={cn("body-sm", tone === "inverse" ? "text-white/70" : "text-steel")}>{sub}</span> : null}
    </div>
  );
}
