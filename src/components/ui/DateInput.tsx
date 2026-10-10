import type { InputHTMLAttributes } from "react";
import { controlClass } from "./Input";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

/** Native date picker (ISO value); dates are displayed elsewhere as DD MMM YYYY. */
export function DateInput({ invalid, className, ...rest }: Props) {
  return <input type="date" className={controlClass(invalid, className)} aria-invalid={invalid || undefined} {...rest} />;
}
