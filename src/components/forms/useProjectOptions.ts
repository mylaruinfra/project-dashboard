"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export interface ProjectOptions {
  slabs: { id: string; label: string }[];
  purchaseOrders: { id: string; number: string; vendorId: string }[];
  activities: { id: string; label: string; phase: string }[];
}

const EMPTY: ProjectOptions = { slabs: [], purchaseOrders: [], activities: [] };

/** Loads the pickers that depend on the chosen project. */
export function useProjectOptions(projectId: string, enabled = true): ProjectOptions {
  const [opts, setOpts] = useState<ProjectOptions>(EMPTY);
  useEffect(() => {
    if (!enabled || !projectId) return;
    let live = true;
    api<ProjectOptions>(`/api/projects/${projectId}/options`).then((r) => {
      if (live && r.ok) setOpts(r.data);
    });
    return () => {
      live = false;
    };
  }, [projectId, enabled]);
  return projectId ? opts : EMPTY;
}
