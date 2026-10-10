import { Check, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckRow {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

/** Results of qty × rate, totals, GSTIN and date checks on what the AI read. */
export function ChecksList({ checks }: { checks: CheckRow[] }) {
  if (!checks.length) return <p className="body-sm p-4 text-steel">No checks ran (nothing was read automatically).</p>;
  return (
    <ul className="divide-y divide-hairline">
      {checks.map((c) => (
        <li key={c.id} className={cn("flex gap-3 border-l-4 px-4 py-3", c.status === "fail" ? "border-l-error" : c.status === "warn" ? "border-l-hazard" : "border-l-indigo")}>
          <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center text-white", c.status === "fail" ? "bg-error" : c.status === "warn" ? "bg-hazard" : "bg-indigo")} aria-hidden>
            {c.status === "pass" ? <Check className="size-3.5" /> : c.status === "fail" ? <X className="size-3.5" /> : <CircleAlert className="size-3.5" />}
          </span>
          <span>
            <span className="body-md block font-medium">
              {c.label} <span className="sr-only">{c.status}</span>
            </span>
            <span className="body-sm text-steel">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
