import Link from "next/link";
import { cn } from "@/lib/cn";

/** Small segmented links like "Active · Void · All". */
export function StatusFilter({ basePath, current, options, params = {} }: { basePath: string; current: string; options: { value: string; label: string }[]; params?: Record<string, string | undefined> }) {
  return (
    <div className="flex border border-hairline bg-paper">
      {options.map((o, i) => {
        const sp = new URLSearchParams(Object.entries({ ...params, status: o.value }).filter(([, v]) => v) as [string, string][]);
        return (
          <Link key={o.value} href={`${basePath}?${sp.toString()}`} className={cn("label-technical flex min-h-11 items-center px-3", i > 0 && "border-l border-hairline", current === o.value ? "bg-ink text-white" : "text-steel hover:text-ink")}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
