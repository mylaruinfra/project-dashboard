"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatArea, parseFeet } from "@/lib/area";
import { cn } from "@/lib/cn";
import { SlabLayout } from "./SlabLayout";
import { type BuildingState, buildingArea, type Errors, floorArea, newSlab, slabArea, syncFloors } from "./wizard-state";

interface Props {
  value: BuildingState;
  onChange: (v: BuildingState) => void;
  errors: Errors;
}

export function BuildingFields({ value, onChange, errors }: Props) {
  const [activeKey, setActiveKey] = useState(value.floors.find((f) => !f.isTerrace && f.level === 0)?.key ?? value.floors[0]?.key);
  const active = value.floors.find((f) => f.key === activeKey) ?? value.floors[0];

  const setCounts = (patch: Partial<BuildingState>) => {
    const next = { ...value, ...patch };
    onChange({ ...next, floors: syncFloors(next) });
  };
  const updateFloor = (key: string, fn: (f: BuildingState["floors"][number]) => BuildingState["floors"][number]) => onChange({ ...value, floors: value.floors.map((f) => (f.key === key ? fn(f) : f)) });
  const floorErrors = Object.entries(errors).filter(([k]) => k.startsWith("floors"));

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Floors below ground" htmlFor="bl-below" error={errors.floorsBelow}>
          <NumberInput id="bl-below" integer value={value.floorsBelow} onChange={(e) => setCounts({ floorsBelow: e.target.value })} />
        </Field>
        <Field label="Floors above ground" htmlFor="bl-above" error={errors.floorsAbove} hint="Not counting the ground floor (G+2 → 2)">
          <NumberInput id="bl-above" integer value={value.floorsAbove} onChange={(e) => setCounts({ floorsAbove: e.target.value })} />
        </Field>
        <div className="col-span-2 md:col-span-1 md:pt-5">
          <Checkbox label="Add terrace" hint="Optional" checked={value.hasTerrace} onChange={(e) => setCounts({ hasTerrace: e.target.checked })} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px border border-hairline bg-hairline md:grid-cols-[13rem_1fr]">
        <ul className="flex overflow-x-auto bg-paper md:flex-col">
          {value.floors.map((f) => (
            <li key={f.key} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveKey(f.key)}
                aria-current={f.key === active?.key ? "true" : undefined}
                className={cn("flex min-h-14 w-full flex-col items-start justify-center border-b-[3px] px-3 text-left md:border-b-0 md:border-l-[3px]", f.key === active?.key ? "border-hazard bg-ink text-white" : "border-transparent hover:bg-surface-low")}
              >
                <span className="font-display text-sm font-semibold">{f.name}</span>
                <span className={cn("body-sm", f.key === active?.key ? "text-white/70" : "text-steel")}>
                  {f.isTerrace && !f.slabs.length ? "Optional" : `${f.slabs.length} slab${f.slabs.length === 1 ? "" : "s"} · ${formatArea(floorArea(f))}`}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {active ? (
          <div className="grid grid-cols-1 content-start gap-4 bg-paper p-3 md:p-4">
            <div className="flex items-center justify-between gap-3">
              <Input aria-label="Floor name" value={active.name} onChange={(e) => updateFloor(active.key, (f) => ({ ...f, name: e.target.value }))} className="max-w-xs font-display font-semibold" />
              <Button variant="secondary" size="sm" onClick={() => updateFloor(active.key, (f) => ({ ...f, slabs: [...f.slabs, newSlab(f.slabs.length)] }))}>
                <Plus className="size-4" aria-hidden /> Add slab
              </Button>
            </div>

            <div className="overflow-x-auto border border-hairline">
              <table className="w-full min-w-[30rem] border-collapse">
                <thead>
                  <tr className="border-b border-ink bg-canvas">
                    {["Slab", "Length (ft)", "Width (ft)", "Area (SFT)", ""].map((h) => (
                      <th key={h} className="label-technical h-10 px-2 text-left text-steel">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {active.slabs.map((s, i) => {
                    const a = slabArea(s);
                    const set = (patch: Partial<typeof s>) => updateFloor(active.key, (f) => ({ ...f, slabs: f.slabs.map((x) => (x.key === s.key ? { ...x, ...patch } : x)) }));
                    return (
                      <tr key={s.key}>
                        <td className="p-1.5">
                          <Input aria-label={`Slab ${i + 1} name`} value={s.name} onChange={(e) => set({ name: e.target.value })} />
                        </td>
                        <td className="w-28 p-1.5">
                          <NumberInput aria-label={`Slab ${i + 1} length`} value={s.length} onChange={(e) => set({ length: e.target.value })} />
                        </td>
                        <td className="w-28 p-1.5">
                          <NumberInput aria-label={`Slab ${i + 1} width`} value={s.width} onChange={(e) => set({ width: e.target.value })} />
                        </td>
                        <td className="w-28 bg-surface-low p-1.5 text-right font-display font-semibold tabular">{a !== null ? formatArea(a, "") : "—"}</td>
                        <td className="w-12 p-0.5">
                          <IconButton label={`Remove ${s.name}`} tone="hazard" onClick={() => updateFloor(active.key, (f) => ({ ...f, slabs: f.slabs.filter((x) => x.key !== s.key) }))}>
                            <Trash2 className="size-4" />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                  {!active.slabs.length ? (
                    <tr>
                      <td colSpan={5} className="body-sm p-3 text-steel">
                        No slabs on this floor.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border border-ink bg-ink px-4 py-3 text-white">
              <span className="label-technical">Total ({active.name})</span>
              <span className="label-numeric">{formatArea(floorArea(active))}</span>
            </div>

            <SlabLayout title={`Slab layout · ${active.name}`} slabs={active.slabs.map((s) => ({ key: s.key, name: s.name, length: parseFeet(s.length) ?? 0, width: parseFeet(s.width) ?? 0 }))} />
          </div>
        ) : null}
      </div>

      {floorErrors.length ? (
        <ul className="body-sm text-error">
          {floorErrors.map(([k, m]) => (
            <li key={k}>{m}</li>
          ))}
        </ul>
      ) : null}

      <p className="body-md">
        Total slab area, all floors: <span className="font-display font-bold tabular">{formatArea(buildingArea(value))}</span>
      </p>
    </div>
  );
}
