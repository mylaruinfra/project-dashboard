"use client";

import { Camera, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";

interface Props {
  projects: { id: string; name: string }[];
  canBills: boolean;
  aiEnabled: boolean;
}

/** Photo or PDF of a bill / challan → AI draft (or an empty draft when AI is off). */
export function UploadForm({ projects, canBills, aiEnabled }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0]!.id : "");
  const [kind, setKind] = useState<"TRANSACTION" | "DELIVERY">(canBills ? "TRANSACTION" : "DELIVERY");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (!file) return setErrors({ file: "Take a photo or pick a file" });
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("projectId", projectId);
    form.set("kind", kind);
    const r = await api<{ id: string; readError: string | null }>("/api/drafts", { form });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.error.fields ?? {});
      return toast(r.error.message, "error");
    }
    toast(r.data.readError ? "Uploaded. Fill in the details by hand." : "Read. Check the details and confirm.");
    router.push(`/upload/${r.data.id}`);
  };

  return (
    <Panel title="New upload" bodyClassName="grid grid-cols-1 gap-4 p-4">
      <Field label="Project" htmlFor="up-project" required error={errors.projectId}>
        <Select id="up-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="Pick a project" />
      </Field>
      <Field label="What is it?" required>
        <RadioGroup
          name="kind"
          columns={2}
          value={kind}
          onChange={setKind}
          options={[
            ...(canBills ? [{ value: "TRANSACTION" as const, label: "Bill / invoice" }] : []),
            { value: "DELIVERY" as const, label: "Delivery challan" },
          ]}
        />
      </Field>
      <Field label="Photo or PDF" htmlFor="up-file" required error={errors.file} hint="JPG, PNG, WebP or PDF, up to 10 MB">
        <label htmlFor="up-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink bg-canvas p-4 text-center hover:bg-surface-low">
          <Camera className="size-6" aria-hidden />
          <span className="body-md max-w-full break-all font-medium">{file ? file.name : "Take a photo or choose a file"}</span>
          <input id="up-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors({}); }} />
        </label>
      </Field>
      <p className="body-sm text-steel">
        {aiEnabled ? (
          <>
            <Sparkles className="mr-1 inline size-4 text-hazard" aria-hidden />
            AI reads it into a draft with checks. Nothing counts until someone confirms it.
          </>
        ) : (
          "AI reading is off (no API key). You will fill in the details by hand on the next screen."
        )}
      </p>
      <Button onClick={submit} loading={busy} full>
        {aiEnabled ? "Upload and read" : "Upload"}
      </Button>
    </Panel>
  );
}
