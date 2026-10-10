import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Grid of KpiCells divided by hairlines. */
export function KpiStrip({ children, columns = 5 }: { children: ReactNode; columns?: 2 | 3 | 4 | 5 }) {
  const cols = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" }[columns];
  return <div className={cn("grid grid-cols-2 gap-px border border-hairline bg-hairline max-lg:[&>*:last-child:nth-child(odd)]:col-span-2", cols)}>{children}</div>;
}
