"use client";

import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatArea } from "@/lib/area";
import { PHASE_LABEL, PHASES } from "@/lib/domain";
import { formatINR, formatINRCompact } from "@/lib/money";
import { type BuildingState, buildingArea, type Errors, type EstimateState, estimateFor, floorArea } from "./wizard-state";

interface Props {
  value: EstimateState;
  onChange: (v: EstimateState) => void;
  errors: Errors;
  building: BuildingState;
}

export function EstimateFields({ value, onChange, errors, building }: Props) {
  const area = buildingArea(building);
  const est = estimateFor(building, value);
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="border border-hairline bg-paper">
        <div className="border-b border-ink bg-canvas px-4 py-3">
          <p className="label-technical text-steel">Total slab area (auto)</p>
          <p className="headline-md tabular">{formatArea(area)}</p>
        </div>
        <dl className="divide-y divide-hairline">
          {building.floors.map((f) => (
            <div key={f.key} className="flex min-h-10 items-center justify-between px-4 body-md">
              <dt className="text-steel">{f.name}</dt>
              <dd className="font-display tabular">{formatArea(floorArea(f))}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-1 content-start gap-4">
        <Field label="Cost per square foot" htmlFor="e-rate" required error={errors.costPerSft}>
          <MoneyInput id="e-rate" value={value.costPerSft} onChange={(e) => onChange({ ...value, costPerSft: e.target.value })} suffix="/ SFT" invalid={Boolean(errors.costPerSft)} />
        </Field>
        <div className="border border-ink bg-ink p-4 text-white">
          <p className="label-technical text-hazard">Estimated project cost</p>
          <p className="headline-lg mt-1 tabular">{est !== null ? formatINR(est) : "—"}</p>
          <p className="body-sm mt-1 text-white/70">
            {formatArea(area)} × {value.costPerSft ? `₹${value.costPerSft}` : "cost per SFT"}
            {est !== null ? ` · ${formatINRCompact(est)}` : ""}
          </p>
        </div>
        <Field label="Contract value (optional)" htmlFor="e-contract" error={errors.contractValue} hint="If blank, client balance uses the estimate.">
          <MoneyInput id="e-contract" value={value.contractValue} onChange={(e) => onChange({ ...value, contractValue: e.target.value })} />
        </Field>
      </div>

      <fieldset className="grid grid-cols-1 gap-3 md:col-span-2">
        <legend className="label-technical mb-2 text-ink">Phase budgets (optional)</legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PHASES.map((p) => (
            <Field key={p} label={PHASE_LABEL[p]} htmlFor={`e-${p}`} error={errors[`phaseBudgets.${p}`]}>
              <MoneyInput id={`e-${p}`} value={value.phaseBudgets[p]} onChange={(e) => onChange({ ...value, phaseBudgets: { ...value.phaseBudgets, [p]: e.target.value } })} />
            </Field>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
