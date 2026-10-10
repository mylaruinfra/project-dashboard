import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Inline attention bar with a 4px left rule (hazard = needs action). */
export function Notice({ tone = "ink", title, children, action, className }: { tone?: "ink" | "hazard" | "error"; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const rule = { ink: "border-l-ink", hazard: "border-l-hazard", error: "border-l-error" }[tone];
  return (
    <div className={cn("flex flex-col gap-3 border border-hairline border-l-4 bg-paper p-4 md:flex-row md:items-center md:justify-between", rule, className)}>
      <div className="min-w-0 space-y-1">
        <p className="font-display text-base font-bold">{title}</p>
        {children ? <div className="body-md text-steel">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
