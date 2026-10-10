"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { DOC_KIND_LABEL, type DocKind } from "@/lib/domain";

export function EditDocumentButton({ doc, allowedKinds }: { doc: { id: string; title: string; caption: string | null; kind: DocKind }; allowedKinds: readonly DocKind[] }) {
  const [open, setOpen] = useState(false);
  const init = { title: doc.title, caption: doc.caption ?? "", kind: doc.kind as string };
  const f = useApiForm(init);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { f.reset(init); setOpen(true); }}>
        Edit
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit document"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={f.busy} onClick={async () => { if (await f.submit(`/api/documents/${doc.id}`, { method: "PUT", success: "Saved" })) setOpen(false); }}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="Title" htmlFor="ed-title" required error={f.errors.title}>
            <Input id="ed-title" value={f.values.title} onChange={(e) => f.set("title")(e.target.value)} />
          </Field>
          <Field label="Kind" htmlFor="ed-kind" error={f.errors.kind}>
            <Select id="ed-kind" value={f.values.kind} onChange={(e) => f.set("kind")(e.target.value)} options={allowedKinds.map((k) => ({ value: k, label: DOC_KIND_LABEL[k] }))} />
          </Field>
          <Field label="Caption" htmlFor="ed-caption" error={f.errors.caption}>
            <Textarea id="ed-caption" rows={2} value={f.values.caption} onChange={(e) => f.set("caption")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
