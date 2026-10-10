"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { useAction, useApiForm } from "@/components/forms/useApiForm";
import { ROLE_LABEL, type Role } from "@/lib/domain";

interface Member {
  id: string;
  name: string;
  role: Role;
  phone: string | null;
}

export function TeamPanel({ projectId, members, engineers, canEdit }: { projectId: string; members: Member[]; engineers: { id: string; name: string }[]; canEdit: boolean }) {
  const f = useApiForm({ userId: "" });
  const act = useAction();
  const [removing, setRemoving] = useState<Member | null>(null);
  const available = engineers.filter((e) => !members.some((m) => m.id === e.id));
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_20rem]">
      <Panel title="Assigned engineers">
        {members.length ? (
          <ul className="divide-y divide-hairline">
            {members.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <span>
                  <span className="block font-display font-semibold">{m.name}</span>
                  <span className="body-sm text-steel">
                    {ROLE_LABEL[m.role]}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </span>
                </span>
                {canEdit ? (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(m)}>
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <EmptyState title="No engineers assigned" body="Engineers only see projects they are assigned to. Admins, managers and viewers see every project." />
          </div>
        )}
      </Panel>
      {canEdit ? (
        <Panel title="Assign an engineer" bodyClassName="grid gap-3 p-4">
          <Field label="Engineer" htmlFor="tm-user" error={f.errors.userId}>
            <Select id="tm-user" value={f.values.userId} onChange={(e) => f.set("userId")(e.target.value)} options={available.map((e) => ({ value: e.id, label: e.name }))} placeholder={available.length ? "Pick an engineer" : "All engineers assigned"} />
          </Field>
          <Button
            disabled={!f.values.userId}
            loading={f.busy}
            onClick={async () => {
              if (await f.submit(`/api/projects/${projectId}/members`, { success: "Engineer assigned" })) f.reset({ userId: "" });
            }}
          >
            Assign
          </Button>
        </Panel>
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove from project"
        message={`${removing?.name ?? ""} will no longer see this project. Their past entries stay.`}
        confirmLabel="Remove"
        onConfirm={async () => {
          const r = await act(`/api/projects/${projectId}/members/${removing!.id}`, undefined, { method: "DELETE", success: "Removed from project" });
          return r !== null;
        }}
      />
    </div>
  );
}
