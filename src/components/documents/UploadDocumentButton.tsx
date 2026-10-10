"use client";

import { Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { DOC_KIND_LABEL, DOC_KINDS, type DocKind } from "@/lib/domain";

interface Props {
  projects?: { id: string; name: string }[];
  projectId?: string;
  entityType?: string;
  entityId?: string;
  kind?: DocKind;
  /** Kinds this person may upload (engineers cannot upload bills). */
  allowedKinds?: readonly DocKind[];
  label?: string;
  variant?: "primary" | "secondary";
}

export function UploadDocumentButton({ projects = [], projectId, entityType, entityId, kind, allowedKinds = DOC_KINDS, label = "Upload document", variant = "primary" }: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const init = { projectId: projectId ?? "", kind: kind ?? (allowedKinds[0] as string), title: "", caption: "" };
  const f = useApiForm(init);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden /> {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              disabled={!file}
              onClick={async () => {
                const form = new FormData();
                form.set("file", file!);
                for (const [k, v] of Object.entries(f.values)) if (v) form.set(k, String(v));
                if (entityType) form.set("entityType", entityType);
                if (entityId) form.set("entityId", entityId);
                if (await f.submit("/api/documents", { form, success: "Uploaded" })) {
                  setOpen(false);
                  setFile(null);
                  f.reset(init);
                }
              }}
            >
              Upload
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Field label="File" htmlFor="ud-file" required error={f.errors.file} hint="JPG, PNG, WebP or PDF, up to 10 MB">
            <input id="ud-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="body-sm file:mr-3 file:min-h-11 file:border file:border-ink file:bg-paper file:px-3 file:font-display file:text-xs file:font-bold file:uppercase" />
          </Field>
          {!projectId && !entityId ? (
            <Field label="Project" htmlFor="ud-project" required error={f.errors.projectId}>
              <Select id="ud-project" value={f.values.projectId} onChange={(e) => f.set("projectId")(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" />
            </Field>
          ) : null}
          {!kind ? (
            <Field label="Kind" htmlFor="ud-kind" required error={f.errors.kind}>
              <Select id="ud-kind" value={f.values.kind} onChange={(e) => f.set("kind")(e.target.value)} options={allowedKinds.map((k) => ({ value: k, label: DOC_KIND_LABEL[k] }))} />
            </Field>
          ) : null}
          <Field label="Title" htmlFor="ud-title" error={f.errors.title} hint="Leave blank to use the file name">
            <Input id="ud-title" value={f.values.title} onChange={(e) => f.set("title")(e.target.value)} />
          </Field>
          <Field label="Caption" htmlFor="ud-caption" error={f.errors.caption}>
            <Textarea id="ud-caption" rows={2} value={f.values.caption} onChange={(e) => f.set("caption")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
