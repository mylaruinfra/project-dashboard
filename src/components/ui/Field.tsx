import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label above the control, drafted with dimension ticks: ├─ LABEL ─┤ */
export function Field({ label, htmlFor, error, hint, required, className, children }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="label-technical flex items-center gap-1 text-steel">
        <span aria-hidden className="text-hairline">├─</span>
        <span className="truncate">{label}</span>
        {required ? <span className="text-hazard" aria-label="required">*</span> : null}
        <span aria-hidden className="text-hairline">─┤</span>
      </label>
      {children}
      {error ? (
        <p role="alert" className="body-sm text-error">
          {error}
        </p>
      ) : hint ? (
        <p className="body-sm text-steel">{hint}</p>
      ) : null}
    </div>
  );
}
