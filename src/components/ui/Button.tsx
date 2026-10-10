import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "inverse";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-hazard text-white border border-hazard hover:bg-ink hover:border-ink",
  secondary: "bg-paper text-ink border border-ink hover:bg-ink hover:text-white",
  destructive: "bg-paper text-hazard border-2 border-hazard hover:bg-hazard hover:text-white",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface-low",
  inverse: "bg-ink text-white border border-ink hover:bg-hazard hover:border-hazard",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-[0.875rem]",
  sm: "min-h-11 px-3 text-[0.75rem] md:min-h-9",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-display font-bold uppercase tracking-[0.08em] whitespace-nowrap select-none",
    "transition-colors active:translate-x-px active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  full?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, full, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, cn(full && "w-full", className))} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="inline-block size-3 animate-pulse bg-current" aria-hidden /> : null}
      {children}
    </button>
  );
}
