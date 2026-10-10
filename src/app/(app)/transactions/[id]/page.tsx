import type { Metadata } from "next";
import Link from "next/link";
import { History } from "@/components/common/History";
import { VoidButton } from "@/components/common/VoidButton";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { EditTransactionButton } from "@/components/transactions/EditTransactionButton";
import { TxnTypeChip } from "@/components/transactions/TxnTypeChip";
import { Chip } from "@/components/ui/Chip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Money } from "@/components/ui/Money";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PHASE_LABEL, TXN_TYPE_LABEL } from "@/lib/domain";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { txnFormOptions } from "@/server/services/form-options";
import { getTransaction } from "@/server/services/transactions.service";

export const metadata: Metadata = { title: "Transaction" };

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const t = await pageData(getTransaction(actor, id));
  const money = canSeeMoney(actor);
  const active = t.status === "ACTIVE";
  const canEdit = active && (can(actor, "finance.write") || (actor.role === "ENGINEER" && t.type === "LABOR"));
  const options = canEdit ? await txnFormOptions(actor) : null;

  return (
    <>
      <TitleBlock
        eyebrow={<Link href={`/projects/${t.projectId}?tab=transactions`} className="hover:text-ink">{t.projectName}</Link>}
        title={t.item}
        actions={
          <>
            <TxnTypeChip type={t.type} />
            {t.status === "VOID" ? <Chip tone="error">Void</Chip> : null}
            {canEdit && options ? (
              <EditTransactionButton
                txn={t}
                {...options}
              />
            ) : null}
            {active && can(actor, "record.void") ? <VoidButton endpoint={`/api/transactions/${t.id}/void`} label="Void" title="Void this transaction" message="It stays on record but stops counting in costs, payments and reports." success="Transaction voided" /> : null}
          </>
        }
        cells={[
          { label: "Number", value: t.number },
          { label: "Date", value: formatDate(t.date) },
          { label: "Type", value: TXN_TYPE_LABEL[t.type] },
          { label: "Entered by", value: t.createdByName ?? "—" },
        ]}
      />
      {t.status === "VOID" ? (
        <Notice tone="error" title="This transaction is void" className="mb-5">
          Voided by {t.voidedByName} on {t.voidedAt ? formatDateTime(t.voidedAt) : "—"}. Reason: {t.voidReason}
        </Notice>
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid grid-cols-1 gap-5">
          <Panel title="Details">
            <DescriptionList
              rows={[
                ...(money ? [{ label: "Amount", value: <Money value={t.amount} className="text-lg font-bold" />, numeric: true }] : []),
                ...(t.type === "LABOR" ? [{ label: "Labor", value: `${t.laborType} · ${t.workers} workers × ${(t.days ?? 0) / 100} day` }] : []),
                ...(t.qty !== null && t.type !== "LABOR" ? [{ label: "Quantity", value: `${formatQty(t.qty)} ${t.unit ?? ""}`, numeric: true }] : []),
                ...(money && t.rate !== null ? [{ label: t.type === "LABOR" ? "Daily rate" : "Rate", value: <Money value={t.rate} />, numeric: true }] : []),
                ...(t.spec ? [{ label: "Specification", value: t.spec }] : []),
                ...(t.vendorName ? [{ label: t.type === "CONTRACTOR_PAYMENT" ? "Paid to" : "Vendor", value: <Link className="text-hazard" href={`/vendors/${t.vendorId}`}>{t.vendorName}</Link> }] : []),
                ...(money && t.vendorName && t.type !== "CONTRACTOR_PAYMENT" ? [{ label: "Payment", value: t.paidNow ? "Paid on the spot" : "Pending (tracked under the vendor)" }] : []),
                { label: "Phase", value: t.phase ? PHASE_LABEL[t.phase] : "—" },
                { label: "Slab", value: t.slabName ? `${t.floorName} · ${t.slabName}` : "Whole site" },
                ...(t.billNo ? [{ label: "Bill number", value: t.billNo }] : []),
                ...(t.poNumber ? [{ label: "Purchase order", value: t.poNumber }] : []),
                ...(t.paymentMode ? [{ label: "Payment mode", value: t.paymentMode }] : []),
                { label: "Source", value: t.source === "AI" ? <span>Read by AI, confirmed by a person{t.aiDraftId ? <> · <Link className="text-hazard" href={`/upload/${t.aiDraftId}`}>draft</Link></> : null}</span> : "Entered by hand" },
                ...(t.notes ? [{ label: "Notes", value: t.notes }] : []),
              ]}
            />
          </Panel>
          <Panel title="Bills and attachments" action={active && can(actor, "finance.write") ? <UploadDocumentButton entityType="transaction" entityId={t.id} kind="BILL" label="Attach bill" variant="secondary" /> : null}>
            {t.documents.length ? (
              <ul className="divide-y divide-hairline">
                {t.documents.map((d) => (
                  <li key={d.id} className="flex min-h-11 items-center justify-between px-4">
                    <Link href={`/documents/${d.id}`} className="hover:text-hazard">
                      {d.title}
                    </Link>
                    <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="label-technical text-hazard">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="body-sm p-4 text-steel">No bill attached.</p>
            )}
          </Panel>
        </div>
        <History rows={t.history} />
      </div>
    </>
  );
}
