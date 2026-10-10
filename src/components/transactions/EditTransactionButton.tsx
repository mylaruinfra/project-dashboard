"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { paiseToInput } from "@/lib/money";
import { qtyToInput } from "@/lib/qty";
import type { TxnType } from "@/lib/domain";
import { type TxnFormOptions, TxnFormModal, type TxnFormValues } from "./TxnFormModal";

export interface EditableTxn {
  id: string;
  projectId: string;
  type: TxnType;
  date: string;
  item: string;
  spec: string | null;
  materialId: string | null;
  qty: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
  vendorId: string | null;
  phase: string | null;
  slabId: string | null;
  location: string | null;
  laborType: string | null;
  workers: number | null;
  days: number | null;
  billNo: string | null;
  paidNow: boolean;
  paymentMode: string | null;
  purchaseOrderId: string | null;
  notes: string | null;
}

function toValues(t: EditableTxn): TxnFormValues {
  return {
    projectId: t.projectId,
    type: t.type,
    date: t.date,
    item: t.item,
    spec: t.spec ?? "",
    materialId: t.materialId ?? "",
    qty: t.type === "LABOR" ? "" : qtyToInput(t.qty),
    unit: t.unit ?? "",
    rate: paiseToInput(t.rate),
    amount: paiseToInput(t.amount),
    vendorId: t.vendorId ?? "",
    phase: t.phase ?? "",
    slabId: t.slabId ?? "",
    location: t.location ?? "",
    laborType: t.laborType ?? "",
    workers: t.workers === null ? "" : String(t.workers),
    days: t.days === null ? "" : String(t.days / 100),
    billNo: t.billNo ?? "",
    paidNow: t.paidNow,
    paymentMode: t.paymentMode ?? "",
    purchaseOrderId: t.purchaseOrderId ?? "",
    notes: t.notes ?? "",
  };
}

export function EditTransactionButton({ txn, ...options }: { txn: EditableTxn } & TxnFormOptions) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      {open ? <TxnFormModal open onClose={() => setOpen(false)} initial={toValues(txn)} editId={txn.id} {...options} /> : null}
    </>
  );
}
