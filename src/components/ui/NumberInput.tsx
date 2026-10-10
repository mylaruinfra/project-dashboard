import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./Input";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
  suffix?: string;
  integer?: boolean;
}

/** Quantities and lengths as text with a numeric keypad; parsing happens on the server. */
export function NumberInput({ invalid, className, suffix, integer, ...rest }: Props) {
  return (
    <div className="relative flex w-full items-center">
      <input type="text" inputMode={integer ? "numeric" : "decimal"} autoComplete="off" className={controlClass(invalid, cn("tabular", suffix && "pr-14", className))} aria-invalid={invalid || undefined} {...rest} />
      {suffix ? <span className="pointer-events-none absolute right-3 body-sm text-steel">{suffix}</span> : null}
    </div>
  );
}
