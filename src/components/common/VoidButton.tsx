"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAction } from "@/components/forms/useApiForm";

interface Props {
  /** POST endpoint that takes { reason, ...extra } */
  endpoint: string;
  label: string;
  title: string;
  message: string;
  success: string;
  extra?: Record<string, unknown>;
  variant?: ButtonVariant;
  confirmTone?: "destructive" | "primary";
  method?: string;
  onDone?: () => void;
  /** Where to go afterwards (e.g. the list, when the record is gone). */
  redirectTo?: string;
}

/** Void / archive / deactivate / restore: always asks why, never hard-deletes. */
export function VoidButton({ endpoint, label, title, message, success, extra, variant = "destructive", confirmTone = "destructive", method, onDone, redirectTo }: Props) {
  const [open, setOpen] = useState(false);
  const act = useAction();
  const router = useRouter();
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        message={message}
        confirmLabel={label}
        tone={confirmTone}
        requireReason
        onConfirm={async (reason) => {
          const r = await act(endpoint, { reason, ...extra }, { success, method });
          if (r === null) return false;
          onDone?.();
          if (redirectTo) router.push(redirectTo);
        }}
      />
    </>
  );
}
