import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DescriptionRow {
  label: string;
  value: ReactNode;
  numeric?: boolean;
}

/** Key/value schedule rows: label left, value right (numbers right-aligned). */
export function DescriptionList({ rows, className }: { rows: DescriptionRow[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-hairline", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex min-h-11 items-center justify-between gap-4 px-4 py-2">
          <dt className="body-sm shrink-0 text-steel">{r.label}</dt>
          <dd className={cn("body-md min-w-0 text-right text-ink [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center", r.numeric && "font-display font-semibold tabular")}>{r.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
