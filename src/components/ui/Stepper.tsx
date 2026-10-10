import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  steps: readonly string[];
  current: number;
  /** Steps the person may jump back to. */
  onStep?: (i: number) => void;
  maxReached: number;
}

/** Numbered drafting stepper; square markers, ink rules between steps. */
export function Stepper({ steps, current, onStep, maxReached }: Props) {
  return (
    <ol className="mb-5 grid grid-cols-1 border border-hairline bg-paper" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached && onStep;
        return (
          <li key={s} className={cn("border-hairline", i > 0 && "border-l")}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onStep?.(i)}
              aria-current={active ? "step" : undefined}
              className={cn("flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2", active && "border-b-[3px] border-hazard", !reachable && "cursor-default")}
            >
              <span className={cn("inline-flex size-6 items-center justify-center border font-display text-xs font-bold", active ? "border-hazard bg-hazard text-white" : done ? "border-ink bg-ink text-white" : "border-hairline text-steel")}>
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("label-code hidden sm:block", active ? "text-ink" : "text-steel")}>{s}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
