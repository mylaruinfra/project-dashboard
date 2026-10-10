import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QueryFilters } from "@/components/common/QueryFilters";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { PhotoGrid } from "@/components/documents/PhotoGrid";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { ActivityBoard } from "@/components/progress/ActivityBoard";
import { EditSection } from "@/components/projects/EditSection";
import { ProjectStatusButton } from "@/components/projects/ProjectStatusButton";
import { ProjectStatusChip } from "@/components/projects/ProjectStatusChip";
import { SlabLayout } from "@/components/projects/SlabLayout";
import { TeamPanel } from "@/components/projects/TeamPanel";
import { AddTransactionButton } from "@/components/transactions/AddTransactionButton";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { KpiCell } from "@/components/ui/KpiCell";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { LinkButton } from "@/components/ui/LinkButton";
import { Money } from "@/components/ui/Money";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { ProgressRule } from "@/components/ui/ProgressRule";
import { Tabs } from "@/components/ui/Tabs";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { formatArea } from "@/lib/area";
import { formatDate, todayIso } from "@/lib/dates";
import { DOC_KINDS, FACING_LABEL, PHASE_LABEL, PHASES, PLOT_SHAPE_LABEL, PROJECT_TYPE_LABEL, TXN_TYPE_LABEL, TXN_TYPES } from "@/lib/domain";
import type { Actor } from "@/server/auth/actor";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { clientOptions } from "@/server/services/clients.service";
import { listDocuments } from "@/server/services/documents.service";
import { txnFormOptions } from "@/server/services/form-options";
import { listActivities } from "@/server/services/progress.service";
import { getProject, type ProjectDetail, slabOptions } from "@/server/services/projects.service";
import { costAnalysis } from "@/server/services/reports.service";
import { listPendingPayments, listTransactions } from "@/server/services/transactions.service";
import { listUsersForPicker } from "@/server/services/users.service";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const actor = await requirePageActor();
  const { id } = await params;
  const p = await getProject(actor, id).catch(() => null);
  return { title: p?.name ?? "Project" };
}

const TABS = [
  ["overview", "Overview"],
  ["transactions", "Transactions"],
  ["progress", "Work & progress"],
  ["budget", "Budget"],
  ["documents", "Documents"],
  ["photos", "Site photos"],
  ["team", "Team"],
] as const;

export default async function ProjectPage({ params, searchParams }: Params) {
  const [{ id }, sp, actor] = await Promise.all([params, searchParams, requirePageActor()]);
  const p = await pageData(getProject(actor, id));
  const money = canSeeMoney(actor);
  const tabs = TABS.filter(([k]) => money || k !== "budget");
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const readOnly = p.status === "ARCHIVED";
  const engineerNames = p.team.map((t) => t.name).join(", ") || "Not assigned";

  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/projects" className="hover:text-ink">Projects</Link>}
        title={p.name}
        actions={
          <>
            <ProjectStatusChip status={p.status} />
            {can(actor, "project.write") ? <ProjectStatusButton projectId={p.id} status={p.status} canArchive={can(actor, "record.void")} /> : null}
          </>
        }
        cells={[
          { label: "Site code", value: p.code },
          { label: "Client", value: p.client.name },
          { label: "Dates", value: `${formatDate(p.startDate)} → ${formatDate(p.expectedCompletion)}` },
          { label: "Site engineer", value: engineerNames },
        ]}
      />
      {readOnly ? (
        <Notice tone="error" title="This project is archived" className="mb-5">
          It is read-only. {p.statusReason ? `Reason: ${p.statusReason}` : ""}
        </Notice>
      ) : p.gpsMissing ? (
        <Notice
          tone="hazard"
          title="Site location (GPS) is not set"
          className="mb-5"
          action={can(actor, "field.write") ? <EditSection projectId={p.id} section="site" project={p} label="Add location" variant="primary" gpsOnly={!can(actor, "project.write")} /> : null}
        >
          Add it from the site with “Use my location”, or type it in.
        </Notice>
      ) : null}

      <Tabs active={tab} items={tabs.map(([k, label]) => ({ key: k, label, href: `/projects/${p.id}?tab=${k}` }))} />

      {tab === "overview" ? <Overview p={p} actor={actor} readOnly={readOnly} /> : null}
      {tab === "transactions" ? <TransactionsTab p={p} actor={actor} sp={sp} readOnly={readOnly} /> : null}
      {tab === "progress" ? <ProgressTab p={p} actor={actor} readOnly={readOnly} /> : null}
      {tab === "budget" && money ? <BudgetTab p={p} actor={actor} readOnly={readOnly} /> : null}
      {tab === "documents" ? <DocumentsTab p={p} actor={actor} sp={sp} readOnly={readOnly} /> : null}
      {tab === "photos" ? <PhotosTab p={p} actor={actor} sp={sp} readOnly={readOnly} /> : null}
      {tab === "team" ? <TeamTab p={p} actor={actor} readOnly={readOnly} /> : null}
    </>
  );
}

function Kpis({ p }: { p: ProjectDetail }) {
  if (!p.kpis) return null;
  const k = p.kpis;
  return (
    <KpiStrip>
      <KpiCell label="Estimated cost" value={<Money value={k.estimatedCost} compact />} sub={p.contractValue !== null ? <>Contract <Money value={p.contractValue} compact /></> : "From slab area × cost/SFT"} />
      <KpiCell label="Actual cost" tone="inverse" value={<Money value={k.actualCost} compact />} sub={<>Pending payments <Money value={k.pendingPayments} compact /></>} />
      <KpiCell label="Remaining" tone={k.remaining < 0 ? "hazard" : "default"} value={<Money value={k.remaining} compact />} sub={k.remaining < 0 ? "Over the estimate" : "Estimate minus actual"} />
      <KpiCell label="Client received" value={<Money value={k.clientReceived} compact />} />
      <KpiCell label="Client balance" value={<Money value={k.clientBalance} compact />} sub="Contract value minus received" />
    </KpiStrip>
  );
}

async function Overview({ p, actor, readOnly }: { p: ProjectDetail; actor: Actor; readOnly: boolean }) {
  const canEdit = can(actor, "project.write") && !readOnly;
  const [recent, clients] = await Promise.all([listTransactions(actor, { projectId: p.id }), canEdit ? clientOptions(actor) : Promise.resolve([])]);
  const ground = p.floors.find((f) => f.level === 0 && !f.isTerrace) ?? p.floors[0];

  return (
    <div className="grid grid-cols-1 gap-5">
      <Kpis p={p} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Project details" action={canEdit ? <EditSection projectId={p.id} section="basics" project={p} clients={clients} /> : null}>
          <DescriptionList
            rows={[
              { label: "Type", value: PROJECT_TYPE_LABEL[p.type] },
              { label: "Total slab area", value: formatArea(p.totalSlabArea), numeric: true },
              { label: "Plot area", value: `${formatArea(p.plotArea)} · ${PLOT_SHAPE_LABEL[p.plotShape]}`, numeric: true },
              { label: "Floors", value: `${p.floors.filter((f) => !f.isTerrace).length}${p.hasTerrace ? " + terrace" : ""} (${p.floorsBelow ? `B${p.floorsBelow} + ` : ""}G+${p.floorsAbove})` },
              { label: "Orientation", value: p.facing ? FACING_LABEL[p.facing] : "—" },
              { label: "Nearest road", value: p.nearestRoad ?? "—" },
              {
                label: "Location",
                value: p.latitude ? (
                  <a className="inline-flex items-center gap-1 text-hazard" href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer">
                    {p.address ?? `${p.latitude}, ${p.longitude}`} <MapPin className="size-4" aria-hidden />
                  </a>
                ) : (
                  (p.address ?? "GPS not set")
                ),
              },
            ]}
          />
          {canEdit ? (
            <div className="border-t border-hairline p-2">
              <EditSection projectId={p.id} section="site" project={p} label="Edit site and plot" />
            </div>
          ) : null}
          {p.description ? <p className="body-md border-t border-hairline p-4 text-steel">{p.description}</p> : null}
        </Panel>

        <Panel title="Floor & slab summary" action={canEdit ? <EditSection projectId={p.id} section="building" project={p} /> : null}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink">
                {["Floor", "Slabs", "Area"].map((h, i) => (
                  <th key={h} className={`label-technical h-10 px-4 text-steel ${i === 2 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {p.floors.map((f) => (
                <tr key={f.id}>
                  <td className="body-md h-11 px-4">{f.name}</td>
                  <td className="body-sm px-4 text-steel">{f.slabs.map((s) => formatArea(s.area, "")).join(" + ") || "—"}</td>
                  <td className="px-4 text-right font-display font-semibold whitespace-nowrap tabular">{formatArea(f.area)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink bg-hazard-tint">
                <td colSpan={2} className="label-technical h-11 px-4">
                  Total
                </td>
                <td className="px-4 text-right font-display font-bold whitespace-nowrap tabular">{formatArea(p.totalSlabArea)}</td>
              </tr>
            </tfoot>
          </table>
          {ground ? (
            <div className="border-t border-hairline p-3">
              <SlabLayout title={`Slab layout (${ground.name})`} slabs={ground.slabs.map((s) => ({ key: s.id, name: s.name, length: s.length, width: s.width }))} />
            </div>
          ) : null}
        </Panel>

        <Panel title="Construction phases" action={<Link href={`/projects/${p.id}?tab=progress`} className="label-technical px-2 text-hazard">Open</Link>}>
          <ul className="divide-y divide-hairline">
            {PHASES.map((ph) => (
              <li key={ph} className="grid grid-cols-1 gap-2 px-4 py-3">
                <span className="flex justify-between body-md">
                  {PHASE_LABEL[ph]}
                  <span className="body-sm text-steel">{p.progress[ph] >= 100 ? "Completed" : p.progress[ph] > 0 ? "In progress" : "Not started"}</span>
                </span>
                <ProgressRule value={p.progress[ph]} label={`${PHASE_LABEL[ph]} progress`} />
              </li>
            ))}
            <li className="flex items-center justify-between bg-canvas px-4 py-3">
              <span className="label-technical">Overall</span>
              <span className="label-numeric">{p.progress.overall}%</span>
            </li>
          </ul>
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h2 className="label-technical text-steel">Recent transactions</h2>
          <span className="flex items-center gap-2">
            <Link href={`/projects/${p.id}?tab=transactions`} className="label-technical text-steel hover:text-ink">
              View all
            </Link>
            {!readOnly && (can(actor, "finance.write") || can(actor, "field.write")) ? <AddTransactionButton projectId={p.id} today={todayIso()} {...await txnFormOptions(actor)} /> : null}
          </span>
        </div>
        <TransactionsTable rows={recent.rows.slice(0, 6)} showMoney={canSeeMoney(actor)} />
      </section>
    </div>
  );
}

async function TransactionsTab({ p, actor, sp, readOnly }: { p: ProjectDetail; actor: Actor; sp: Record<string, string>; readOnly: boolean }) {
  const [data, slabs, options] = await Promise.all([listTransactions(actor, { ...sp, projectId: p.id }), slabOptions(actor, p.id), txnFormOptions(actor)]);
  const engineer = actor.role === "ENGINEER";
  return (
    <div>
      <div className="mb-3 flex justify-end">{!readOnly ? <AddTransactionButton projectId={p.id} today={todayIso()} {...options} label={engineer ? "Record attendance" : "Add transaction"} type={engineer ? "LABOR" : undefined} /> : null}</div>
      <QueryFilters
        filters={[
          ...(engineer ? [] : [{ kind: "select" as const, name: "type", label: "Type", options: TXN_TYPES.map((t) => ({ value: t, label: TXN_TYPE_LABEL[t] })), placeholder: "All types" }]),
          { kind: "select", name: "phase", label: "Phase", options: PHASES.map((x) => ({ value: x, label: PHASE_LABEL[x] })), placeholder: "All phases" },
          { kind: "select", name: "slabId", label: "Slab", options: slabs.map((s) => ({ value: s.id, label: s.label })), placeholder: "All slabs" },
          { kind: "date", name: "from", label: "From" },
          { kind: "date", name: "to", label: "To" },
          { kind: "select", name: "status", label: "Status", options: [{ value: "VOID", label: "Void only" }, { value: "ALL", label: "Active + void" }], placeholder: "Active" },
        ]}
      />
      <TransactionsTable rows={data.rows} showMoney={canSeeMoney(actor)} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}

async function ProgressTab({ p, actor, readOnly }: { p: ProjectDetail; actor: Actor; readOnly: boolean }) {
  const [acts, slabs] = await Promise.all([listActivities(actor, p.id), slabOptions(actor, p.id)]);
  return <ActivityBoard projectId={p.id} phases={acts.phases} progress={acts.progress} slabs={slabs} canWrite={can(actor, "field.write") && !readOnly} canArchive={can(actor, "record.void") && !readOnly} today={todayIso()} />;
}

async function BudgetTab({ p, actor, readOnly }: { p: ProjectDetail; actor: Actor; readOnly: boolean }) {
  const [cost, pending] = await Promise.all([costAnalysis(actor, { projectId: p.id }), listPendingPayments(actor, { projectId: p.id })]);
  type PhaseRow = (typeof cost.byPhase)[number];
  const phaseCols: Column<PhaseRow>[] = [
    { key: "phase", header: "Phase", cell: (r) => (r.phase ? PHASE_LABEL[r.phase] : "Not set") },
    { key: "budget", header: "Budget", align: "right", cell: (r) => (r.budget !== null ? <Money value={r.budget} /> : "—") },
    { key: "actual", header: "Actual", align: "right", cell: (r) => <Money value={r.amount} /> },
    { key: "left", header: "Left", align: "right", cell: (r) => (r.budget !== null ? <Money value={r.budget - r.amount} /> : "—") },
  ];
  type PendRow = (typeof pending.rows)[number];
  const pendCols: Column<PendRow>[] = [
    { key: "v", header: "Vendor / party", cell: (r) => <Link href={`/vendors/${r.vendorId}`} className="hover:text-hazard">{r.vendorName}</Link> },
    { key: "i", header: "Unpaid cost", align: "right", cell: (r) => <Money value={r.incurred} /> },
    { key: "p", header: "Paid", align: "right", cell: (r) => <Money value={r.paid} /> },
    { key: "b", header: "Pending", align: "right", cell: (r) => (r.pending < 0 ? <span className="text-indigo">Advance <Money value={-r.pending} /></span> : <Money value={r.pending} className="font-bold" />) },
  ];
  return (
    <div className="grid grid-cols-1 gap-5">
      <Kpis p={p} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Estimate" action={can(actor, "project.write") && !readOnly ? <EditSection projectId={p.id} section="estimate" project={p} /> : null}>
          <DescriptionList
            rows={[
              { label: "Total slab area", value: formatArea(p.totalSlabArea), numeric: true },
              { label: "Cost per SFT", value: <Money value={p.costPerSft} />, numeric: true },
              { label: "Estimated cost", value: <Money value={p.estimatedCost} />, numeric: true },
              { label: "Contract value", value: p.contractValue !== null ? <Money value={p.contractValue} /> : "Same as estimate", numeric: true },
            ]}
          />
        </Panel>
        <Panel title="Cost by type">
          <DescriptionList rows={[...cost.byType.map((t) => ({ label: TXN_TYPE_LABEL[t.type], value: <Money value={t.amount} />, numeric: true })), { label: "Total actual cost", value: <Money value={cost.total} className="font-bold" />, numeric: true }]} />
        </Panel>
      </div>
      <section>
        <h2 className="label-technical mb-3 text-steel">Phase budgets vs actual</h2>
        <DataTable columns={phaseCols} rows={cost.byPhase} rowKey={(r) => r.phase ?? "none"} />
      </section>
      <section>
        <h2 className="label-technical mb-3 text-steel">Pending payments</h2>
        <DataTable columns={pendCols} rows={pending.rows} rowKey={(r) => r.vendorId} empty={<p className="body-sm text-steel">Nothing pending on this project.</p>} />
        <Pagination page={pending.page} pageCount={pending.pageCount} total={pending.total} pageSize={pending.pageSize} />
      </section>
    </div>
  );
}

async function DocumentsTab({ p, actor, sp, readOnly }: { p: ProjectDetail; actor: Actor; sp: Record<string, string>; readOnly: boolean }) {
  const data = await listDocuments(actor, { projectId: p.id, page: sp.page, kind: sp.kind, status: sp.status });
  const allowed = DOC_KINDS.filter((k) => can(actor, "finance.write") || (k !== "BILL" && k !== "AGREEMENT"));
  return (
    <div>
      <div className="mb-3 flex justify-end">{can(actor, "field.write") && !readOnly ? <UploadDocumentButton projectId={p.id} allowedKinds={allowed} /> : null}</div>
      <QueryFilters filters={[{ kind: "select", name: "kind", label: "Kind", options: allowed.map((k) => ({ value: k, label: k.charAt(0) + k.slice(1).toLowerCase() })), placeholder: "All kinds" }, { kind: "select", name: "status", label: "Status", options: [{ value: "ARCHIVED", label: "Archived" }, { value: "ALL", label: "All" }], placeholder: "Active" }]} />
      <DocumentsTable rows={data.rows} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}

async function PhotosTab({ p, actor, sp, readOnly }: { p: ProjectDetail; actor: Actor; sp: Record<string, string>; readOnly: boolean }) {
  const data = await listDocuments(actor, { projectId: p.id, kind: "PHOTO", page: sp.page, pageSize: 24 });
  return (
    <div>
      <div className="mb-3 flex justify-end">{can(actor, "field.write") && !readOnly ? <UploadDocumentButton projectId={p.id} kind="PHOTO" label="Upload photo" /> : null}</div>
      <PhotoGrid photos={data.rows} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </div>
  );
}

async function TeamTab({ p, actor, readOnly }: { p: ProjectDetail; actor: Actor; readOnly: boolean }) {
  const canEdit = can(actor, "project.write") && !readOnly;
  const engineers = canEdit ? await listUsersForPicker(actor, "ENGINEER") : [];
  return (
    <>
      <TeamPanel projectId={p.id} members={p.team} engineers={engineers} canEdit={canEdit} />
      {!canEdit && actor.role !== "ENGINEER" ? null : (
        <p className="body-sm mt-4 text-steel">
          Need a new engineer login? {can(actor, "user.manage") ? <LinkButton href="/settings?tab=users" variant="ghost" size="sm">Add a user</LinkButton> : "Ask an admin."}
        </p>
      )}
    </>
  );
}
