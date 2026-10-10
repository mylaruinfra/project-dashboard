import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: "ink" | "hazard";
}

/** Square 44px icon-only button with an accessible label. */
export function IconButton({ label, children, className, tone = "ink", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center border border-transparent transition-colors hover:border-hairline hover:bg-surface-low disabled:opacity-40",
        tone === "hazard" ? "text-hazard" : "text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
