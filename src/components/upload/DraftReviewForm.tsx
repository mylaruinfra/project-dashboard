"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { NumberInput } from "@/components/ui/NumberInput";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useApiForm } from "@/components/forms/useApiForm";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { PHASE_LABEL, PHASES, TXN_TYPE_LABEL, UNITS } from "@/lib/domain";
import { formatINR, mulQtyRate, paiseToInput, parseRupees } from "@/lib/money";
import { parseQty, qtyToInput } from "@/lib/qty";

type LineType = "MATERIAL" | "MACHINERY" | "LOGISTICS" | "SITE_EXPENSE" | "OTHER";
const LINE_TYPES: LineType[] = ["MATERIAL", "MACHINERY", "LOGISTICS", "SITE_EXPENSE", "OTHER"];
const AUTO: Record<LineType, boolean> = { MATERIAL: true, MACHINERY: true, LOGISTICS: true, SITE_EXPENSE: false, OTHER: false };

interface NormLine {
  description: string;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
}

export interface ReviewDraft {
  id: string;
  kind: "TRANSACTION" | "DELIVERY";
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  extracted: {
    normalized: { vendorName: string | null; vendorGstin: string | null; documentNumber: string | null; date: string | null; vehicleNo: string | null; lines: NormLine[]; subtotal: number | null; tax: number | null; total: number | null };
    suggestions: { vendorId: string | null; lineMaterialIds: (string | null)[] };
  } | null;
}

interface Props {
  draft: ReviewDraft;
  today: string;
  vendors: { id: string; name: string }[];
  materials: { id: string; name: string; unit: string }[];
  slabs: { id: string; label: string }[];
  purchaseOrders: { id: string; number: string; vendorId: string }[];
  canDelete: boolean;
  canReread: boolean;
}

interface TxnLine {
  type: LineType;
  materialId: string;
  item: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
}

/** Pre-filled from what the AI read; the person fixes anything and confirms. */
export function DraftReviewForm({ draft, today, vendors, materials, slabs, purchaseOrders, canDelete, canReread }: Props) {
  const router = useRouter();
  const toast = useToast();
  const n = draft.extracted?.normalized;
  const sug = draft.extracted?.suggestions;
  const [dialog, setDialog] = useState<"reject" | "delete" | null>(null);
  const [rereading, setRereading] = useState(false);

  const txnLines: TxnLine[] = (n?.lines ?? []).map((l, i) => {
    const materialId = sug?.lineMaterialIds[i] ?? "";
    return { type: materialId ? "MATERIAL" : "OTHER", materialId, item: l.description, qty: qtyToInput(l.qty), unit: l.unit ?? "", rate: paiseToInput(l.rate), amount: paiseToInput(l.amount ?? (l.qty !== null && l.rate !== null ? mulQtyRate(l.qty, l.rate) : null)) };
  });
  if (n?.tax) txnLines.push({ type: "OTHER", materialId: "", item: `GST on bill${n.documentNumber ? ` ${n.documentNumber}` : ""}`, qty: "", unit: "", rate: "", amount: paiseToInput(n.tax) });
  if (!txnLines.length) txnLines.push({ type: "OTHER", materialId: "", item: "", qty: "", unit: "", rate: "", amount: "" });

  const f = useApiForm({
    vendorId: sug?.vendorId ?? "",
    date: n?.date ?? today,
    billNo: n?.documentNumber ?? "",
    challanNo: n?.documentNumber ?? "",
    vehicleNo: n?.vehicleNo ?? "",
    phase: "",
    slabId: "",
    purchaseOrderId: "",
    paidNow: false,
    notes: "",
    lines: txnLines,
    deliveryLines: (n?.lines.length ? n.lines : [{ description: "", qty: null, unit: null, rate: null, amount: null }]).map((l, i) => ({ description: l.description, materialId: sug?.lineMaterialIds[i] ?? "", qty: qtyToInput(l.qty) })),
  });
  const v = f.values;
  const pending = draft.status === "PENDING";

  const lineAmount = (l: TxnLine): number | null => {
    if (AUTO[l.type]) {
      const q = parseQty(l.qty);
      const r = parseRupees(l.rate);
      return q && r ? mulQtyRate(q, r) : null;
    }
    return parseRupees(l.amount);
  };
  const total = useMemo(() => v.lines.reduce((a: number, l: TxnLine) => a + (lineAmount(l) ?? 0), 0), [v.lines]);
  const setLine = (i: number, patch: Partial<TxnLine>) => f.set("lines")(v.lines.map((l: TxnLine, j: number) => (j === i ? { ...l, ...patch } : l)));
  const setDLine = (i: number, patch: Partial<{ materialId: string; qty: string }>) => f.set("deliveryLines")(v.deliveryLines.map((l: { description: string; materialId: string; qty: string }, j: number) => (j === i ? { ...l, ...patch } : l)));

  const confirm = async () => {
    const body =
      draft.kind === "TRANSACTION"
        ? { vendorId: v.vendorId, date: v.date, billNo: v.billNo, phase: v.phase, slabId: v.slabId, paidNow: v.paidNow, notes: v.notes, lines: v.lines.map((l: TxnLine) => ({ ...l, unit: l.type === "MATERIAL" ? materials.find((m) => m.id === l.materialId)?.unit : l.unit })) }
        : { vendorId: v.vendorId, date: v.date, challanNo: v.challanNo, vehicleNo: v.vehicleNo, purchaseOrderId: v.purchaseOrderId, notes: v.notes, lines: v.deliveryLines.map((l: { materialId: string; qty: string }) => ({ materialId: l.materialId, qty: l.qty })) };
    const r = await f.submit<{ created: string[]; entityType: string }>(`/api/drafts/${draft.id}/confirm`, { body, success: draft.kind === "TRANSACTION" ? "Confirmed: transactions saved" : "Confirmed: delivery added to stock" });
    if (r) router.push(r.entityType === "transaction" ? `/transactions/${r.created[0]}` : `/materials/deliveries/${r.created[0]}`);
  };

  const fieldErr = (i: number, k: string) => f.errors[`lines.${i}.${k}`];

  return (
    <div className="grid grid-cols-1 gap-5">
      <Panel title={draft.kind === "TRANSACTION" ? "Bill details" : "Delivery details"} bodyClassName="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="Vendor" htmlFor="dr-vendor" required={draft.kind === "TRANSACTION" && v.lines.some((l: TxnLine) => l.type === "MATERIAL")} error={f.errors.vendorId} hint={n?.vendorName ? `Read as “${n.vendorName}”${n.vendorGstin ? ` · ${n.vendorGstin}` : ""}` : undefined}>
          <Select id="dr-vendor" disabled={!pending} value={v.vendorId} onChange={(e) => f.set("vendorId")(e.target.value)} options={vendors.map((x) => ({ value: x.id, label: x.name }))} placeholder="Pick or leave blank" />
        </Field>
        <Field label="Date" htmlFor="dr-date" required error={f.errors.date}>
          <DateInput id="dr-date" disabled={!pending} value={v.date} onChange={(e) => f.set("date")(e.target.value)} />
        </Field>
        {draft.kind === "TRANSACTION" ? (
          <>
            <Field label="Bill number" htmlFor="dr-bill" error={f.errors.billNo}>
              <Input id="dr-bill" disabled={!pending} value={v.billNo} onChange={(e) => f.set("billNo")(e.target.value)} />
            </Field>
            <Field label="Phase" htmlFor="dr-phase" error={f.errors.phase}>
              <Select id="dr-phase" disabled={!pending} value={v.phase} onChange={(e) => f.set("phase")(e.target.value)} options={PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] }))} placeholder="Not set" />
            </Field>
            <Field label="Slab / location" htmlFor="dr-slab" error={f.errors.slabId}>
              <Select id="dr-slab" disabled={!pending} value={v.slabId} onChange={(e) => f.set("slabId")(e.target.value)} options={slabs.map((s) => ({ value: s.id, label: s.label }))} placeholder="Whole site" />
            </Field>
            {v.vendorId ? <Checkbox disabled={!pending} label="Paid on the spot" hint="Leave unticked to track it as pending" checked={v.paidNow} onChange={(e) => f.set("paidNow")(e.target.checked)} /> : null}
          </>
        ) : (
          <>
            <Field label="Challan number" htmlFor="dr-challan" error={f.errors.challanNo}>
              <Input id="dr-challan" disabled={!pending} value={v.challanNo} onChange={(e) => f.set("challanNo")(e.target.value)} />
            </Field>
            <Field label="Vehicle number" htmlFor="dr-vehicle" error={f.errors.vehicleNo}>
              <Input id="dr-vehicle" disabled={!pending} value={v.vehicleNo} onChange={(e) => f.set("vehicleNo")(e.target.value.toUpperCase())} />
            </Field>
            {purchaseOrders.length ? (
              <Field label="Purchase order (optional)" htmlFor="dr-po" error={f.errors.purchaseOrderId}>
                <Select id="dr-po" disabled={!pending} value={v.purchaseOrderId} onChange={(e) => f.set("purchaseOrderId")(e.target.value)} options={purchaseOrders.map((p) => ({ value: p.id, label: p.number }))} placeholder="None" />
              </Field>
            ) : null}
          </>
        )}
      </Panel>

      <Panel
        title="Lines"
        action={
          pending ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (draft.kind === "TRANSACTION" ? f.set("lines")([...v.lines, { type: "OTHER", materialId: "", item: "", qty: "", unit: "", rate: "", amount: "" }]) : f.set("deliveryLines")([...v.deliveryLines, { description: "", materialId: "", qty: "" }]))}
            >
              <Plus className="size-4" aria-hidden /> Add line
            </Button>
          ) : null
        }
        bodyClassName="grid grid-cols-1 gap-px bg-hairline"
      >
        {draft.kind === "TRANSACTION"
          ? v.lines.map((l: TxnLine, i: number) => {
              const amt = lineAmount(l);
              return (
                <div key={i} className="grid grid-cols-2 gap-3 bg-paper p-3 md:grid-cols-6">
                  <Field label={`Line ${i + 1} type`} className="col-span-2 md:col-span-1">
                    <Select aria-label={`Line ${i + 1} type`} disabled={!pending} value={l.type} onChange={(e) => setLine(i, { type: e.target.value as LineType })} options={LINE_TYPES.map((t) => ({ value: t, label: TXN_TYPE_LABEL[t] }))} />
                  </Field>
                  {l.type === "MATERIAL" ? (
                    <Field label="Material" error={fieldErr(i, "materialId")} className="col-span-2" hint={l.item ? `Read as “${l.item}”` : undefined}>
                      <Select aria-label={`Line ${i + 1} material`} disabled={!pending} value={l.materialId} onChange={(e) => setLine(i, { materialId: e.target.value })} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} placeholder="Pick material" invalid={Boolean(fieldErr(i, "materialId"))} />
                    </Field>
                  ) : (
                    <Field label="Item" error={fieldErr(i, "item")} className="col-span-2">
                      <Input aria-label={`Line ${i + 1} item`} disabled={!pending} value={l.item} onChange={(e) => setLine(i, { item: e.target.value })} invalid={Boolean(fieldErr(i, "item"))} />
                    </Field>
                  )}
                  {AUTO[l.type] ? (
                    <>
                      <Field label="Qty" error={fieldErr(i, "qty")}>
                        <NumberInput aria-label={`Line ${i + 1} quantity`} disabled={!pending} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} invalid={Boolean(fieldErr(i, "qty"))} suffix={l.type === "MATERIAL" ? materials.find((m) => m.id === l.materialId)?.unit : undefined} />
                      </Field>
                      {l.type !== "MATERIAL" ? (
                        <Field label="Unit" error={fieldErr(i, "unit")}>
                          <Select aria-label={`Line ${i + 1} unit`} disabled={!pending} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} options={UNITS.map((u) => ({ value: u, label: u }))} placeholder="Unit" />
                        </Field>
                      ) : null}
                      <Field label="Rate" error={fieldErr(i, "rate")}>
                        <MoneyInput aria-label={`Line ${i + 1} rate`} disabled={!pending} value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} invalid={Boolean(fieldErr(i, "rate"))} />
                      </Field>
                    </>
                  ) : (
                    <Field label="Amount" error={fieldErr(i, "amount")} className="md:col-span-2">
                      <MoneyInput aria-label={`Line ${i + 1} amount`} disabled={!pending} value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} invalid={Boolean(fieldErr(i, "amount"))} />
                    </Field>
                  )}
                  <div className="col-span-2 flex items-end justify-between gap-2 md:col-span-6">
                    <span className="body-sm text-steel">
                      Line amount: <b className="font-display text-ink tabular">{amt !== null ? formatINR(amt) : "—"}</b>
                      {AUTO[l.type] && l.amount && amt !== null && parseRupees(l.amount) !== amt ? <span className="ml-2 text-hazard">bill says {formatINR(parseRupees(l.amount) ?? 0)}</span> : null}
                    </span>
                    {pending && v.lines.length > 1 ? (
                      <IconButton label={`Remove line ${i + 1}`} tone="hazard" onClick={() => f.set("lines")(v.lines.filter((_: TxnLine, j: number) => j !== i))}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    ) : null}
                  </div>
                </div>
              );
            })
          : v.deliveryLines.map((l: { description: string; materialId: string; qty: string }, i: number) => (
              <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-end gap-3 bg-paper p-3">
                <Field label={`Line ${i + 1} material`} error={fieldErr(i, "materialId")} hint={l.description ? `Read as “${l.description}”` : undefined}>
                  <Select aria-label={`Line ${i + 1} material`} disabled={!pending} value={l.materialId} onChange={(e) => setDLine(i, { materialId: e.target.value })} options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} placeholder="Pick material" invalid={Boolean(fieldErr(i, "materialId"))} />
                </Field>
                <Field label="Qty" error={fieldErr(i, "qty")}>
                  <NumberInput aria-label={`Line ${i + 1} quantity`} disabled={!pending} value={l.qty} onChange={(e) => setDLine(i, { qty: e.target.value })} invalid={Boolean(fieldErr(i, "qty"))} />
                </Field>
                {pending && v.deliveryLines.length > 1 ? (
                  <IconButton label={`Remove line ${i + 1}`} tone="hazard" onClick={() => f.set("deliveryLines")(v.deliveryLines.filter((_: unknown, j: number) => j !== i))}>
                    <Trash2 className="size-4" />
                  </IconButton>
                ) : (
                  <span />
                )}
              </div>
            ))}
        {draft.kind === "TRANSACTION" ? (
          <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
            <span className="label-technical">Total to confirm</span>
            <span className={cn("label-numeric", n?.total != null && Math.abs(n.total - total) > 100 && "text-hazard")}>
              {formatINR(total)}
              {n?.total != null ? <span className="body-sm ml-2 font-normal text-white/70">bill total {formatINR(n.total)}</span> : null}
            </span>
          </div>
        ) : null}
      </Panel>

      <Field label="Notes" htmlFor="dr-notes">
        <Textarea id="dr-notes" disabled={!pending} rows={2} value={v.notes} onChange={(e) => f.set("notes")(e.target.value)} />
      </Field>

      {pending ? (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-ink bg-canvas px-4 py-3 md:static md:mx-0 md:border md:border-hairline md:bg-paper lg:bottom-0">
          {canDelete ? (
            <Button variant="ghost" onClick={() => setDialog("delete")}>
              Delete draft
            </Button>
          ) : null}
          {canReread ? (
            <Button
              variant="ghost"
              loading={rereading}
              onClick={async () => {
                setRereading(true);
                const r = await api(`/api/drafts/${draft.id}/reread`, { body: {} });
                setRereading(false);
                if (!r.ok) return toast(r.error.message, "error");
                toast("Read again");
                window.location.reload();
              }}
            >
              <RefreshCw className="size-4" aria-hidden /> Read again
            </Button>
          ) : null}
          <Button variant="destructive" onClick={() => setDialog("reject")}>
            Reject
          </Button>
          <Button onClick={confirm} loading={f.busy}>
            Confirm
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Reject this upload"
        message="Nothing is recorded. The file and draft stay for reference."
        confirmLabel="Reject"
        requireReason
        onConfirm={async (reason) => {
          const r = await api(`/api/drafts/${draft.id}/reject`, { body: { reason } });
          if (!r.ok) {
            toast(r.error.message, "error");
            return false;
          }
          toast("Rejected");
          router.push("/upload");
        }}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Delete this draft"
        message="Admin only. The draft is removed; the uploaded file is kept but archived."
        confirmLabel="Delete draft"
        requireReason
        onConfirm={async (reason) => {
          const r = await api(`/api/drafts/${draft.id}`, { method: "DELETE", body: { reason } });
          if (!r.ok) {
            toast(r.error.message, "error");
            return false;
          }
          toast("Draft deleted");
          router.push("/upload");
        }}
      />
    </div>
  );
}
