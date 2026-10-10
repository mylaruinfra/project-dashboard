import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Money } from "@/components/ui/Money";
import { formatDateShort } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/domain";
import { formatQty } from "@/lib/qty";
import type { TxnListRow } from "@/server/services/transactions.service";
import { TxnTypeChip } from "./TxnTypeChip";

export function TransactionsTable({ rows, showProject, showMoney, empty }: { rows: TxnListRow[]; showProject?: boolean; showMoney: boolean; empty?: React.ReactNode }) {
  const cols: Column<TxnListRow>[] = [
    { key: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{formatDateShort(r.date)}</span> },
    {
      key: "item",
      header: "Description",
      cell: (r) => (
        <span className="block min-w-40">
          <span className={r.status === "VOID" ? "text-steel line-through" : ""}>{r.item}</span>
          <span className="body-sm block text-steel">
            {[r.qty !== null && r.type !== "LABOR" ? `${formatQty(r.qty)} ${r.unit ?? ""}` : null, r.type === "LABOR" && r.days !== null ? `${r.workers} × ${r.days / 100} day` : null, r.vendorName, r.number].filter(Boolean).join(" · ")}
          </span>
        </span>
      ),
    },
    { key: "type", header: "Type", cell: (r) => <span className="flex flex-wrap gap-1"><TxnTypeChip type={r.type} />{r.status === "VOID" ? <Chip tone="error">Void</Chip> : null}{r.source === "AI" ? <Chip tone="muted">AI</Chip> : null}</span> },
    ...(showProject ? [{ key: "project", header: "Project", cell: (r: TxnListRow) => <span className="whitespace-nowrap">{r.projectName}</span> }] : []),
    { key: "phase", header: "Phase", cell: (r) => (r.phase ? PHASE_LABEL[r.phase] : "—") },
    { key: "slab", header: "Slab", cell: (r) => (r.slabName ? <span className="whitespace-nowrap">{r.floorName} · {r.slabName}</span> : "—") },
  ];
  if (showMoney) {
    cols.push({ key: "amount", header: "Amount", align: "right", cell: (r) => <Money value={r.amount} className={r.status === "VOID" ? "text-steel line-through" : r.type === "CLIENT_PAYMENT" ? "text-indigo" : ""} /> });
  }
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/transactions/${r.id}`} empty={empty ?? <EmptyState title="No transactions yet" body="Add one with the button above." />} />;
}
