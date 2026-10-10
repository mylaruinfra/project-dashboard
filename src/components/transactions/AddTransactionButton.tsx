"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { TxnType } from "@/lib/domain";
import { emptyTxn, type TxnFormOptions, TxnFormModal } from "./TxnFormModal";

interface Props extends TxnFormOptions {
  projectId?: string;
  today: string;
  type?: TxnType;
  label?: string;
  variant?: "primary" | "secondary";
}

export function AddTransactionButton({ projectId, today, type, label = "Add transaction", variant = "primary", ...options }: Props) {
  const [open, setOpen] = useState(false);
  const pid = projectId ?? (options.projects.length === 1 ? options.projects[0]!.id : "");
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {label}
      </Button>
      {open ? <TxnFormModal open onClose={() => setOpen(false)} initial={emptyTxn(pid, today, type)} {...options} projects={projectId ? options.projects.filter((p) => p.id === projectId) : options.projects} /> : null}
    </>
  );
}
