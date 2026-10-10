import type { Metadata } from "next";
import Link from "next/link";
import { QueryFilters } from "@/components/common/QueryFilters";
import { BarList } from "@/components/reports/BarList";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { KpiCell } from "@/components/ui/KpiCell";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { Money } from "@/components/ui/Money";
import { Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatArea } from "@/lib/area";
import { PHASE_LABEL, PROJECT_TYPE_LABEL, TXN_TYPE_LABEL } from "@/lib/domain";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { denyUnless } from "@/server/http/page";
import { projectOptions } from "@/server/services/projects.service";
import { costAnalysis, financialReport, laborReport, materialReport, projectComparison } from "@/server/services/reports.service";

export const metadata: Metadata = { title: "Reports & Analytics" };

const TABS = [
  ["cost", "Cost analysis"],
  ["comparison", "Project comparison"],
  ["material", "Material"],
  ["labor", "Labor"],
  ["financial", "Financial"],
] as const;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  denyUnless(can(actor, "finance.read"));
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "cost";
  const projects = await projectOptions(actor);
  const projectFilter = <QueryFilters filters={[{ kind: "select", name: "projectId", label: "Project", options: projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All active projects" }, ...(tab === "cost" ? [{ kind: "date" as const, name: "from", label: "From" }, { kind: "date" as const, name: "to", label: "To" }] : [])]} />;

  return (
    <>
      <TitleBlock eyebrow="Analytics" title="Reports" cells={[{ label: "Basis", value: "Recorded figures only (no forecasting)" }, { label: "Excludes", value: "Void entries, unconfirmed uploads" }]} />
      <Tabs active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: `/reports?tab=${k}${sp.projectId ? `&projectId=${sp.projectId}` : ""}` }))} />

      {tab === "cost" ? await (async () => {
        const r = await costAnalysis(actor, sp);
        return (
          <>
            {projectFilter}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title="Actual cost by type" action={<Money value={r.total} className="font-display font-bold" />}>
                <BarList rows={r.byType.map((t) => ({ label: TXN_TYPE_LABEL[t.type], value: t.amount }))} />
              </Panel>
              <Panel title="By phase vs budget">
                <BarList rows={r.byPhase.map((p) => ({ label: p.phase ? PHASE_LABEL[p.phase] : "Not set", value: p.amount, budget: p.budget }))} />
                <p className="body-sm border-t border-hairline px-4 py-2 text-steel">The black tick is the phase budget; red means over budget.</p>
              </Panel>
            </div>
          </>
        );
      })() : null}

      {tab === "comparison" ? await (async () => {
        const rows = await projectComparison(actor);
        type R = (typeof rows)[number];
        const cols: Column<R>[] = [
          { key: "n", header: "Project", cell: (r) => <Link href={`/projects/${r.id}`} className="hover:text-hazard">{r.name}<span className="label-code block text-steel">{r.code} · {PROJECT_TYPE_LABEL[r.type]}</span></Link> },
          { key: "a", header: "Slab area", align: "right", cell: (r) => formatArea(r.area) },
          { key: "e", header: "Estimated", align: "right", cell: (r) => <Money value={r.estimatedCost} compact /> },
          { key: "ac", header: "Actual", align: "right", cell: (r) => <Money value={r.actualCost} compact /> },
          { key: "es", header: "Est. / SFT", align: "right", cell: (r) => <Money value={r.estimatedPerSft} /> },
          { key: "as", header: "Actual / SFT", align: "right", cell: (r) => <Money value={r.actualPerSft} className="font-bold" /> },
          { key: "p", header: "Spent", align: "right", cell: (r) => (r.spentPct === null ? "—" : `${r.spentPct}%`) },
        ];
        return <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} />;
      })() : null}

      {tab === "material" ? await (async () => {
        const rows = await materialReport(actor, sp);
        type R = (typeof rows)[number];
        const cols: Column<R>[] = [
          { key: "n", header: "Material", cell: (r) => `${r.name} (${r.unit})` },
          { key: "o", header: "Ordered", align: "right", cell: (r) => formatQty(r.ordered) },
          { key: "p", header: "Purchased", align: "right", cell: (r) => formatQty(r.purchased) },
          { key: "rc", header: "Received", align: "right", cell: (r) => formatQty(r.received) },
          { key: "u", header: "Used", align: "right", cell: (r) => formatQty(r.used) },
          { key: "rm", header: "Remaining", align: "right", cell: (r) => <b>{formatQty(r.remaining)}</b> },
          { key: "pd", header: "Not delivered", align: "right", cell: (r) => (r.pendingDelivery ? <span className="text-hazard">{formatQty(r.pendingDelivery)}</span> : "—") },
          { key: "v", header: "Purchase value", align: "right", cell: (r) => <Money value={r.purchasedValue} /> },
        ];
        return (
          <>
            {projectFilter}
            <DataTable columns={cols} rows={rows} rowKey={(r) => r.materialId} />
          </>
        );
      })() : null}

      {tab === "labor" ? await (async () => {
        const r = await laborReport(actor, sp);
        return (
          <>
            {projectFilter}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Panel title="By labor type">
                <BarList rows={r.byType.map((t) => ({ label: `${t.laborType} · ${formatQty(t.manDays)} man-days`, value: t.amount }))} />
              </Panel>
              <DataTable
                columns={[
                  { key: "n", header: "Labor party", cell: (x) => <Link href={`/vendors/${x.vendorId}`} className="hover:text-hazard">{x.name}</Link> },
                  { key: "a", header: "Attendance", align: "right", cell: (x) => <Money value={x.attendance} /> },
                  { key: "p", header: "Paid", align: "right", cell: (x) => <Money value={x.paid} /> },
                  { key: "b", header: "Pending", align: "right", cell: (x) => <Money value={x.pending} className="font-bold" /> },
                ]}
                rows={r.byParty}
                rowKey={(x) => x.vendorId}
                empty={<p className="body-sm text-steel">No labor parties with attendance.</p>}
              />
            </div>
          </>
        );
      })() : null}

      {tab === "financial" ? await (async () => {
        const rows = await financialReport(actor);
        const t = rows.reduce((a, r) => ({ contract: a.contract + r.contractValue, received: a.received + r.clientReceived, cost: a.cost + r.actualCost, pending: a.pending + r.pendingPayments }), { contract: 0, received: 0, cost: 0, pending: 0 });
        type R = (typeof rows)[number];
        const cols: Column<R>[] = [
          { key: "n", header: "Project", cell: (r) => <Link href={`/projects/${r.id}`} className="hover:text-hazard">{r.name}<span className="body-sm block text-steel">{r.clientName}</span></Link> },
          { key: "cv", header: "Contract value", align: "right", cell: (r) => <Money value={r.contractValue} /> },
          { key: "rc", header: "Received", align: "right", cell: (r) => <Money value={r.clientReceived} /> },
          { key: "cb", header: "Client balance", align: "right", cell: (r) => <Money value={r.clientBalance} className="font-bold" /> },
          { key: "ac", header: "Actual cost", align: "right", cell: (r) => <Money value={r.actualCost} /> },
          { key: "pp", header: "We owe", align: "right", cell: (r) => <Money value={r.pendingPayments} className="text-hazard" /> },
          { key: "ad", header: "Advances paid", align: "right", cell: (r) => (r.advances ? <Money value={r.advances} /> : "—") },
          { key: "cash", header: "Received − cost", align: "right", cell: (r) => <Money value={r.clientReceived - r.actualCost} /> },
        ];
        return (
          <div className="grid grid-cols-1 gap-5">
            <KpiStrip columns={4}>
              <KpiCell label="Contract value" value={<Money value={t.contract} compact />} />
              <KpiCell label="Received from clients" value={<Money value={t.received} compact />} />
              <KpiCell label="Actual cost" tone="inverse" value={<Money value={t.cost} compact />} />
              <KpiCell label="We owe" tone="hazard" value={<Money value={t.pending} compact />} />
            </KpiStrip>
            <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} />
          </div>
        );
      })() : null}
    </>
  );
}
