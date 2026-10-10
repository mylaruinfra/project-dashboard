"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useApiForm } from "@/components/forms/useApiForm";
import { UNITS } from "@/lib/domain";

export function MaterialButton({ material }: { material?: { id: string; name: string; unit: string; category: string | null } }) {
  const [open, setOpen] = useState(false);
  const init = { name: material?.name ?? "", unit: material?.unit ?? "", category: material?.category ?? "" };
  const f = useApiForm(init);
  return (
    <>
      <Button variant={material ? "secondary" : "primary"} size={material ? "sm" : "md"} onClick={() => { f.reset(init); setOpen(true); }}>
        {material ? "Edit" : "Add material"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={material ? "Edit material" : "Add material"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const ok = material ? await f.submit(`/api/materials/${material.id}`, { method: "PUT", success: "Saved" }) : await f.submit("/api/materials", { success: "Material added" });
                if (ok) setOpen(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Name" htmlFor="mt-name" required error={f.errors.name}>
            <Input id="mt-name" value={f.values.name} onChange={(e) => f.set("name")(e.target.value)} placeholder="Cement OPC 53" />
          </Field>
          <Field label="Unit" htmlFor="mt-unit" required error={f.errors.unit}>
            <Select id="mt-unit" value={f.values.unit} onChange={(e) => f.set("unit")(e.target.value)} options={UNITS.map((u) => ({ value: u, label: u }))} placeholder="Pick unit" />
          </Field>
          <Field label="Category" htmlFor="mt-cat" error={f.errors.category}>
            <Input id="mt-cat" value={f.values.category} onChange={(e) => f.set("category")(e.target.value)} placeholder="Binding, steel, aggregate…" />
          </Field>
        </div>
      </Modal>
    </>
  );
}
