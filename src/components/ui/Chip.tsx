import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChipTone = "hazard" | "indigo" | "muted" | "ink" | "error";

const TONE: Record<ChipTone, string> = {
  hazard: "text-hazard border-hazard bg-paper",
  indigo: "text-indigo border-indigo bg-paper",
  muted: "text-steel border-hairline bg-canvas",
  ink: "text-white border-ink bg-ink",
  error: "text-on-error-tint border-error bg-error-tint",
};

/** Rectangular status badge (no pills). */
export function Chip({ tone = "muted", children, className }: { tone?: ChipTone; children: ReactNode; className?: string }) {
  return <span className={cn("label-code inline-flex h-6 shrink-0 items-center border px-2 whitespace-nowrap", TONE[tone], className)}>{children}</span>;
}
