"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { useProjectOptions } from "@/components/forms/useProjectOptions";
import { PHASE_LABEL, PHASES } from "@/lib/domain";
import { formatQty, qtyToInput } from "@/lib/qty";

export interface UsageEditable {
  id: string;
  projectId: string;
  materialId: string;
  date: string;
  qty: number;
  phase: string | null;
  slabId: string | null;
  activityId: string | null;
  notes: string | null;
}

interface Props {
  projects: { id: string; name: string }[];
  materials: { id: string; name: string; unit: string }[];
  projectId?: string;
  /** Remaining stock per material for the chosen project (milli-units), for the hint. */
  stock?: Record<string, number>;
  today: string;
  usage?: UsageEditable;
  variant?: "primary" | "secondary";
}

/** Record (or edit) material used on site. The server refuses anything beyond stock. */
export function UsageButton({ projects, materials, projectId, stock, today, usage, variant = "secondary" }: Props) {
  const [open, setOpen] = useState(false);
  const init = {
    projectId: usage?.projectId ?? projectId ?? (projects.length === 1 ? projects[0]!.id : ""),
    materialId: usage?.materialId ?? "",
    date: usage?.date ?? today,
    qty: usage ? qtyToInput(usage.qty) : "",
    phase: usage?.phase ?? "",
    slabId: usage?.slabId ?? "",
    activityId: usage?.activityId ?? "",
    notes: usage?.notes ?? "",
  };
  const f = useApiForm(init);
  const opts = useProjectOptions(f.values.projectId, open);
  const mat = materials.find((m) => m.id === f.values.materialId);
  const left = stock && f.values.materialId ? stock[f.values.materialId] : undefined;
  const choices = stock && !usage ? materials.filter((m) => (stock[m.id] ?? 0) > 0) : materials;

  return (
    <>
      <Button variant={usage ? "secondary" : variant} size={usage ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {usage ? "Edit" : "Record use"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={usage ? "Edit material use" : "Record material use"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = usage ? await f.submit(`/api/usages/${usage.id}`, { method: "PUT", success: "Saved" }) : await f.submit("/api/usages", { success: "Use recorded" });
                if (ok) setOpen(false);
              }}
            >
              {usage ? "Save changes" : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!usage && !projectId ? (
            <Field label="Project" htmlFor="us-project" required error={f.errors.projectId} className="md:col-span-2">
              <Select id="us-project" value={f.values.projectId} onChange={(e) => f.set("projectId")(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" />
            </Field>
          ) : null}
          <Field label="Material" htmlFor="us-mat" required error={f.errors.materialId}>
            <Select id="us-mat" disabled={Boolean(usage)} value={f.values.materialId} onChange={(e) => f.set("materialId")(e.target.value)} options={choices.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} placeholder={choices.length ? "Pick material" : "Nothing in stock"} />
          </Field>
          <Field label="Quantity used" htmlFor="us-qty" required error={f.errors.qty} hint={left !== undefined && !usage ? `In stock: ${formatQty(left)} ${mat?.unit ?? ""}` : undefined}>
            <NumberInput id="us-qty" value={f.values.qty} onChange={(e) => f.set("qty")(e.target.value)} suffix={mat?.unit} invalid={Boolean(f.errors.qty)} />
          </Field>
          <Field label="Date" htmlFor="us-date" required error={f.errors.date}>
            <DateInput id="us-date" value={f.values.date} onChange={(e) => f.set("date")(e.target.value)} />
          </Field>
          <Field label="Phase" htmlFor="us-phase" error={f.errors.phase}>
            <Select id="us-phase" value={f.values.phase} onChange={(e) => f.set("phase")(e.target.value)} options={PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] }))} placeholder="Not set" />
          </Field>
          <Field label="Slab" htmlFor="us-slab" error={f.errors.slabId}>
            <Select id="us-slab" value={f.values.slabId} onChange={(e) => f.set("slabId")(e.target.value)} options={opts.slabs.map((s) => ({ value: s.id, label: s.label }))} placeholder="Whole site" />
          </Field>
          <Field label="Activity" htmlFor="us-act" error={f.errors.activityId}>
            <Select id="us-act" value={f.values.activityId} onChange={(e) => f.set("activityId")(e.target.value)} options={opts.activities.map((a) => ({ value: a.id, label: a.label }))} placeholder="Not linked" />
          </Field>
          <Field label="Notes" htmlFor="us-notes" error={f.errors.notes} className="md:col-span-2">
            <Textarea id="us-notes" rows={2} value={f.values.notes} onChange={(e) => f.set("notes")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
