import type { Metadata } from "next";
import Link from "next/link";
import { VoidButton } from "@/components/common/VoidButton";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { VendorButton } from "@/components/parties/VendorButton";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Money } from "@/components/ui/Money";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { VENDOR_TYPE_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { listDocuments } from "@/server/services/documents.service";
import { listTransactions } from "@/server/services/transactions.service";
import { getVendor } from "@/server/services/vendors.service";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const [{ id }, sp, actor] = await Promise.all([params, searchParams, requirePageActor()]);
  const v = await pageData(getVendor(actor, id));
  const money = canSeeMoney(actor);
  const [txns, docs] = await Promise.all([money ? listTransactions(actor, { vendorId: v.id, page: sp.page }) : null, money ? listDocuments(actor, { entityType: "vendor", entityId: v.id }) : null]);
  const active = v.status === "ACTIVE";
  type L = NonNullable<typeof v.ledger>[number];
  const ledgerCols: Column<L>[] = [
    { key: "p", header: "Project", cell: (r) => <Link href={`/projects/${r.projectId}`} className="hover:text-hazard">{r.projectName}</Link> },
    { key: "i", header: "Billed / incurred", align: "right", cell: (r) => <Money value={r.incurred} /> },
    { key: "pd", header: "Paid", align: "right", cell: (r) => <Money value={r.paid} /> },
    { key: "b", header: "Pending", align: "right", cell: (r) => (r.pending < 0 ? <span className="text-indigo">Advance <Money value={-r.pending} /></span> : <Money value={r.pending} className="font-bold" />) },
  ];
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/vendors" className="hover:text-ink">Vendors / Contractors</Link>}
        title={v.name}
        actions={
          <>
            {active ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>}
            {can(actor, "master.write") ? <VendorButton vendor={v} /> : null}
            {can(actor, "record.void") ? <VoidButton endpoint={`/api/vendors/${v.id}/status`} extra={{ status: active ? "INACTIVE" : "ACTIVE" }} label={active ? "Deactivate" : "Activate"} title={active ? "Deactivate vendor" : "Activate vendor"} message={active ? "They stop appearing in pickers. Their past records stay." : "They appear in pickers again."} success="Saved" variant={active ? "destructive" : "secondary"} confirmTone={active ? "destructive" : "primary"} /> : null}
          </>
        }
        cells={[
          { label: "Type", value: VENDOR_TYPE_LABEL[v.type] },
          { label: "Contact", value: v.contactPerson ?? "—" },
          { label: "Phone", value: v.phone ?? "—" },
          { label: "GSTIN", value: v.gstin ?? "—" },
        ]}
      />
      {!active ? <Notice tone="ink" title="Inactive" className="mb-5">Reason: {v.statusReason}</Notice> : null}
      <div className="grid grid-cols-1 gap-5">
        <Panel title="Details">
          <DescriptionList rows={[{ label: "Address", value: v.address ?? "—" }]} />
        </Panel>
        {v.ledger ? (
          <section>
            <h2 className="label-technical mb-3 text-steel">Account by project</h2>
            <DataTable columns={ledgerCols} rows={v.ledger} rowKey={(r) => r.projectId} empty={<p className="body-sm text-steel">No bills or payments yet.</p>} />
          </section>
        ) : null}
        {txns ? (
          <section>
            <h2 className="label-technical mb-3 text-steel">Transactions</h2>
            <TransactionsTable rows={txns.rows} showProject showMoney={money} />
            <Pagination page={txns.page} pageCount={txns.pageCount} total={txns.total} pageSize={txns.pageSize} />
          </section>
        ) : null}
        {docs ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="label-technical text-steel">Documents</h2>
              {can(actor, "finance.write") ? <UploadDocumentButton entityType="vendor" entityId={v.id} label="Attach document" variant="secondary" /> : null}
            </div>
            <DocumentsTable rows={docs.rows} />
          </section>
        ) : null}
      </div>
    </>
  );
}
