"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { PROJECT_STATUS_LABEL, PROJECT_STATUSES, type ProjectStatus } from "@/lib/domain";

export function ProjectStatusButton({ projectId, status, canArchive }: { projectId: string; status: ProjectStatus; canArchive: boolean }) {
  const [open, setOpen] = useState(false);
  const f = useApiForm({ status: "" as string, reason: "" });
  const options = PROJECT_STATUSES.filter((s) => s !== status && (canArchive || s !== "ARCHIVED"));
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {status === "ARCHIVED" ? "Restore" : "Change status"}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change project status"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                if (await f.submit(`/api/projects/${projectId}/status`, { success: "Status changed" })) setOpen(false);
              }}
            >
              Change status
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <p className="body-md">Now: {PROJECT_STATUS_LABEL[status]}. Archived projects are read-only and hidden from lists; nothing is deleted.</p>
          <Field label="New status" htmlFor="ps-status" required error={f.errors.status}>
            <Select id="ps-status" value={f.values.status} onChange={(e) => f.set("status")(e.target.value)} options={options.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))} placeholder="Pick a status" />
          </Field>
          <Field label="Reason" htmlFor="ps-reason" required error={f.errors.reason}>
            <Textarea id="ps-reason" rows={2} value={f.values.reason} onChange={(e) => f.set("reason")(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
