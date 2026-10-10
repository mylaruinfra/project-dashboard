"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useApiForm } from "@/components/forms/useApiForm";
import { paiseToInput } from "@/lib/money";

/** Add or change a daily rate. Engineers' attendance is costed at these rates. */
export function LaborRateButton({ rate }: { rate?: { laborType: string; rate: number | null } }) {
  const [open, setOpen] = useState(false);
  const init = { laborType: rate?.laborType ?? "", rate: paiseToInput(rate?.rate) };
  const f = useApiForm(init);
  return (
    <>
      <Button variant={rate ? "secondary" : "primary"} size={rate ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {rate ? "Edit" : "Add labor type"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={rate ? `Daily rate: ${rate.laborType}` : "Add labor type"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                if (await f.submit("/api/settings/labor-rates", { success: "Rate saved" })) setOpen(false);
              }}
            >
              Save rate
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Labor type" htmlFor="lr-type" required error={f.errors.laborType}>
            <Input id="lr-type" value={f.values.laborType} readOnly={Boolean(rate)} onChange={(e) => f.set("laborType")(e.target.value)} placeholder="Mason" />
          </Field>
          <Field label="Daily rate per worker" htmlFor="lr-rate" required error={f.errors.rate} hint="New attendance uses this rate. Past entries keep the rate they were saved with.">
            <MoneyInput id="lr-rate" value={f.values.rate} onChange={(e) => f.set("rate")(e.target.value)} suffix="/ day" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
