import type { Metadata } from "next";
import Link from "next/link";
import { VoidButton } from "@/components/common/VoidButton";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { ClientButton } from "@/components/parties/ClientButton";
import { ProjectStatusChip } from "@/components/projects/ProjectStatusChip";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Money } from "@/components/ui/Money";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/ui/Panel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { requirePageActor } from "@/server/auth/session";
import { pageData } from "@/server/http/page";
import { getClient } from "@/server/services/clients.service";
import { listDocuments } from "@/server/services/documents.service";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, actor] = await Promise.all([params, requirePageActor()]);
  const c = await pageData(getClient(actor, id));
  const money = canSeeMoney(actor);
  const docs = money ? await listDocuments(actor, { entityType: "client", entityId: c.id }) : null;
  const active = c.status === "ACTIVE";
  type P = (typeof c.projects)[number];
  const cols: Column<P>[] = [
    { key: "n", header: "Project", cell: (r) => r.name },
    { key: "s", header: "Status", cell: (r) => <ProjectStatusChip status={r.status} /> },
    ...(money
      ? [
          { key: "cv", header: "Contract value", align: "right" as const, cell: (r: P) => <Money value={r.kpis?.contractValue} /> },
          { key: "rc", header: "Received", align: "right" as const, cell: (r: P) => <Money value={r.kpis?.clientReceived} /> },
          { key: "b", header: "Balance", align: "right" as const, cell: (r: P) => <Money value={r.kpis?.clientBalance} className="font-bold" /> },
        ]
      : []),
  ];
  return (
    <>
      <TitleBlock
        eyebrow={<Link href="/clients" className="hover:text-ink">Clients</Link>}
        title={c.name}
        actions={
          <>
            {active ? <Chip tone="indigo">Active</Chip> : <Chip>Inactive</Chip>}
            {can(actor, "master.write") ? <ClientButton client={c} /> : null}
            {can(actor, "record.void") ? <VoidButton endpoint={`/api/clients/${c.id}/status`} extra={{ status: active ? "INACTIVE" : "ACTIVE" }} label={active ? "Deactivate" : "Activate"} title={active ? "Deactivate client" : "Activate client"} message={active ? "They cannot be picked for new projects. Existing projects are not changed." : "They can be picked again."} success="Saved" variant={active ? "destructive" : "secondary"} confirmTone={active ? "destructive" : "primary"} /> : null}
          </>
        }
        cells={[
          { label: "Contact", value: c.contactPerson ?? "—" },
          { label: "Phone", value: c.phone ?? "—" },
          { label: "Email", value: c.email ?? "—" },
          { label: "Projects", value: c.projects.length },
        ]}
      />
      {!active ? <Notice tone="ink" title="Inactive" className="mb-5">Reason: {c.statusReason}</Notice> : null}
      <div className="grid grid-cols-1 gap-5">
        <Panel title="Details">
          <DescriptionList rows={[{ label: "GSTIN", value: c.gstin ?? "—" }, { label: "Address", value: c.address ?? "—" }]} />
        </Panel>
        <section>
          <h2 className="label-technical mb-3 text-steel">Projects</h2>
          <DataTable columns={cols} rows={c.projects} rowKey={(r) => r.id} rowHref={(r) => `/projects/${r.id}`} empty={<p className="body-sm text-steel">No projects yet.</p>} />
        </section>
        {docs ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="label-technical text-steel">Documents</h2>
              {can(actor, "finance.write") ? <UploadDocumentButton entityType="client" entityId={c.id} label="Attach document" variant="secondary" /> : null}
            </div>
            <DocumentsTable rows={docs.rows} />
          </section>
        ) : null}
      </div>
    </>
  );
}
