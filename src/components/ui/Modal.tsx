"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Sticky action bar; put the one primary action last. */
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}

/**
 * All create/edit forms open here. On a phone it is a full-width sheet whose body scrolls
 * inside; on desktop a centred panel with the hard offset shadow from DESIGN.md.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const width = { md: "md:max-w-lg", lg: "md:max-w-2xl", xl: "md:max-w-4xl" }[size];

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[94dvh] w-full max-w-none border-0 border-t border-ink bg-paper p-0 text-ink",
        "md:m-auto md:max-h-[88dvh] md:border md:shadow-hard",
        width,
        "open:flex open:flex-col",
      )}
    >
      {open ? (
        <>
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-ink bg-canvas py-2 pr-1 pl-4">
            <div className="min-w-0 py-2">
              <h2 className="headline-sm truncate">{title}</h2>
              {subtitle ? <div className="body-sm mt-0.5 text-steel">{subtitle}</div> : null}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-5" />
            </IconButton>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
          {footer ? <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-hairline bg-canvas px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer> : null}
        </>
      ) : null}
    </dialog>
  );
}
