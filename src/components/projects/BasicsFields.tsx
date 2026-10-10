"use client";

import { DateInput } from "@/components/ui/DateInput";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PROJECT_TYPE_LABEL, PROJECT_TYPES } from "@/lib/domain";
import { ClientQuickAdd } from "./ClientQuickAdd";
import type { BasicsState, Errors } from "./wizard-state";

interface Props {
  value: BasicsState;
  onChange: (v: BasicsState) => void;
  errors: Errors;
  clients: { id: string; name: string }[];
  onClientAdded?: (c: { id: string; name: string }) => void;
  canAddClient: boolean;
}

export function BasicsFields({ value, onChange, errors, clients, onClientAdded, canAddClient }: Props) {
  const set = <K extends keyof BasicsState>(k: K, v: BasicsState[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Project name" htmlFor="b-name" required error={errors.name} className="md:col-span-2">
        <Input id="b-name" value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Villa Project" />
      </Field>
      <Field label="Client" htmlFor="b-client" required error={errors.clientId} className="md:col-span-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <Select id="b-client" value={value.clientId} onChange={(e) => set("clientId", e.target.value)} options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Pick a client" invalid={Boolean(errors.clientId)} />
          {canAddClient ? (
            <ClientQuickAdd
              onCreated={(c) => {
                onClientAdded?.(c);
                onChange({ ...value, clientId: c.id });
              }}
            />
          ) : null}
        </div>
      </Field>
      <Field label="Project type" required error={errors.type} className="md:col-span-2">
        <RadioGroup name="type" value={value.type} onChange={(v) => set("type", v)} options={PROJECT_TYPES.map((t) => ({ value: t, label: PROJECT_TYPE_LABEL[t] }))} />
      </Field>
      <Field label="Start date" htmlFor="b-start" required error={errors.startDate}>
        <DateInput id="b-start" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} invalid={Boolean(errors.startDate)} />
      </Field>
      <Field label="Expected completion" htmlFor="b-end" required error={errors.expectedCompletion}>
        <DateInput id="b-end" value={value.expectedCompletion} onChange={(e) => set("expectedCompletion", e.target.value)} invalid={Boolean(errors.expectedCompletion)} />
      </Field>
      <Field label="Project description" htmlFor="b-desc" error={errors.description} className="md:col-span-2">
        <Textarea id="b-desc" value={value.description} onChange={(e) => set("description", e.target.value)} placeholder="3 floor residential villa with parking and terrace." />
      </Field>
    </div>
  );
}
