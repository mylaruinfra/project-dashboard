import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const controlClass = (invalid?: boolean, extra?: string) =>
  cn(
    "h-11 w-full min-w-0 border bg-paper px-3 body-md text-ink placeholder:text-steel/70",
    "focus:border-ink focus:shadow-[inset_0_0_0_1px_var(--color-ink)] focus:outline-none",
    "disabled:bg-surface-low disabled:text-steel read-only:bg-surface-low",
    invalid ? "border-error shadow-[inset_0_0_0_1px_var(--color-error)]" : "border-hairline",
    extra,
  );

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return <input className={controlClass(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}
