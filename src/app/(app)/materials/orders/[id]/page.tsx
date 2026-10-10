import type { Metadata } from "next";
import Link from "next/link";
import { History } from "@/components/common/History";
import { VoidButton } from "@/components/common/VoidButton";
import { PurchaseOrderButton } from "@/components/materials/PurchaseOrderButton";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { Money } from "@/components/ui/Money";
import { Notice } from "@/components/ui/Notice";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDate, todayIso } from "@/lib/dates";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { denyUnless, pageData } from "@/server/http/page";
import { materialOptions } from "@/server/services/materials.service";
import { projectOptions } from "@/server/services/projects.service";
import { getPurchaseOrder } from "@/server/services/stock.service";
import { vendorOptions } from "@/server/services/vendors.service";

export const metadata: Metadata = { title: "Purchase order" };

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  denyUnless(can(actor, "finance.read"));
  const po = await pageData(getPurchaseOrder(actor, id));
  const [projects, materials, vendors] = await Promise.all([projectOptions(actor), materialOptions(actor), vendorOptions(actor)]);
  type L = (typeof po.lines)[number];
  const cols: Column<L>[] = [
    { key: "m", header: "Material", cell: (l) => l.name },
    { key: "q", header: "Ordered", align: "right", cell: (l) => `${formatQty(l.qty)} ${l.unit}` },
    { key: "r", header: "Received", align: "right", cell: (l) => `${formatQty(l.received)} ${l.unit}` },
    { key: "rate", header: "Rate", align: "right", cell: (l) => <Money value={l.rate} /> },
    { key: "amt", header: "Amount", align: "right", cell: (l) => <Money value={l.amount} /> },
  ];
  const write = can(actor, "finance.write");
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/materials?tab=orders" className="hover:text-ink">Purchase orders</Link>}
        title={po.number}
        actions={
          <>
            <Chip tone={po.status === "OPEN" ? "hazard" : po.status === "VOID" ? "error" : "muted"}>{po.status === "OPEN" ? "Open" : po.status === "VOID" ? "Void" : "Closed"}</Chip>
            {po.status === "OPEN" && write ? <PurchaseOrderButton projects={projects} materials={materials} vendors={vendors} today={todayIso()} po={po} /> : null}
            {po.status === "OPEN" && write ? <VoidButton endpoint={`/api/purchase-orders/${po.id}/status`} extra={{ status: "CLOSED" }} label="Close" title="Close purchase order" message="No more deliveries can be linked to it." success="Purchase order closed" variant="secondary" confirmTone="primary" /> : null}
            {po.status === "CLOSED" && write ? <VoidButton endpoint={`/api/purchase-orders/${po.id}/status`} extra={{ status: "OPEN" }} label="Reopen" title="Reopen purchase order" message="Deliveries can be linked to it again." success="Purchase order reopened" variant="secondary" confirmTone="primary" /> : null}
            {po.status !== "VOID" && can(actor, "record.void") ? <VoidButton endpoint={`/api/purchase-orders/${po.id}/status`} extra={{ status: "VOID" }} label="Void" title="Void purchase order" message="It stays on record but no longer counts as ordered. Its number can be reused." success="Purchase order voided" /> : null}
          </>
        }
        cells={[
          { label: "Project", value: po.projectName },
          { label: "Vendor", value: po.vendorName },
          { label: "Date", value: formatDate(po.date) },
          { label: "Total", value: <Money value={po.total} /> },
        ]}
      />
      {po.status === "VOID" ? <Notice tone="error" title="This purchase order is void" className="mb-5">Reason: {po.statusReason}</Notice> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
        <div>
          <DataTable columns={cols} rows={po.lines} rowKey={(l) => l.id} />
          {po.notes ? <p className="body-md mt-3 text-steel">{po.notes}</p> : null}
        </div>
        <History rows={po.history} />
      </div>
    </>
  );
}
