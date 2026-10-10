import type { Metadata } from "next";
import Link from "next/link";
import { VoidButton } from "@/components/common/VoidButton";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Panel } from "@/components/ui/Panel";
import { ProgressRule } from "@/components/ui/ProgressRule";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDate, formatDateShort } from "@/lib/dates";
import { ACTIVITY_STATUS_LABEL, PHASE_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { listDocuments } from "@/server/services/documents.service";
import { getActivity } from "@/server/services/progress.service";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const a = await pageData(getActivity(actor, id));
  const docs = await listDocuments(actor, { entityType: "activity", entityId: a.id });
  type H = (typeof a.history)[number];
  const cols: Column<H>[] = [
    { key: "d", header: "Date", cell: (r) => formatDateShort(r.date) },
    { key: "p", header: "Progress", cell: (r) => <ProgressRule value={r.progress} className="min-w-32" /> },
    { key: "n", header: "Note", cell: (r) => r.note ?? "—" },
    { key: "b", header: "By", cell: (r) => r.byName },
  ];
  const archived = a.status === "ARCHIVED";
  return (
    <>
      <TitleBlock
        eyebrow={<Link href={`/projects/${a.projectId}?tab=progress`} className="hover:text-ink">Work & progress</Link>}
        title={a.name}
        actions={
          <>
            <Chip tone={archived ? "muted" : a.status === "COMPLETED" ? "indigo" : "hazard"}>{ACTIVITY_STATUS_LABEL[a.status]}</Chip>
            {archived && can(actor, "record.void") ? <VoidButton endpoint={`/api/activities/${a.id}/archive`} extra={{ archived: false }} label="Restore" title="Restore activity" message="It counts towards phase progress again." success="Activity restored" variant="secondary" confirmTone="primary" /> : null}
          </>
        }
        cells={[
          { label: "Phase", value: PHASE_LABEL[a.phase] },
          { label: "Progress", value: `${a.progress}%` },
          { label: "Planned", value: `${formatDate(a.plannedStart)} → ${formatDate(a.plannedEnd)}` },
          { label: "Status note", value: a.statusReason ?? "—" },
        ]}
      />
      <div className="grid grid-cols-1 gap-5">
        <Panel title="Progress">
          <div className="p-4">
            <ProgressRule value={a.progress} />
          </div>
          <DescriptionList rows={[{ label: "Edit or update", value: <Link className="text-hazard" href={`/projects/${a.projectId}?tab=progress`}>From the project&apos;s Work &amp; progress tab</Link> }]} />
        </Panel>
        <section>
          <h2 className="label-technical mb-3 text-steel">Updates</h2>
          <DataTable columns={cols} rows={a.history} rowKey={(r) => r.id} empty={<p className="body-sm text-steel">No updates yet.</p>} />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="label-technical text-steel">Photos</h2>
            {!archived && can(actor, "field.write") ? <UploadDocumentButton entityType="activity" entityId={a.id} kind="PHOTO" label="Add photo" variant="secondary" /> : null}
          </div>
          <DocumentsTable rows={docs.rows} />
        </section>
      </div>
    </>
  );
}
