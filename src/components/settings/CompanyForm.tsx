"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { useApiForm } from "@/components/forms/useApiForm";

export function CompanyForm({ companyName }: { companyName: string }) {
  const f = useApiForm({ companyName });
  return (
    <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto] md:items-end">
      <Field label="Company name" htmlFor="co-name" error={f.errors.companyName}>
        <Input id="co-name" value={f.values.companyName} onChange={(e) => f.set("companyName")(e.target.value)} />
      </Field>
      <Button loading={f.busy} onClick={() => f.submit("/api/settings/company", { method: "PUT", success: "Saved" })}>
        Save
      </Button>
    </div>
  );
}
