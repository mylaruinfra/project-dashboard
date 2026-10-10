import type { Metadata } from "next";
import Link from "next/link";
import { History } from "@/components/common/History";
import { VoidButton } from "@/components/common/VoidButton";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { ReceiptButton } from "@/components/materials/ReceiptButton";
import { Chip } from "@/components/ui/Chip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDate, todayIso } from "@/lib/dates";
import { formatQty } from "@/lib/qty";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { listDocuments } from "@/server/services/documents.service";
import { materialOptions } from "@/server/services/materials.service";
import { projectOptions } from "@/server/services/projects.service";
import { getReceipt } from "@/server/services/stock.service";
import { vendorOptions } from "@/server/services/vendors.service";

export const metadata: Metadata = { title: "Delivery" };

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const r = await pageData(getReceipt(actor, id));
  const [docs, projects, materials, vendors] = await Promise.all([listDocuments(actor, { entityType: "receipt", entityId: r.id }), projectOptions(actor), materialOptions(actor), vendorOptions(actor)]);
  const active = r.status === "ACTIVE";
  return (
    <>
      <TitleBlock
        eyebrow={<Link href={`/materials?tab=deliveries&projectId=${r.projectId}`} className="hover:text-ink">Deliveries · {r.projectName}</Link>}
        title={`${formatQty(r.qty)} ${r.unit} ${r.materialName}`}
        actions={
          <>
            {r.status === "VOID" ? <Chip tone="error">Void</Chip> : <Chip tone="indigo">Received</Chip>}
            {active && can(actor, "field.write") ? <ReceiptButton projects={projects} materials={materials} vendors={vendors} today={todayIso()} receipt={r} /> : null}
            {active && can(actor, "record.void") ? <VoidButton endpoint={`/api/receipts/${r.id}/void`} label="Void" title="Void this delivery" message="Stock goes down by this quantity. Not allowed if the material is already used." success="Delivery voided" /> : null}
          </>
        }
        cells={[
          { label: "Date", value: formatDate(r.date) },
          { label: "Challan", value: r.challanNo ?? "—" },
          { label: "Vendor", value: r.vendorName ?? "—" },
          { label: "Recorded by", value: r.createdByName ?? "—" },
        ]}
      />
      {r.status === "VOID" ? <Notice tone="error" title="This delivery is void" className="mb-5">Reason: {r.voidReason}</Notice> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid grid-cols-1 gap-5">
          <Panel title="Details">
            <DescriptionList
              rows={[
                { label: "Material", value: r.materialName },
                { label: "Quantity", value: `${formatQty(r.qty)} ${r.unit}`, numeric: true },
                { label: "Vehicle", value: r.vehicleNo ?? "—" },
                { label: "Purchase order", value: r.poNumber ?? "—" },
                { label: "Source", value: r.source === "AI" ? "Read from challan by AI, confirmed by a person" : "Entered by hand" },
                { label: "Notes", value: r.notes ?? "—" },
              ]}
            />
          </Panel>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="label-technical text-steel">Challan and photos</h2>
              {active && can(actor, "field.write") ? <UploadDocumentButton entityType="receipt" entityId={r.id} allowedKinds={["CHALLAN", "PHOTO"]} label="Attach" variant="secondary" /> : null}
            </div>
            <DocumentsTable rows={docs.rows} />
          </section>
        </div>
        <History rows={r.history} />
      </div>
    </>
  );
}
