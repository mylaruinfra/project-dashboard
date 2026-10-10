import type { Metadata } from "next";
import Link from "next/link";
import { QueryFilters } from "@/components/common/QueryFilters";
import { VoidButton } from "@/components/common/VoidButton";
import { LaborRateButton } from "@/components/labor/LaborRateButton";
import { AddTransactionButton } from "@/components/transactions/AddTransactionButton";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCell } from "@/components/ui/KpiCell";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { Tabs } from "@/components/ui/Tabs";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { todayIso } from "@/lib/dates";
import { PHASE_LABEL, PHASES, VENDOR_TYPE_LABEL } from "@/lib/domain";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { txnFormOptions } from "@/server/services/form-options";
import { laborReport } from "@/server/services/reports.service";
import { listLaborRates } from "@/server/services/settings.service";
import { listPendingPayments, listTransactions } from "@/server/services/transactions.service";

export const metadata: Metadata = { title: "Labor" };

export default async function LaborPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const money = canSeeMoney(actor);
  const tabs = [["attendance", "Attendance"], ...(money ? [["payments", "Payments & pending"]] : []), ["rates", "Daily rates"]] as [string, string][];
  const tab = tabs.some(([k]) => k === sp.tab) ? sp.tab! : "attendance";
  const options = await txnFormOptions(actor);
  const today = todayIso();

  return (
    <>
      <TitleBlock eyebrow="Workforce" title="Labor" cells={[{ label: "Rule", value: "Pending = attendance cost − payments" }]} />
      <Tabs active={tab} items={tabs.map(([k, l]) => ({ key: k, label: l, href: `/labor?tab=${k}` }))} />

      {tab === "attendance" ? await (async () => {
        const data = await listTransactions(actor, { ...sp, type: "LABOR" });
        return (
          <>
            <div className="mb-3 flex justify-end">{can(actor, "field.write") ? <AddTransactionButton today={today} {...options} type="LABOR" label="Record attendance" /> : null}</div>
            <QueryFilters
              filters={[
                { kind: "select", name: "projectId", label: "Project", options: options.projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" },
                { kind: "select", name: "phase", label: "Phase", options: PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] })), placeholder: "All phases" },
                { kind: "date", name: "from", label: "From" },
                { kind: "date", name: "to", label: "To" },
              ]}
            />
            <TransactionsTable rows={data.rows} showProject showMoney={money} empty={<EmptyState title="No attendance yet" body="Record who worked today: labor type, workers and days." />} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}

      {tab === "payments" && money ? await (async () => {
        const [report, pending, payments] = await Promise.all([laborReport(actor, sp), listPendingPayments(actor, sp), listTransactions(actor, { ...sp, type: "CONTRACTOR_PAYMENT" })]);
        const totals = report.byParty.reduce((a, p) => ({ att: a.att + p.attendance, paid: a.paid + p.paid, pend: a.pend + Math.max(0, p.pending) }), { att: 0, paid: 0, pend: 0 });
        type P = (typeof pending.rows)[number];
        const cols: Column<P>[] = [
          { key: "v", header: "Party / vendor", cell: (r) => <Link href={`/vendors/${r.vendorId}`} className="hover:text-hazard">{r.vendorName}<span className="body-sm block text-steel">{VENDOR_TYPE_LABEL[r.vendorType]}</span></Link> },
          { key: "p", header: "Project", cell: (r) => r.projectName },
          { key: "i", header: "Unpaid cost", align: "right", cell: (r) => <Money value={r.incurred} /> },
          { key: "pd", header: "Paid", align: "right", cell: (r) => <Money value={r.paid} /> },
          { key: "b", header: "Pending", align: "right", cell: (r) => (r.pending < 0 ? <Chip tone="indigo">Advance <Money value={-r.pending} /></Chip> : <Money value={r.pending} className="font-bold" />) },
        ];
        return (
          <div className="grid grid-cols-1 gap-5">
            <KpiStrip columns={3}>
              <KpiCell label="Labor attendance cost" value={<Money value={totals.att} compact />} />
              <KpiCell label="Paid to labor parties" value={<Money value={totals.paid} compact />} />
              <KpiCell label="Labor pending" tone="hazard" value={<Money value={totals.pend} compact />} />
            </KpiStrip>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <QueryFilters className="mb-0 flex-1" filters={[{ kind: "select", name: "projectId", label: "Project", options: options.projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" }]} />
              {can(actor, "finance.write") ? <AddTransactionButton today={today} {...options} type="CONTRACTOR_PAYMENT" label="Record payment" /> : null}
            </div>
            <section>
              <h2 className="label-technical mb-3 text-steel">Pending payments (vendors and labor parties)</h2>
              <DataTable columns={cols} rows={pending.rows} rowKey={(r) => `${r.projectId}:${r.vendorId}`} empty={<EmptyState title="Nothing pending" />} />
              <Pagination page={pending.page} pageCount={pending.pageCount} total={pending.total} pageSize={pending.pageSize} />
            </section>
            <section>
              <h2 className="label-technical mb-3 text-steel">Labor by type</h2>
              <DataTable
                columns={[
                  { key: "t", header: "Labor type", cell: (r) => r.laborType },
                  { key: "d", header: "Man-days", align: "right", cell: (r) => formatQty(r.manDays) },
                  { key: "a", header: "Cost", align: "right", cell: (r) => <Money value={r.amount} /> },
                ]}
                rows={report.byType}
                rowKey={(r) => r.laborType}
              />
            </section>
            <section>
              <h2 className="label-technical mb-3 text-steel">Recent payments</h2>
              <TransactionsTable rows={payments.rows} showProject showMoney />
            </section>
          </div>
        );
      })() : null}

      {tab === "rates" ? await (async () => {
        const rates = await listLaborRates(actor, { includeInactive: true });
        const manage = can(actor, "settings.manage");
        type R = (typeof rates)[number];
        const cols: Column<R>[] = [
          { key: "t", header: "Labor type", cell: (r) => <span className={r.status === "INACTIVE" ? "text-steel line-through" : ""}>{r.laborType}</span> },
          ...(money ? [{ key: "r", header: "Daily rate", align: "right" as const, cell: (r: R) => <Money value={r.rate} /> }] : []),
          { key: "s", header: "Status", cell: (r) => (r.status === "ACTIVE" ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>) },
          ...(manage
            ? [{
                key: "a",
                header: "",
                cell: (r: R) => (
                  <span className="flex justify-end gap-1">
                    <LaborRateButton rate={r} />
                    <VoidButton endpoint={`/api/settings/labor-rates/${encodeURIComponent(r.laborType)}/status`} extra={{ status: r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }} label={r.status === "ACTIVE" ? "Deactivate" : "Activate"} title="Change labor type" message="Inactive types cannot be picked for new attendance." success="Saved" variant="ghost" confirmTone="primary" />
                  </span>
                ),
              }]
            : []),
        ];
        return (
          <>
            <div className="mb-3 flex justify-end">{manage ? <LaborRateButton /> : null}</div>
            <DataTable columns={cols} rows={rates} rowKey={(r) => r.laborType} />
            {!money ? <p className="body-sm mt-2 text-steel">Rates are set by managers. Attendance you record is costed at these rates.</p> : null}
          </>
        );
      })() : null}
    </>
  );
}
