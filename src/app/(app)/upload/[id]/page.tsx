import type { Metadata } from "next";
import Link from "next/link";
import { VoidButton } from "@/components/common/VoidButton";
import { ChecksList, type CheckRow } from "@/components/upload/ChecksList";
import { DraftReviewForm } from "@/components/upload/DraftReviewForm";
import { Chip } from "@/components/ui/Chip";
import { LinkButton } from "@/components/ui/LinkButton";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDateTime, todayIso } from "@/lib/dates";
import { DRAFT_STATUS_LABEL } from "@/lib/domain";
import { aiEnabled } from "@/server/ai";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { getDraft } from "@/server/services/drafts.service";
import { materialOptions } from "@/server/services/materials.service";
import { slabOptions } from "@/server/services/projects.service";
import { purchaseOrderOptions } from "@/server/services/stock.service";
import { vendorOptions } from "@/server/services/vendors.service";

export const metadata: Metadata = { title: "Review upload" };

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const d = await pageData(getDraft(actor, id));
  const [vendors, materials, slabs, pos] = await Promise.all([vendorOptions(actor), materialOptions(actor), slabOptions(actor, d.projectId), can(actor, "finance.read") ? purchaseOrderOptions(actor, d.projectId) : Promise.resolve([])]);
  const file = `/api/documents/${d.document.id}/file`;
  const checks = d.checks as CheckRow[];
  const failed = checks.filter((c) => c.status === "fail").length;
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/upload" className="hover:text-ink">Uploads · {d.project.name}</Link>}
        title={d.kind === "TRANSACTION" ? "Review bill" : "Review delivery challan"}
        actions={<><Chip tone={d.status === "PENDING" ? "hazard" : d.status === "CONFIRMED" ? "indigo" : "muted"}>{DRAFT_STATUS_LABEL[d.status]}</Chip>{d.status === "REJECTED" && can(actor, "draft.delete") ? <VoidButton endpoint={`/api/drafts/${d.id}`} method="DELETE" label="Delete draft" title="Delete this draft" message="Admin only. The draft is removed; the uploaded file is kept but archived." success="Draft deleted" redirectTo="/upload" /> : null}</>}
        cells={[
          { label: "File", value: d.document.title },
          { label: "Uploaded", value: `${formatDateTime(d.createdAt)} · ${d.createdByName}` },
          { label: "Read by", value: d.provider === "none" ? "Not read (manual)" : d.provider },
          { label: "Checks", value: checks.length ? `${checks.length - failed} of ${checks.length} pass` : "—" },
        ]}
      />
      {d.status === "PENDING" ? (
        <Notice tone="hazard" title="Not counted yet" className="mb-5">
          {d.readError ?? "Check the numbers against the document, fix anything wrong, then confirm. Nothing counts until you do."}
        </Notice>
      ) : d.status === "REJECTED" ? (
        <Notice tone="ink" title="Rejected" className="mb-5">
          Reason: {d.decisionReason}
        </Notice>
      ) : (
        <Notice tone="ink" title="Confirmed" className="mb-5">
          Confirmed {d.decidedAt ? formatDateTime(d.decidedAt) : ""}. The records it created show “AI” in lists.
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="grid grid-cols-1 content-start gap-5">
          <Panel title="Document" action={<LinkButton href={file} target="_blank" variant="ghost" size="sm">Open</LinkButton>}>
            {d.document.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- permission-checked file route
              <img src={file} alt="Uploaded document" className="block max-h-[60vh] w-full bg-canvas object-contain" />
            ) : (
              <object data={file} type="application/pdf" className="h-[60vh] w-full" aria-label="Uploaded PDF">
                <p className="body-sm p-4">
                  <a className="text-hazard" href={file} target="_blank" rel="noreferrer">
                    Open the PDF
                  </a>
                </p>
              </object>
            )}
          </Panel>
          <Panel title="Checks">
            <ChecksList checks={checks} />
          </Panel>
        </div>
        <DraftReviewForm draft={d} today={todayIso()} vendors={vendors} materials={materials} slabs={slabs} purchaseOrders={pos} canDelete={can(actor, "draft.delete") && d.status !== "CONFIRMED"} canReread={aiEnabled()} />
      </div>
    </>
  );
}
