"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api-client";
import { formatArea } from "@/lib/area";
import { formatDate } from "@/lib/dates";
import { FACING_LABEL, PHASE_LABEL, PHASES, PLOT_SHAPE_LABEL, PROJECT_TYPE_LABEL } from "@/lib/domain";
import { formatINR, parseRupees } from "@/lib/money";
import { BasicsFields } from "./BasicsFields";
import { BuildingFields } from "./BuildingFields";
import { EstimateFields } from "./EstimateFields";
import { SiteFields } from "./SiteFields";
import { buildingArea, emptyWizard, type Errors, estimateFor, floorArea, sitePlotArea, validateStep, type WizardState, wizardBody } from "./wizard-state";

const STEPS = ["Basic", "Site", "Building", "Estimate", "Review"] as const;
const TITLES = ["Basic information", "Site location & plot", "Building & floor details", "Project estimation", "Review & create"];
const HINTS = ["Project name, client and key details", "Exact location, plot details, orientation and nearest road", "Floors and slabs per floor (length × width)", "Cost per SFT and estimated project cost", "Check every section before creating the project"];

/** Maps server field paths ("basics.name") back to a step and its local key. */
const STEP_PREFIX = ["basics.", "site.", "building.", "estimate."];

export function ProjectWizard({ clients: initialClients, today }: { clients: { id: string; name: string }[]; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<WizardState>(() => emptyWizard(today));
  const [clients, setClients] = useState(initialClients);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const go = (to: number) => {
    setErrors({});
    setStep(to);
    setMaxReached((m) => Math.max(m, to));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const errs = validateStep(step, state);
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast("Check the highlighted fields.", "error");
      return;
    }
    go(step + 1);
  };

  const create = async () => {
    setBusy(true);
    const res = await api<{ id: string }>("/api/projects", { body: wizardBody(state) });
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message, "error");
      const fields = res.error.fields ?? {};
      const firstStep = STEP_PREFIX.findIndex((p) => Object.keys(fields).some((k) => k.startsWith(p)));
      if (firstStep >= 0) {
        setStep(firstStep);
        setErrors(Object.fromEntries(Object.entries(fields).filter(([k]) => k.startsWith(STEP_PREFIX[firstStep]!)).map(([k, v]) => [k.slice(STEP_PREFIX[firstStep]!.length), v])));
      }
      return;
    }
    toast("Project created");
    router.push(`/projects/${res.data.id}`);
  };

  const area = buildingArea(state.building);
  const est = estimateFor(state.building, state.estimate);
  const plot = sitePlotArea(state.site);
  const clientName = clients.find((c) => c.id === state.basics.clientId)?.name ?? "—";

  return (
    <div>
      <Stepper steps={STEPS} current={step} maxReached={maxReached} onStep={(i) => (i <= maxReached ? go(i) : undefined)} />
      <Panel title={`${step + 1}. ${TITLES[step]}`} bodyClassName="p-4 md:p-5">
        <p className="body-md -mt-1 mb-5 text-steel">{HINTS[step]}</p>
        {step === 0 ? (
          <BasicsFields value={state.basics} onChange={(basics) => setState((s) => ({ ...s, basics }))} errors={errors} clients={clients} onClientAdded={(c) => setClients((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)))} canAddClient />
        ) : step === 1 ? (
          <SiteFields value={state.site} onChange={(site) => setState((s) => ({ ...s, site }))} errors={errors} />
        ) : step === 2 ? (
          <BuildingFields value={state.building} onChange={(building) => setState((s) => ({ ...s, building }))} errors={errors} />
        ) : step === 3 ? (
          <EstimateFields value={state.estimate} onChange={(estimate) => setState((s) => ({ ...s, estimate }))} errors={errors} building={state.building} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReviewBlock title="Project" onEdit={() => go(0)}>
              <p className="font-display text-base font-bold">{state.basics.name}</p>
              <p>Client: {clientName}</p>
              <p>Type: {state.basics.type ? PROJECT_TYPE_LABEL[state.basics.type] : "—"}</p>
              <p>
                Start: {formatDate(state.basics.startDate)} · End: {formatDate(state.basics.expectedCompletion)}
              </p>
            </ReviewBlock>
            <ReviewBlock title="Site" onEdit={() => go(1)}>
              <p>{state.site.address || "No address"}</p>
              <p>{state.site.latitude ? `Lat: ${state.site.latitude}, Lng: ${state.site.longitude}` : <span className="text-hazard">GPS not set — you can add it later</span>}</p>
              <p>
                Plot: {PLOT_SHAPE_LABEL[state.site.plotShape]} · {plot !== null ? formatArea(plot) : "—"}
              </p>
              <p>Orientation: {state.site.facing ? FACING_LABEL[state.site.facing] : "—"}</p>
              <p>Nearest road: {state.site.nearestRoad || "—"}</p>
            </ReviewBlock>
            <ReviewBlock title="Building" onEdit={() => go(2)}>
              <p>
                {state.building.floors.length} floors · Total slab area: <b className="font-display">{formatArea(area)}</b>
              </p>
              <dl className="mt-2 divide-y divide-hairline border-y border-hairline">
                {state.building.floors.map((f) => (
                  <div key={f.key} className="flex justify-between py-1.5">
                    <dt>{f.name}</dt>
                    <dd className="tabular">
                      {f.slabs.length} slab{f.slabs.length === 1 ? "" : "s"} · {formatArea(floorArea(f))}
                    </dd>
                  </div>
                ))}
              </dl>
            </ReviewBlock>
            <ReviewBlock title="Estimation" onEdit={() => go(3)}>
              <p>Cost / SFT: {state.estimate.costPerSft ? formatINR(parseRupees(state.estimate.costPerSft) ?? 0) : "—"}</p>
              <p className="font-display text-lg font-bold">Estimated project cost: {est !== null ? formatINR(est) : "—"}</p>
              {PHASES.filter((p) => state.estimate.phaseBudgets[p]).map((p) => (
                <p key={p}>
                  {PHASE_LABEL[p]} budget: {formatINR(parseRupees(state.estimate.phaseBudgets[p]) ?? 0)}
                </p>
              ))}
            </ReviewBlock>
          </div>
        )}
      </Panel>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-ink bg-canvas px-4 py-3 md:static md:mx-0 md:border md:border-hairline md:bg-paper lg:bottom-0">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => go(step - 1)}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => router.push("/projects")}>
            Cancel
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={next}>
            Save & continue <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={create} loading={busy}>
            <Check className="size-4" aria-hidden /> Create project
          </Button>
        )}
      </div>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="border border-hairline">
      <header className="flex min-h-11 items-center justify-between border-b border-ink bg-canvas pl-4">
        <h3 className="label-technical">{title}</h3>
        <button type="button" onClick={onEdit} className="label-technical min-h-11 px-4 text-hazard hover:text-ink">
          Edit
        </button>
      </header>
      <div className="body-md space-y-1 p-4">{children}</div>
    </section>
  );
}
