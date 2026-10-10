import type { Metadata } from "next";
import Link from "next/link";
import { History } from "@/components/common/History";
import { VoidButton } from "@/components/common/VoidButton";
import { EditDocumentButton } from "@/components/documents/EditDocumentButton";
import { Chip } from "@/components/ui/Chip";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { LinkButton } from "@/components/ui/LinkButton";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDateTime } from "@/lib/dates";
import { DOC_KIND_LABEL, DOC_KINDS } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { getDocument } from "@/server/services/documents.service";

export const metadata: Metadata = { title: "Document" };

const ENTITY_HREF: Record<string, (id: string) => string> = {
  project: (id) => `/projects/${id}`,
  transaction: (id) => `/transactions/${id}`,
  receipt: (id) => `/materials/deliveries/${id}`,
  usage: (id) => `/materials/usage/${id}`,
  purchase_order: (id) => `/materials/orders/${id}`,
  activity: (id) => `/progress/activities/${id}`,
  vendor: (id) => `/vendors/${id}`,
  client: (id) => `/clients/${id}`,
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const d = await pageData(getDocument(actor, id));
  const file = `/api/documents/${d.id}/file`;
  const archived = d.status === "ARCHIVED";
  const moneyKind = d.kind === "BILL" || d.kind === "AGREEMENT";
  const canEdit = !archived && can(actor, moneyKind ? "finance.write" : "field.write");
  const kinds = DOC_KINDS.filter((k) => can(actor, "finance.write") || (k !== "BILL" && k !== "AGREEMENT"));
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/documents" className="hover:text-ink">Documents</Link>}
        title={d.title}
        actions={
          <>
            <Chip tone={d.kind === "PHOTO" ? "indigo" : "muted"}>{DOC_KIND_LABEL[d.kind]}</Chip>
            {canEdit ? <EditDocumentButton doc={d} allowedKinds={kinds} /> : null}
            <LinkButton href={`${file}?download=1`} variant="secondary" size="sm">
              Download
            </LinkButton>
            {can(actor, "record.void") ? <VoidButton endpoint={`/api/documents/${d.id}/archive`} extra={{ archived: !archived }} label={archived ? "Restore" : "Archive"} title={archived ? "Restore document" : "Archive document"} message={archived ? "It shows in lists again." : "It is hidden from lists but kept as evidence. Nothing is deleted."} success="Saved" variant={archived ? "secondary" : "destructive"} confirmTone={archived ? "primary" : "destructive"} /> : null}
          </>
        }
        cells={[
          { label: "Uploaded", value: formatDateTime(d.createdAt) },
          { label: "By", value: d.uploadedByName },
          { label: "File", value: d.fileName },
          { label: "Attached to", value: d.entityType && d.entityId ? <Link className="text-hazard" href={ENTITY_HREF[d.entityType]?.(d.entityId) ?? "#"}>{d.entityType.replace("_", " ")}</Link> : "—" },
        ]}
      />
      {archived ? <Notice tone="ink" title="Archived" className="mb-5">Reason: {d.statusReason}</Notice> : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
        <Panel title="Preview">
          {d.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element -- permission-checked file route
            <img src={file} alt={d.caption ?? d.title} className="block max-h-[70vh] w-full bg-canvas object-contain" />
          ) : (
            <div className="p-4">
              <object data={file} type="application/pdf" className="hidden h-[70vh] w-full md:block" aria-label={d.title} />
              <LinkButton href={file} variant="secondary" target="_blank" className="md:hidden">
                Open PDF
              </LinkButton>
            </div>
          )}
          {d.caption ? <DescriptionList rows={[{ label: "Caption", value: d.caption }]} /> : null}
        </Panel>
        <History rows={d.history} />
      </div>
    </>
  );
}
