import type { Metadata } from "next";
import { QueryFilters } from "@/components/common/QueryFilters";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadDocumentButton } from "@/components/documents/UploadDocumentButton";
import { Pagination } from "@/components/ui/Pagination";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { DOC_KIND_LABEL, DOC_KINDS } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { listDocuments } from "@/server/services/documents.service";
import { projectOptions } from "@/server/services/projects.service";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const [data, projects] = await Promise.all([listDocuments(actor, sp), projectOptions(actor)]);
  const kinds = DOC_KINDS.filter((k) => can(actor, "finance.read") || (k !== "BILL" && k !== "AGREEMENT"));
  const uploadKinds = DOC_KINDS.filter((k) => can(actor, "finance.write") || (k !== "BILL" && k !== "AGREEMENT"));
  return (
    <>
      <TitleBlock eyebrow="Register" title="Documents" cells={[{ label: "Showing", value: `${data.total}` }, { label: "Attach to", value: "Any record" }]} actions={can(actor, "field.write") ? <UploadDocumentButton projects={projects} allowedKinds={uploadKinds} /> : null} />
      <QueryFilters
        filters={[
          { kind: "select", name: "projectId", label: "Project", options: projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" },
          { kind: "select", name: "kind", label: "Kind", options: kinds.map((k) => ({ value: k, label: DOC_KIND_LABEL[k] })), placeholder: "All kinds" },
          { kind: "select", name: "status", label: "Status", options: [{ value: "ARCHIVED", label: "Archived" }, { value: "ALL", label: "All" }], placeholder: "Active" },
        ]}
      />
      <DocumentsTable rows={data.rows} showProject />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
