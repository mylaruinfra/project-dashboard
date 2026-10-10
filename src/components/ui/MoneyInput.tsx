import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./Input";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
  suffix?: string;
}

/** Rupee amount typed as text (never parsed as a float in the browser). */
export function MoneyInput({ invalid, className, suffix, ...rest }: Props) {
  return (
    <div className="relative flex w-full items-center">
      <span className="pointer-events-none absolute left-3 font-display text-steel" aria-hidden>
        ₹
      </span>
      <input type="text" inputMode="decimal" autoComplete="off" className={controlClass(invalid, cn("pl-7 tabular", suffix && "pr-16", className))} aria-invalid={invalid || undefined} {...rest} />
      {suffix ? <span className="pointer-events-none absolute right-3 body-sm text-steel">{suffix}</span> : null}
    </div>
  );
}
