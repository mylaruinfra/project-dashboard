import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  crosshairs?: boolean;
}

/** Bounded white schedule sheet: hairline border, header on canvas with an ink rule. */
export function Panel({ title, action, children, className, bodyClassName, crosshairs = true }: Props) {
  return (
    <section className={cn("border border-hairline bg-paper", crosshairs && "crosshairs", className)}>
      {title || action ? (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-ink bg-canvas px-4">
          <h3 className="label-technical text-ink">{title}</h3>
          {action}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
