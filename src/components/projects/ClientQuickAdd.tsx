"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useApiForm } from "@/components/forms/useApiForm";

/** "Add new client" inline from the wizard. */
export function ClientQuickAdd({ onCreated }: { onCreated: (c: { id: string; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const f = useApiForm({ name: "", contactPerson: "", phone: "" });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="label-technical min-h-11 text-hazard hover:text-ink">
        + Add new client
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add new client"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const c = await f.submit<{ id: string; name: string }>("/api/clients", { success: "Client added", refresh: false });
                if (c) {
                  onCreated(c);
                  f.reset({ name: "", contactPerson: "", phone: "" });
                  setOpen(false);
                }
              }}
            >
              Add client
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Client name" htmlFor="qc-name" required error={f.errors.name}>
            <Input id="qc-name" value={f.values.name} onChange={(e) => f.set("name")(e.target.value)} autoFocus />
          </Field>
          <Field label="Contact person" htmlFor="qc-contact" error={f.errors.contactPerson}>
            <Input id="qc-contact" value={f.values.contactPerson} onChange={(e) => f.set("contactPerson")(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="qc-phone" error={f.errors.phone}>
            <Input id="qc-phone" type="tel" inputMode="tel" value={f.values.phone} onChange={(e) => f.set("phone")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
