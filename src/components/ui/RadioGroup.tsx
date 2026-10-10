import { cn } from "@/lib/cn";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  name: string;
  value: T | "";
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  invalid?: boolean;
  columns?: 2 | 3 | 4;
}

/** Square radios laid out as a segmented schedule row. */
export function RadioGroup<T extends string>({ name, value, options, onChange, invalid, columns = 3 }: Props<T>) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" }[columns];
  return (
    <div role="radiogroup" className={cn("grid gap-px border bg-hairline", cols, invalid ? "border-error" : "border-hairline")}>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label key={o.value} className={cn("flex min-h-11 cursor-pointer items-center gap-2 px-3 body-md", checked ? "bg-ink text-white" : "bg-paper text-ink hover:bg-surface-low")}>
            <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
            <span aria-hidden className={cn("inline-flex size-4 shrink-0 items-center justify-center border", checked ? "border-white" : "border-ink")}>
              {checked ? <span className="size-2 bg-hazard" /> : null}
            </span>
            <span className="truncate">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
