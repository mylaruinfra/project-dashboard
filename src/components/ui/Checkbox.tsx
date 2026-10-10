import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  hint?: string;
}

/** 18px sharp square; checked = solid ink with a white cross. Whole row is a 44px target. */
export function Checkbox({ label, hint, className, ...rest }: Props) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 py-1", className)}>
      <span className="relative inline-flex size-[18px] shrink-0">
        <input type="checkbox" className="peer absolute inset-0 size-full cursor-pointer appearance-none border border-ink bg-paper checked:bg-ink" {...rest} />
        <svg viewBox="0 0 18 18" className="pointer-events-none absolute inset-0 hidden size-full text-white peer-checked:block" aria-hidden>
          <path d="M4.5 4.5 13.5 13.5 M13.5 4.5 4.5 13.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      <span className="flex flex-col">
        <span className="body-md text-ink">{label}</span>
        {hint ? <span className="body-sm text-steel">{hint}</span> : null}
      </span>
    </label>
  );
}
