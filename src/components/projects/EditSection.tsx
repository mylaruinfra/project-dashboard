"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useApiForm } from "@/components/forms/useApiForm";
import { BasicsFields } from "./BasicsFields";
import { BuildingFields } from "./BuildingFields";
import { EstimateFields } from "./EstimateFields";
import { SiteFields } from "./SiteFields";
import { buildingBody, estimateBody, type ProjectLike, siteBody, stateFromProject, type WizardState } from "./wizard-state";

type Section = "basics" | "site" | "building" | "estimate";
const TITLE: Record<Section, string> = { basics: "Edit basic information", site: "Edit site and plot", building: "Edit floors and slabs", estimate: "Edit estimate and budgets" };

interface Props {
  projectId: string;
  section: Section;
  project: ProjectLike;
  clients?: { id: string; name: string }[];
  label?: string;
  gpsOnly?: boolean;
  variant?: "secondary" | "ghost" | "primary";
}

/** Opens one wizard section in a modal and saves it with PUT /api/projects/:id/:section. */
export function EditSection({ projectId, section, project, clients = [], label = "Edit", gpsOnly, variant = "ghost" }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<WizardState>(() => stateFromProject(project));
  const [clientList, setClientList] = useState(clients);
  const f = useApiForm({});

  const body = () => (section === "basics" ? state.basics : section === "site" ? siteBody(state.site) : section === "building" ? buildingBody(state.building) : estimateBody(state.estimate));

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => {
          setState(stateFromProject(project));
          f.setErrors({});
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={gpsOnly ? "Set site location" : TITLE[section]}
        size={section === "building" || section === "site" ? "xl" : "lg"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={f.busy}
              onClick={async () => {
                const r = await f.submit(`/api/projects/${projectId}/${section}`, { method: "PUT", body: body(), success: "Saved" });
                if (r) setOpen(false);
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        {section === "basics" ? (
          <BasicsFields value={state.basics} onChange={(basics) => setState((s) => ({ ...s, basics }))} errors={f.errors} clients={clientList} onClientAdded={(c) => setClientList((x) => [...x, c])} canAddClient />
        ) : section === "site" ? (
          <SiteFields value={state.site} onChange={(site) => setState((s) => ({ ...s, site }))} errors={f.errors} gpsOnly={gpsOnly} />
        ) : section === "building" ? (
          <>
            <p className="body-sm mb-4 text-steel">Slabs that already have transactions, material use or activities cannot be removed. The estimate is recalculated when you save.</p>
            <BuildingFields value={state.building} onChange={(building) => setState((s) => ({ ...s, building }))} errors={f.errors} />
          </>
        ) : (
          <EstimateFields value={state.estimate} onChange={(estimate) => setState((s) => ({ ...s, estimate }))} errors={f.errors} building={state.building} />
        )}
      </Modal>
    </>
  );
}
