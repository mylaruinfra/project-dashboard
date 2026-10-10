"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { useProjectOptions } from "@/components/forms/useProjectOptions";
import { qtyToInput } from "@/lib/qty";

export interface ReceiptEditable {
  id: string;
  projectId: string;
  materialId: string;
  vendorId: string | null;
  purchaseOrderId: string | null;
  date: string;
  qty: number;
  challanNo: string | null;
  vehicleNo: string | null;
  notes: string | null;
}

interface Props {
  projects: { id: string; name: string }[];
  materials: { id: string; name: string; unit: string }[];
  vendors: { id: string; name: string }[];
  projectId?: string;
  today: string;
  receipt?: ReceiptEditable;
  label?: string;
  variant?: "primary" | "secondary";
}

/** Record (or edit) a delivery: material received on site. Engineers can do this. */
export function ReceiptButton({ projects, materials, vendors, projectId, today, receipt, label, variant = "primary" }: Props) {
  const [open, setOpen] = useState(false);
  const init = {
    projectId: receipt?.projectId ?? projectId ?? (projects.length === 1 ? projects[0]!.id : ""),
    materialId: receipt?.materialId ?? "",
    vendorId: receipt?.vendorId ?? "",
    purchaseOrderId: receipt?.purchaseOrderId ?? "",
    date: receipt?.date ?? today,
    qty: receipt ? qtyToInput(receipt.qty) : "",
    challanNo: receipt?.challanNo ?? "",
    vehicleNo: receipt?.vehicleNo ?? "",
    notes: receipt?.notes ?? "",
  };
  const f = useApiForm(init);
  const opts = useProjectOptions(f.values.projectId, open);
  const unit = materials.find((m) => m.id === f.values.materialId)?.unit;

  return (
    <>
      <Button variant={receipt ? "secondary" : variant} size={receipt ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {label ?? (receipt ? "Edit" : "Record delivery")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={receipt ? "Edit delivery" : "Record delivery"}
        subtitle="Material received on site"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = receipt ? await f.submit(`/api/receipts/${receipt.id}`, { method: "PUT", success: "Delivery updated" }) : await f.submit("/api/receipts", { success: "Delivery recorded" });
                if (ok) setOpen(false);
              }}
            >
              {receipt ? "Save changes" : "Save delivery"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!receipt && !projectId ? (
            <Field label="Project" htmlFor="rc-project" required error={f.errors.projectId} className="md:col-span-2">
              <Select id="rc-project" value={f.values.projectId} onChange={(e) => f.set("projectId")(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" />
            </Field>
          ) : null}
          <Field label="Material" htmlFor="rc-mat" required error={f.errors.materialId}>
            <Select id="rc-mat" disabled={Boolean(receipt)} value={f.values.materialId} onChange={(e) => f.set("materialId")(e.target.value)} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} placeholder="Pick material" />
          </Field>
          <Field label="Quantity received" htmlFor="rc-qty" required error={f.errors.qty}>
            <NumberInput id="rc-qty" value={f.values.qty} onChange={(e) => f.set("qty")(e.target.value)} suffix={unit} invalid={Boolean(f.errors.qty)} />
          </Field>
          <Field label="Date" htmlFor="rc-date" required error={f.errors.date}>
            <DateInput id="rc-date" value={f.values.date} onChange={(e) => f.set("date")(e.target.value)} />
          </Field>
          <Field label="Vendor" htmlFor="rc-vendor" error={f.errors.vendorId}>
            <Select id="rc-vendor" value={f.values.vendorId} onChange={(e) => f.set("vendorId")(e.target.value)} options={vendors.map((v) => ({ value: v.id, label: v.name }))} placeholder="Not known" />
          </Field>
          <Field label="Challan number" htmlFor="rc-challan" error={f.errors.challanNo}>
            <Input id="rc-challan" value={f.values.challanNo} onChange={(e) => f.set("challanNo")(e.target.value)} />
          </Field>
          <Field label="Vehicle number" htmlFor="rc-vehicle" error={f.errors.vehicleNo}>
            <Input id="rc-vehicle" value={f.values.vehicleNo} onChange={(e) => f.set("vehicleNo")(e.target.value.toUpperCase())} placeholder="TS09AB1234" />
          </Field>
          {opts.purchaseOrders.length ? (
            <Field label="Purchase order (optional)" htmlFor="rc-po" error={f.errors.purchaseOrderId}>
              <Select id="rc-po" value={f.values.purchaseOrderId} onChange={(e) => f.set("purchaseOrderId")(e.target.value)} options={opts.purchaseOrders.map((p) => ({ value: p.id, label: p.number }))} placeholder="None" />
            </Field>
          ) : null}
          <Field label="Notes" htmlFor="rc-notes" error={f.errors.notes} className="md:col-span-2">
            <Textarea id="rc-notes" rows={2} value={f.values.notes} onChange={(e) => f.set("notes")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
