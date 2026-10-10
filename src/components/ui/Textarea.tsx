import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClass } from "./Input";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, rows = 3, ...rest }: Props) {
  return <textarea rows={rows} className={controlClass(invalid, cn("h-auto py-2.5", className))} aria-invalid={invalid || undefined} {...rest} />;
}
