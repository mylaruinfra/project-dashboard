"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { formatINR, mulQtyRate, paiseToInput, parseRupees } from "@/lib/money";
import { parseQty, qtyToInput } from "@/lib/qty";

interface Line {
  materialId: string;
  qty: string;
  rate: string;
}

export interface PoEditable {
  id: string;
  projectId: string;
  vendorId: string;
  number: string;
  date: string;
  notes: string | null;
  lines: { materialId: string; qty: number; rate: number }[];
}

interface Props {
  projects: { id: string; name: string }[];
  materials: { id: string; name: string; unit: string }[];
  vendors: { id: string; name: string }[];
  projectId?: string;
  today: string;
  po?: PoEditable;
}

export function PurchaseOrderButton({ projects, materials, vendors, projectId, today, po }: Props) {
  const [open, setOpen] = useState(false);
  const init = {
    projectId: po?.projectId ?? projectId ?? "",
    vendorId: po?.vendorId ?? "",
    number: po?.number ?? "",
    date: po?.date ?? today,
    notes: po?.notes ?? "",
    lines: (po?.lines.map((l) => ({ materialId: l.materialId, qty: qtyToInput(l.qty), rate: paiseToInput(l.rate) })) ?? [{ materialId: "", qty: "", rate: "" }]) as Line[],
  };
  const f = useApiForm(init);
  const setLine = (i: number, patch: Partial<Line>) => f.set("lines")(f.values.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = f.values.lines.reduce((a, l) => {
    const q = parseQty(l.qty);
    const r = parseRupees(l.rate);
    return a + (q && r ? mulQtyRate(q, r) : 0);
  }, 0);

  return (
    <>
      <Button variant={po ? "secondary" : "primary"} size={po ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {po ? "Edit" : "New purchase order"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={po ? `Edit ${po.number}` : "New purchase order"}
        subtitle="Optional: deliveries and bills can be linked to it"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = po ? await f.submit(`/api/purchase-orders/${po.id}`, { method: "PUT", success: "Purchase order saved" }) : await f.submit("/api/purchase-orders", { success: "Purchase order created" });
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!po && !projectId ? (
            <Field label="Project" htmlFor="po-project" required error={f.errors.projectId}>
              <Select id="po-project" value={f.values.projectId} onChange={(e) => f.set("projectId")(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" />
            </Field>
          ) : null}
          <Field label="Vendor" htmlFor="po-vendor" required error={f.errors.vendorId}>
            <Select id="po-vendor" value={f.values.vendorId} onChange={(e) => f.set("vendorId")(e.target.value)} options={vendors.map((v) => ({ value: v.id, label: v.name }))} placeholder="Pick a vendor" />
          </Field>
          <Field label="PO number" htmlFor="po-number" error={f.errors.number} hint={po ? undefined : "Leave blank to number it automatically"}>
            <Input id="po-number" value={f.values.number} onChange={(e) => f.set("number")(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="po-date" required error={f.errors.date}>
            <DateInput id="po-date" value={f.values.date} onChange={(e) => f.set("date")(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-2 md:col-span-2">
            <p className="label-technical text-steel">Lines</p>
            {f.values.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 border border-hairline p-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                <Select aria-label={`Line ${i + 1} material`} value={l.materialId} onChange={(e) => setLine(i, { materialId: e.target.value })} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} placeholder="Material" invalid={Boolean(f.errors[`lines.${i}.materialId`])} className="col-span-2 md:col-span-1" />
                <NumberInput aria-label={`Line ${i + 1} quantity`} placeholder="Qty" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} invalid={Boolean(f.errors[`lines.${i}.qty`])} />
                <MoneyInput aria-label={`Line ${i + 1} rate`} placeholder="Rate" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} invalid={Boolean(f.errors[`lines.${i}.rate`])} />
                <IconButton label={`Remove line ${i + 1}`} tone="hazard" disabled={f.values.lines.length === 1} onClick={() => f.set("lines")(f.values.lines.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            ))}
            {f.errors.lines ? <p className="body-sm text-error">{f.errors.lines}</p> : null}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => f.set("lines")([...f.values.lines, { materialId: "", qty: "", rate: "" }])}>
                <Plus className="size-4" aria-hidden /> Add line
              </Button>
              <span className="font-display font-bold tabular">Total {formatINR(total)}</span>
            </div>
          </div>
          <Field label="Notes" htmlFor="po-notes" error={f.errors.notes} className="md:col-span-2">
            <Textarea id="po-notes" rows={2} value={f.values.notes} onChange={(e) => f.set("notes")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
