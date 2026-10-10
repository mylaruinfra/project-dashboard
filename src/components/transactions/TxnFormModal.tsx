"use client";

import { Coffee, Ellipsis, HandCoins, HardHat, type LucideIcon, Package, Paperclip, Sparkles, Tractor, Truck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useApiForm } from "@/components/forms/useApiForm";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { PAYMENT_MODES, PHASE_LABEL, PHASES, type Role, TXN_AUTO_AMOUNT, TXN_DEFAULT_UNIT, TXN_FIELDS, TXN_TYPE_HINT, TXN_TYPE_LABEL, TXN_TYPES, type TxnField, type TxnType, UNITS, VENDOR_TYPE_LABEL, type VendorType } from "@/lib/domain";
import { parseScaledDecimal } from "@/lib/indian-number";
import { formatINR, mulQtyRate, paiseToInput, parseRupees } from "@/lib/money";
import { parseQty } from "@/lib/qty";
import { laborAmount } from "@/lib/txn-rules";

const ICON: Record<TxnType, LucideIcon> = {
  LABOR: HardHat,
  MATERIAL: Package,
  MACHINERY: Tractor,
  LOGISTICS: Truck,
  SITE_EXPENSE: Coffee,
  CLIENT_PAYMENT: Wallet,
  CONTRACTOR_PAYMENT: HandCoins,
  OTHER: Ellipsis,
};

export interface TxnFormOptions {
  projects: { id: string; name: string }[];
  vendors: { id: string; name: string; type: VendorType }[];
  materials: { id: string; name: string; unit: string }[];
  laborRates: { laborType: string; rate: number | null }[];
  role: Role;
  aiEnabled: boolean;
}

export type TxnFormValues = {
  projectId: string;
  type: TxnType | "";
  date: string;
  item: string;
  spec: string;
  materialId: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
  vendorId: string;
  phase: string;
  slabId: string;
  location: string;
  laborType: string;
  workers: string;
  days: string;
  billNo: string;
  paidNow: boolean;
  paymentMode: string;
  purchaseOrderId: string;
  notes: string;
};

export function emptyTxn(projectId: string, today: string, type: TxnType | "" = ""): TxnFormValues {
  return { projectId, type, date: today, item: "", spec: "", materialId: "", qty: "", unit: type ? (TXN_DEFAULT_UNIT[type] ?? "") : "", rate: "", amount: "", vendorId: "", phase: "", slabId: "", location: "", laborType: "", workers: "", days: "1", billNo: "", paidNow: false, paymentMode: "", purchaseOrderId: "", notes: "" };
}

interface Props extends TxnFormOptions {
  open: boolean;
  onClose: () => void;
  initial: TxnFormValues;
  /** Editing an existing transaction (type is fixed). */
  editId?: string;
}

export function TxnFormModal({ open, onClose, initial, editId, projects, vendors, materials, laborRates, role, aiEnabled }: Props) {
  const router = useRouter();
  const toast = useToast();
  const f = useApiForm<TxnFormValues>(initial);
  const v = f.values;
  // The parent mounts this modal fresh each time it opens, so initial state is always current.
  const [step, setStep] = useState<1 | 2>(initial.type ? 2 : 1);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [opts, setOpts] = useState<{ slabs: { id: string; label: string }[]; purchaseOrders: { id: string; number: string; vendorId: string }[] }>({ slabs: [], purchaseOrders: [] });
  const engineer = role === "ENGINEER";
  const money = !engineer;

  useEffect(() => {
    if (!open || !v.projectId) return;
    let live = true;
    api<typeof opts>(`/api/projects/${v.projectId}/options`).then((r) => {
      if (live && r.ok) setOpts({ slabs: r.data.slabs, purchaseOrders: r.data.purchaseOrders });
    });
    return () => {
      live = false;
    };
  }, [open, v.projectId]);

  const fields = useMemo(() => new Set<TxnField>(v.type ? TXN_FIELDS[v.type] : []), [v.type]);
  const has = (x: TxnField) => fields.has(x);
  const material = materials.find((m) => m.id === v.materialId);

  const autoAmount = useMemo(() => {
    if (!v.type || !TXN_AUTO_AMOUNT[v.type]) return null;
    const rate = parseRupees(v.rate);
    if (v.type === "LABOR") {
      const w = Number.parseInt(v.workers, 10);
      const d = parseScaledDecimal(v.days, 2);
      return rate && w > 0 && d ? laborAmount(w, d, rate) : null;
    }
    const q = parseQty(v.qty);
    return rate && q ? mulQtyRate(q, rate) : null;
  }, [v.type, v.rate, v.qty, v.workers, v.days]);

  const pickType = (t: TxnType) => {
    f.setValues((x) => ({ ...x, type: t, unit: x.unit || (TXN_DEFAULT_UNIT[t] ?? "") }));
    setStep(2);
  };

  const vendorChoices = vendors.filter((x) => {
    if (v.type === "MATERIAL") return x.type === "MATERIAL_VENDOR" || x.type === "OTHER";
    if (v.type === "MACHINERY") return x.type === "MACHINERY" || x.type === "OTHER";
    if (v.type === "LOGISTICS") return x.type === "LOGISTICS" || x.type === "OTHER";
    if (v.type === "LABOR") return x.type === "CIVIL_CONTRACTOR" || x.type === "INTERIOR_CONTRACTOR" || x.type === "OTHER";
    return true;
  });

  const save = async () => {
    const body = { ...v, unit: v.type === "MATERIAL" ? material?.unit : v.unit };
    const res = editId
      ? await f.submit<{ id: string }>(`/api/transactions/${editId}`, { method: "PUT", body, refresh: false })
      : await f.submit<{ id: string }>("/api/transactions", { body, refresh: false });
    if (!res) return;
    const id = editId ?? res.id;
    if (file) {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "BILL");
      form.set("entityType", "transaction");
      form.set("entityId", id);
      const up = await api("/api/documents", { form });
      if (!up.ok) toast(`Saved, but the bill did not upload: ${up.error.message}`, "error");
    }
    toast(editId ? "Transaction updated" : "Transaction saved");
    onClose();
    router.refresh();
  };

  const readWithAi = async () => {
    if (!file) return toast("Pick the bill photo or PDF first.", "error");
    if (!v.projectId) return toast("Pick the project first.", "error");
    setReading(true);
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", v.projectId);
    form.set("kind", "TRANSACTION");
    const r = await api<{ id: string }>("/api/drafts", { form });
    setReading(false);
    if (!r.ok) return toast(r.error.message, "error");
    onClose();
    router.push(`/upload/${r.data.id}`);
  };

  const err = f.errors;
  const title = editId ? "Edit transaction" : "Add transaction";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      subtitle={step === 1 ? "Step 1 of 2 · What happened?" : `Step 2 of 2 · ${v.type ? TXN_TYPE_LABEL[v.type] : ""} details`}
      footer={
        step === 2 ? (
          <>
            {!editId ? (
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button onClick={save} loading={f.busy}>
              {editId ? "Save changes" : "Save transaction"}
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )
      }
    >
      {step === 1 ? (
        <div className="grid grid-cols-1 gap-4">
          {projects.length > 1 || !v.projectId ? (
            <Field label="Project" htmlFor="t-project" required error={err.projectId}>
              <Select id="t-project" value={v.projectId} onChange={(e) => f.set("projectId")(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
            {TXN_TYPES.map((t) => {
              const Icon = ICON[t];
              const disabled = engineer && t !== "LABOR";
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled || !v.projectId}
                  onClick={() => pickType(t)}
                  className={cn("flex min-h-28 flex-col items-center justify-center gap-2 bg-paper p-3 text-center transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-35", v.type === t && "outline-2 -outline-offset-2 outline-hazard")}
                >
                  <span className="flex size-10 items-center justify-center bg-hazard text-white">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-sm font-bold">{TXN_TYPE_LABEL[t]}</span>
                  <span className="body-sm opacity-70">{TXN_TYPE_HINT[t]}</span>
                </button>
              );
            })}
          </div>
          {engineer ? <p className="body-sm text-steel">Engineers record labor attendance here. Deliveries and material use are on the Materials page.</p> : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {!editId && projects.length > 1 ? (
            <Field label="Project" htmlFor="t-project2" required error={err.projectId} className="md:col-span-2">
              <Select id="t-project2" value={v.projectId} onChange={(e) => f.setValues((x) => ({ ...x, projectId: e.target.value, slabId: "", purchaseOrderId: "" }))} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" invalid={Boolean(err.projectId)} />
            </Field>
          ) : null}
          <Field label="Date" htmlFor="t-date" required error={err.date}>
            <DateInput id="t-date" value={v.date} onChange={(e) => f.set("date")(e.target.value)} invalid={Boolean(err.date)} />
          </Field>

          {has("laborType") ? (
            <Field label="Labor type" htmlFor="t-lt" required error={err.laborType}>
              <Select
                id="t-lt"
                value={v.laborType}
                onChange={(e) => {
                  const lt = e.target.value;
                  const r = laborRates.find((x) => x.laborType === lt)?.rate;
                  f.setValues((x) => ({ ...x, laborType: lt, rate: r != null ? paiseToInput(r) : x.rate }));
                }}
                options={laborRates.map((r) => ({ value: r.laborType, label: r.laborType }))}
                placeholder="Pick labor type"
                invalid={Boolean(err.laborType)}
              />
            </Field>
          ) : null}
          {has("workers") ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Workers" htmlFor="t-workers" required error={err.workers}>
                <NumberInput id="t-workers" integer value={v.workers} onChange={(e) => f.set("workers")(e.target.value)} invalid={Boolean(err.workers)} />
              </Field>
              <Field label="Days" htmlFor="t-days" required error={err.days}>
                <NumberInput id="t-days" value={v.days} onChange={(e) => f.set("days")(e.target.value)} invalid={Boolean(err.days)} />
              </Field>
            </div>
          ) : null}

          {has("material") ? (
            <Field label="Material" htmlFor="t-mat" required error={err.materialId}>
              <Select id="t-mat" value={v.materialId} onChange={(e) => f.set("materialId")(e.target.value)} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} placeholder="Pick material" invalid={Boolean(err.materialId)} />
            </Field>
          ) : null}
          {has("item") ? (
            <Field label={v.type === "MACHINERY" ? "Machine" : "Item"} htmlFor="t-item" required error={err.item}>
              <Input id="t-item" value={v.item} onChange={(e) => f.set("item")(e.target.value)} placeholder={v.type === "MACHINERY" ? "JCB excavator" : v.type === "LOGISTICS" ? "Sand transport" : "Worker food"} invalid={Boolean(err.item)} />
            </Field>
          ) : null}
          {has("spec") ? (
            <Field label="Type / specification" htmlFor="t-spec" error={err.spec}>
              <Input id="t-spec" value={v.spec} onChange={(e) => f.set("spec")(e.target.value)} placeholder="OPC 53 grade" />
            </Field>
          ) : null}

          {has("qty") ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" htmlFor="t-qty" required error={err.qty}>
                <NumberInput id="t-qty" value={v.qty} onChange={(e) => f.set("qty")(e.target.value)} invalid={Boolean(err.qty)} />
              </Field>
              <Field label="Unit" htmlFor="t-unit" required={v.type !== "MATERIAL"} error={err.unit}>
                {v.type === "MATERIAL" ? (
                  <Input id="t-unit" value={material?.unit ?? ""} readOnly />
                ) : (
                  <Select id="t-unit" value={v.unit} onChange={(e) => f.set("unit")(e.target.value)} options={UNITS.map((u) => ({ value: u, label: u }))} placeholder="Unit" invalid={Boolean(err.unit)} />
                )}
              </Field>
            </div>
          ) : null}

          {has("rate") && money ? (
            <Field label={v.type === "LABOR" ? "Daily rate per worker" : "Rate"} htmlFor="t-rate" required error={err.rate}>
              <MoneyInput id="t-rate" value={v.rate} onChange={(e) => f.set("rate")(e.target.value)} invalid={Boolean(err.rate)} />
            </Field>
          ) : null}
          {has("amount") && money ? (
            <Field label="Amount" htmlFor="t-amount" required error={err.amount} hint={v.type && TXN_AUTO_AMOUNT[v.type] ? "Worked out from the numbers above" : undefined}>
              {v.type && TXN_AUTO_AMOUNT[v.type] ? (
                <div className="flex h-11 items-center border border-hairline bg-surface-low px-3 font-display font-bold tabular">{autoAmount !== null ? formatINR(autoAmount) : "—"}</div>
              ) : (
                <MoneyInput id="t-amount" value={v.amount} onChange={(e) => f.set("amount")(e.target.value)} invalid={Boolean(err.amount)} />
              )}
            </Field>
          ) : null}
          {engineer && v.type === "LABOR" ? <p className="body-sm text-steel md:col-span-2">The daily rate comes from the company rate card.</p> : null}

          {has("vendor") ? (
            <Field label={v.type === "LABOR" ? "Labor party" : v.type === "CONTRACTOR_PAYMENT" ? "Paid to" : "Vendor"} htmlFor="t-vendor" required={v.type === "MATERIAL" || v.type === "CONTRACTOR_PAYMENT"} error={err.vendorId}>
              <Select id="t-vendor" value={v.vendorId} onChange={(e) => f.set("vendorId")(e.target.value)} options={vendorChoices.map((x) => ({ value: x.id, label: `${x.name} · ${VENDOR_TYPE_LABEL[x.type]}` }))} placeholder={v.type === "MATERIAL" || v.type === "CONTRACTOR_PAYMENT" ? "Pick one" : "None (paid in cash)"} invalid={Boolean(err.vendorId)} />
            </Field>
          ) : null}
          {has("purchaseOrder") && opts.purchaseOrders.length ? (
            <Field label="Purchase order (optional)" htmlFor="t-po" error={err.purchaseOrderId}>
              <Select id="t-po" value={v.purchaseOrderId} onChange={(e) => f.set("purchaseOrderId")(e.target.value)} options={opts.purchaseOrders.filter((p) => !v.vendorId || p.vendorId === v.vendorId).map((p) => ({ value: p.id, label: p.number }))} placeholder="None" />
            </Field>
          ) : null}
          {has("phase") ? (
            <Field label="Phase" htmlFor="t-phase" error={err.phase}>
              <Select id="t-phase" value={v.phase} onChange={(e) => f.set("phase")(e.target.value)} options={PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] }))} placeholder="Not set" />
            </Field>
          ) : null}
          {has("slab") ? (
            <Field label="Slab / location" htmlFor="t-slab" error={err.slabId}>
              <Select id="t-slab" value={v.slabId} onChange={(e) => f.set("slabId")(e.target.value)} options={opts.slabs.map((s) => ({ value: s.id, label: s.label }))} placeholder="Whole site" />
            </Field>
          ) : null}
          {has("billNo") ? (
            <Field label="Bill number" htmlFor="t-bill" error={err.billNo}>
              <Input id="t-bill" value={v.billNo} onChange={(e) => f.set("billNo")(e.target.value)} />
            </Field>
          ) : null}
          {has("paymentMode") ? (
            <Field label="Payment mode" htmlFor="t-mode" error={err.paymentMode}>
              <Select id="t-mode" value={v.paymentMode} onChange={(e) => f.set("paymentMode")(e.target.value)} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} placeholder="Pick one" />
            </Field>
          ) : null}
          {has("paidNow") && v.vendorId ? <Checkbox className="md:col-span-2" label="Paid on the spot" hint="Leave unticked to track it as a pending payment to this vendor" checked={v.paidNow} onChange={(e) => f.set("paidNow")(e.target.checked)} /> : null}

          <Field label="Notes" htmlFor="t-notes" error={err.notes} className="md:col-span-2">
            <Textarea id="t-notes" rows={2} value={v.notes} onChange={(e) => f.set("notes")(e.target.value)} />
          </Field>

          {money ? (
            <div className="grid grid-cols-1 gap-2 border border-dashed border-hairline bg-canvas p-3 md:col-span-2">
              <label className="label-technical flex items-center gap-2 text-steel" htmlFor="t-file">
                <Paperclip className="size-4" aria-hidden /> Attach bill (optional)
              </label>
              <input id="t-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="body-sm file:mr-3 file:min-h-11 file:border file:border-ink file:bg-paper file:px-3 file:font-display file:text-xs file:font-bold file:uppercase" />
              {!editId && v.type && v.type !== "CLIENT_PAYMENT" && v.type !== "CONTRACTOR_PAYMENT" ? (
                aiEnabled ? (
                  <Button variant="secondary" size="sm" onClick={readWithAi} loading={reading} disabled={!file} className="justify-self-start">
                    <Sparkles className="size-4" aria-hidden /> Read bill with AI instead
                  </Button>
                ) : (
                  <p className="body-sm text-steel">AI reading is off (no API key). Type the details above.</p>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
