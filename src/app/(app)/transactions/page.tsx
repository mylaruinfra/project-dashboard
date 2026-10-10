import type { Metadata } from "next";
import { QueryFilters } from "@/components/common/QueryFilters";
import { SearchBox } from "@/components/common/SearchBox";
import { AddTransactionButton } from "@/components/transactions/AddTransactionButton";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Pagination } from "@/components/ui/Pagination";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { todayIso } from "@/lib/dates";
import { PHASE_LABEL, PHASES, TXN_TYPE_LABEL, TXN_TYPES } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { txnFormOptions } from "@/server/services/form-options";
import { listTransactions } from "@/server/services/transactions.service";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const [data, options] = await Promise.all([listTransactions(actor, sp), txnFormOptions(actor)]);
  const engineer = actor.role === "ENGINEER";
  return (
    <>
      <TitleBlock
        eyebrow="Ledger"
        title={engineer ? "Labor attendance" : "Transactions"}
        cells={[{ label: "Matching", value: `${data.total} entries` }]}
        actions={can(actor, "finance.write") || can(actor, "field.write") ? <AddTransactionButton today={todayIso()} {...options} label={engineer ? "Record attendance" : "Add transaction"} /> : null}
      />
      <div className="mb-3">
        <SearchBox placeholder="Search item, bill or TXN number" />
      </div>
      <QueryFilters
        filters={[
          { kind: "select", name: "projectId", label: "Project", options: options.projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" },
          ...(engineer ? [] : [{ kind: "select" as const, name: "type", label: "Type", options: TXN_TYPES.map((t) => ({ value: t, label: TXN_TYPE_LABEL[t] })), placeholder: "All types" }]),
          { kind: "select", name: "phase", label: "Phase", options: PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] })), placeholder: "All phases" },
          { kind: "date", name: "from", label: "From" },
          { kind: "date", name: "to", label: "To" },
          { kind: "select", name: "status", label: "Status", options: [{ value: "VOID", label: "Void only" }, { value: "ALL", label: "Active + void" }], placeholder: "Active" },
        ]}
      />
      <p className="body-sm mb-2 text-steel">Pick a project to filter by slab on its Transactions tab.</p>
      <TransactionsTable rows={data.rows} showProject showMoney={canSeeMoney(actor)} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
