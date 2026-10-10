import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";

interface Props extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

export function LinkButton({ variant = "primary", size = "md", full, className, ...rest }: Props) {
  return <Link className={buttonClass(variant, size, cn(full && "w-full", className))} {...rest} />;
}
