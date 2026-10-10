"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { VENDOR_TYPE_LABEL, VENDOR_TYPES, type VendorType } from "@/lib/domain";

export interface VendorEditable {
  id: string;
  name: string;
  type: VendorType;
  contactPerson: string | null;
  phone: string | null;
  gstin: string | null;
  address: string | null;
}

export function VendorButton({ vendor }: { vendor?: VendorEditable }) {
  const [open, setOpen] = useState(false);
  const init = { name: vendor?.name ?? "", type: vendor?.type ?? "", contactPerson: vendor?.contactPerson ?? "", phone: vendor?.phone ?? "", gstin: vendor?.gstin ?? "", address: vendor?.address ?? "" };
  const f = useApiForm(init);
  return (
    <>
      <Button variant={vendor ? "secondary" : "primary"} size={vendor ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {vendor ? "Edit" : "Add vendor / contractor"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={vendor ? "Edit vendor / contractor" : "Add vendor / contractor"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = vendor ? await f.submit(`/api/vendors/${vendor.id}`, { method: "PUT", success: "Saved" }) : await f.submit("/api/vendors", { success: "Added" });
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="vd-name" required error={f.errors.name} className="md:col-span-2">
            <Input id="vd-name" value={f.values.name} onChange={(e) => f.set("name")(e.target.value)} />
          </Field>
          <Field label="Type" htmlFor="vd-type" required error={f.errors.type}>
            <Select id="vd-type" value={f.values.type} onChange={(e) => f.set("type")(e.target.value)} options={VENDOR_TYPES.map((t) => ({ value: t, label: VENDOR_TYPE_LABEL[t] }))} placeholder="Pick a type" />
          </Field>
          <Field label="Contact person" htmlFor="vd-contact" error={f.errors.contactPerson}>
            <Input id="vd-contact" value={f.values.contactPerson} onChange={(e) => f.set("contactPerson")(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="vd-phone" error={f.errors.phone}>
            <Input id="vd-phone" type="tel" inputMode="tel" value={f.values.phone} onChange={(e) => f.set("phone")(e.target.value)} />
          </Field>
          <Field label="GSTIN" htmlFor="vd-gstin" error={f.errors.gstin} hint="15 characters, checked automatically">
            <Input id="vd-gstin" value={f.values.gstin} onChange={(e) => f.set("gstin")(e.target.value.toUpperCase())} maxLength={15} />
          </Field>
          <Field label="Address" htmlFor="vd-address" error={f.errors.address} className="md:col-span-2">
            <Textarea id="vd-address" rows={2} value={f.values.address} onChange={(e) => f.set("address")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
