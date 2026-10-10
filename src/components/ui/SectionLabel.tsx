import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small square marker + tracked uppercase label, as in the owner home reference. */
export function SectionLabel({ children, tone = "ink", action, className }: { children: ReactNode; tone?: "ink" | "hazard"; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex min-h-11 items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5", tone === "hazard" ? "bg-hazard" : "bg-ink")} aria-hidden />
        <h2 className="label-technical text-steel">{children}</h2>
      </div>
      {action}
    </div>
  );
}
