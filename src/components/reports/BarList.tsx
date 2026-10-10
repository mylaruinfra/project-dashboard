import { formatINRCompact } from "@/lib/money";

/** Horizontal bars for a small set of money values (no chart library needed). */
export function BarList({ rows }: { rows: { label: string; value: number; budget?: number | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.value, r.budget ?? 0)));
  return (
    <ul className="grid grid-cols-1 gap-3 p-4">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-1 gap-1">
          <span className="flex justify-between body-sm">
            <span>{r.label}</span>
            <span className="font-display font-semibold tabular">
              {formatINRCompact(r.value)}
              {r.budget ? <span className="text-steel"> / {formatINRCompact(r.budget)}</span> : null}
            </span>
          </span>
          <span className="relative block h-3 border border-hairline bg-canvas">
            <span className={`absolute inset-y-0 left-0 ${r.budget && r.value > r.budget ? "bg-error" : "bg-hazard"}`} style={{ width: `${(r.value / max) * 100}%` }} />
            {r.budget ? <span className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ left: `${(r.budget / max) * 100}%` }} aria-label="Budget" /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
