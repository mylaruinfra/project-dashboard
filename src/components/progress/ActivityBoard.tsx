"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VoidButton } from "@/components/common/VoidButton";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { NumberInput } from "@/components/ui/NumberInput";
import { Panel } from "@/components/ui/Panel";
import { ProgressRule } from "@/components/ui/ProgressRule";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useApiForm } from "@/components/forms/useApiForm";
import { formatDateShort } from "@/lib/dates";
import { ACTIVITY_STATUS_LABEL, type Phase, PHASE_LABEL, PHASES } from "@/lib/domain";

export interface ActivityRow {
  id: string;
  phase: Phase;
  name: string;
  slabId: string | null;
  slabName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  progress: number;
  status: keyof typeof ACTIVITY_STATUS_LABEL;
}

interface Props {
  projectId: string;
  phases: Record<Phase, ActivityRow[]>;
  progress: Record<Phase, number>;
  slabs: { id: string; label: string }[];
  canWrite: boolean;
  canArchive: boolean;
  today: string;
}

const STATUS_TONE = { NOT_STARTED: "muted", IN_PROGRESS: "hazard", COMPLETED: "indigo", ARCHIVED: "muted" } as const;

export function ActivityBoard({ projectId, phases, progress, slabs, canWrite, canArchive, today }: Props) {
  const [form, setForm] = useState<{ mode: "add" | "edit"; activity?: ActivityRow; phase?: Phase } | null>(null);
  const [updating, setUpdating] = useState<ActivityRow | null>(null);

  return (
    <div className="grid grid-cols-1 gap-5">
      {PHASES.map((ph) => (
        <Panel
          key={ph}
          title={
            <span className="flex items-center gap-3">
              {PHASE_LABEL[ph]} <span className="font-display text-xs tabular text-steel">{progress[ph]}%</span>
            </span>
          }
          action={
            canWrite ? (
              <Button variant="ghost" size="sm" onClick={() => setForm({ mode: "add", phase: ph })}>
                <Plus className="size-4" aria-hidden /> Add activity
              </Button>
            ) : null
          }
        >
          <div className="border-b border-hairline px-4 py-3">
            <ProgressRule value={progress[ph]} label={`${PHASE_LABEL[ph]} progress`} />
          </div>
          {phases[ph].length ? (
            <ul className="divide-y divide-hairline">
              {phases[ph].map((a) => (
                <li key={a.id} className="grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[1fr_14rem_auto] md:items-center">
                  <div className="min-w-0">
                    <Link href={`/progress/activities/${a.id}`} className="inline-flex min-h-11 items-center font-display font-semibold hover:text-hazard">
                      {a.name}
                    </Link>
                    <p className="body-sm text-steel">
                      {[a.slabName, a.plannedStart || a.plannedEnd ? `${formatDateShort(a.plannedStart)} → ${formatDateShort(a.plannedEnd)}` : null].filter(Boolean).join(" · ") || "No slab or dates"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressRule value={a.progress} className="flex-1" label={`${a.name} progress`} />
                    <Chip tone={STATUS_TONE[a.status]}>{ACTIVITY_STATUS_LABEL[a.status]}</Chip>
                  </div>
                  {canWrite ? (
                    <div className="flex flex-wrap gap-1 md:justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setUpdating(a)}>
                        Update
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setForm({ mode: "edit", activity: a })}>
                        Edit
                      </Button>
                      {canArchive ? <VoidButton endpoint={`/api/activities/${a.id}/archive`} extra={{ archived: true }} label="Archive" title="Archive activity" message="It stops counting towards phase progress. Its history is kept." success="Activity archived" variant="ghost" /> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-sm p-4 text-steel">No activities in this phase yet.</p>
          )}
        </Panel>
      ))}
      {!canWrite && PHASES.every((p) => !phases[p].length) ? <EmptyState title="No activities yet" /> : null}

      {form ? <ActivityForm key={form.activity?.id ?? form.phase} projectId={projectId} mode={form.mode} activity={form.activity} phase={form.phase} slabs={slabs} onClose={() => setForm(null)} /> : null}
      {updating ? <ProgressForm key={updating.id} activity={updating} today={today} onClose={() => setUpdating(null)} /> : null}
    </div>
  );
}

function ActivityForm({ projectId, mode, activity, phase, slabs, onClose }: { projectId: string; mode: "add" | "edit"; activity?: ActivityRow; phase?: Phase; slabs: { id: string; label: string }[]; onClose: () => void }) {
  const f = useApiForm({
    projectId,
    phase: activity?.phase ?? phase ?? "CIVIL",
    name: activity?.name ?? "",
    slabId: activity?.slabId ?? "",
    plannedStart: activity?.plannedStart ?? "",
    plannedEnd: activity?.plannedEnd ?? "",
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "add" ? "Add activity" : "Edit activity"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={f.busy}
            onClick={async () => {
              const ok = mode === "add" ? await f.submit("/api/activities", { success: "Activity added" }) : await f.submit(`/api/activities/${activity!.id}`, { method: "PUT", success: "Activity saved" });
              if (ok) onClose();
            }}
          >
            {mode === "add" ? "Add activity" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Phase" htmlFor="ac-phase" required error={f.errors.phase}>
          <Select id="ac-phase" value={f.values.phase} onChange={(e) => f.set("phase")(e.target.value as Phase)} options={PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] }))} />
        </Field>
        <Field label="Activity" htmlFor="ac-name" required error={f.errors.name}>
          <Input id="ac-name" value={f.values.name} onChange={(e) => f.set("name")(e.target.value)} placeholder="Ground floor slab casting" />
        </Field>
        <Field label="Slab (optional)" htmlFor="ac-slab" error={f.errors.slabId} className="md:col-span-2">
          <Select id="ac-slab" value={f.values.slabId} onChange={(e) => f.set("slabId")(e.target.value)} options={slabs.map((s) => ({ value: s.id, label: s.label }))} placeholder="Whole site" />
        </Field>
        <Field label="Planned start" htmlFor="ac-start" error={f.errors.plannedStart}>
          <DateInput id="ac-start" value={f.values.plannedStart} onChange={(e) => f.set("plannedStart")(e.target.value)} />
        </Field>
        <Field label="Planned end" htmlFor="ac-end" error={f.errors.plannedEnd}>
          <DateInput id="ac-end" value={f.values.plannedEnd} onChange={(e) => f.set("plannedEnd")(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ProgressForm({ activity, today, onClose }: { activity: ActivityRow; today: string; onClose: () => void }) {
  const f = useApiForm({ progress: String(activity.progress), date: today, note: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title="Update progress"
      subtitle={activity.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={f.busy}
            onClick={async () => {
              if (await f.submit(`/api/activities/${activity.id}/progress`, { success: "Progress saved" })) onClose();
            }}
          >
            Save progress
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="Progress (%)" htmlFor="pg-val" required error={f.errors.progress}>
          <NumberInput id="pg-val" integer value={f.values.progress} onChange={(e) => f.set("progress")(e.target.value)} suffix="%" />
        </Field>
        <div className="grid grid-cols-5 gap-px border border-hairline bg-hairline">
          {[0, 25, 50, 75, 100].map((n) => (
            <button key={n} type="button" onClick={() => f.set("progress")(String(n))} className={`min-h-11 font-display text-sm font-bold ${f.values.progress === String(n) ? "bg-ink text-white" : "bg-paper hover:bg-surface-low"}`}>
              {n}%
            </button>
          ))}
        </div>
        <Field label="Date" htmlFor="pg-date" required error={f.errors.date}>
          <DateInput id="pg-date" value={f.values.date} onChange={(e) => f.set("date")(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="pg-note" error={f.errors.note}>
          <Textarea id="pg-note" rows={2} value={f.values.note} onChange={(e) => f.set("note")(e.target.value)} placeholder="What was done today" />
        </Field>
      </div>
    </Modal>
  );
}
