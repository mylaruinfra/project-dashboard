"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

export type FilterDef =
  | { kind: "select"; name: string; label: string; options: readonly SelectOption[]; placeholder?: string }
  | { kind: "date"; name: string; label: string };

/** Filters that live in the URL (shareable, back-button friendly). Resets to page 1. */
export function QueryFilters({ filters, className }: { filters: FilterDef[]; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const update = (name: string, value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(name, value);
    else sp.delete(name);
    sp.delete("page");
    start(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6", pending && "opacity-60", className)}>
      {filters.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={`f-${f.name}`}>
          {f.kind === "select" ? (
            <Select id={`f-${f.name}`} value={params.get(f.name) ?? ""} onChange={(e) => update(f.name, e.target.value)} options={f.options} placeholder={f.placeholder ?? "All"} />
          ) : (
            <DateInput id={`f-${f.name}`} value={params.get(f.name) ?? ""} onChange={(e) => update(f.name, e.target.value)} />
          )}
        </Field>
      ))}
    </div>
  );
}
