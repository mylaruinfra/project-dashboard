"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./Field";
import { Modal } from "./Modal";
import { Textarea } from "./Textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "destructive" | "primary";
  /** Ask "why" — required for void, archive, deactivate. */
  requireReason?: boolean;
  onConfirm: (reason: string) => Promise<boolean | void>;
}

/** Replaces window.confirm(). Collects a reason when the action must be logged. */
export function ConfirmDialog({ open, onClose, title, message, confirmLabel, tone = "destructive", requireReason, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (requireReason && reason.trim().length < 3) {
      setError("Say why, in a few words");
      return;
    }
    setBusy(true);
    const ok = await onConfirm(reason.trim());
    setBusy(false);
    if (ok !== false) {
      setReason("");
      setError(undefined);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="body-md mb-4">{message}</p>
      {requireReason ? (
        <Field label="Reason" htmlFor="confirm-reason" required error={error} hint="Saved with your name in the history.">
          <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus />
        </Field>
      ) : null}
    </Modal>
  );
}
