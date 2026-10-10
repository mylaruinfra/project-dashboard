"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";

export interface ClientEditable {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
}

export function ClientButton({ client }: { client?: ClientEditable }) {
  const [open, setOpen] = useState(false);
  const init = { name: client?.name ?? "", contactPerson: client?.contactPerson ?? "", phone: client?.phone ?? "", email: client?.email ?? "", gstin: client?.gstin ?? "", address: client?.address ?? "" };
  const f = useApiForm(init);
  return (
    <>
      <Button variant={client ? "secondary" : "primary"} size={client ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {client ? "Edit" : "Add client"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={client ? "Edit client" : "Add client"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = client ? await f.submit(`/api/clients/${client.id}`, { method: "PUT", success: "Saved" }) : await f.submit("/api/clients", { success: "Client added" });
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Client name" htmlFor="cl-name" required error={f.errors.name} className="md:col-span-2">
            <Input id="cl-name" value={f.values.name} onChange={(e) => f.set("name")(e.target.value)} />
          </Field>
          <Field label="Contact person" htmlFor="cl-contact" error={f.errors.contactPerson}>
            <Input id="cl-contact" value={f.values.contactPerson} onChange={(e) => f.set("contactPerson")(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="cl-phone" error={f.errors.phone}>
            <Input id="cl-phone" type="tel" inputMode="tel" value={f.values.phone} onChange={(e) => f.set("phone")(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="cl-email" error={f.errors.email}>
            <Input id="cl-email" type="email" value={f.values.email} onChange={(e) => f.set("email")(e.target.value)} />
          </Field>
          <Field label="GSTIN" htmlFor="cl-gstin" error={f.errors.gstin}>
            <Input id="cl-gstin" value={f.values.gstin} onChange={(e) => f.set("gstin")(e.target.value.toUpperCase())} maxLength={15} />
          </Field>
          <Field label="Address" htmlFor="cl-address" error={f.errors.address} className="md:col-span-2">
            <Textarea id="cl-address" rows={2} value={f.values.address} onChange={(e) => f.set("address")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
