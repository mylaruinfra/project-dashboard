import type { Metadata } from "next";
import { StatusFilter } from "@/components/common/StatusFilter";
import { UploadForm } from "@/components/upload/UploadForm";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDateTime } from "@/lib/dates";
import { DRAFT_STATUS_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { aiEnabled } from "@/server/ai";
import { denyUnless } from "@/server/http/page";
import { listDrafts } from "@/server/services/drafts.service";
import { projectOptions } from "@/server/services/projects.service";

export const metadata: Metadata = { title: "Upload" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  denyUnless(can(actor, "project.read"));
  const [projects, drafts] = await Promise.all([projectOptions(actor), listDrafts(actor, sp)]);
  type R = (typeof drafts.rows)[number];
  const cols: Column<R>[] = [
    { key: "doc", header: "Upload", cell: (r) => <span className="block min-w-40">{r.documentTitle}<span className="body-sm block text-steel">{r.projectName}</span></span> },
    { key: "kind", header: "Kind", cell: (r) => <Chip tone={r.kind === "TRANSACTION" ? "hazard" : "indigo"}>{r.kind === "TRANSACTION" ? "Bill" : "Challan"}</Chip> },
    { key: "status", header: "Status", cell: (r) => <Chip tone={r.status === "PENDING" ? "hazard" : r.status === "CONFIRMED" ? "indigo" : "muted"}>{DRAFT_STATUS_LABEL[r.status]}</Chip> },
    { key: "checks", header: "Checks", cell: (r) => (r.readError ? <span className="body-sm text-steel">Manual entry</span> : r.failed ? <Chip tone="error">{r.failed} failed</Chip> : r.warned ? <Chip tone="hazard">{r.warned} to check</Chip> : <Chip tone="indigo">All pass</Chip>) },
    { key: "by", header: "Uploaded", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)} · {r.createdByName}</span> },
  ];
  return (
    <>
      <TitleBlock eyebrow="Inbox" title="Upload bill or challan" cells={[{ label: "AI reader", value: aiEnabled() ? "On" : "Off (manual entry)" }, { label: "Rule", value: "Nothing counts until confirmed" }]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
        {can(actor, "field.write") ? <UploadForm projects={projects} canBills={can(actor, "finance.write")} aiEnabled={aiEnabled()} /> : <div />}
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="label-technical text-steel">Drafts</h2>
            <StatusFilter basePath="/upload" current={sp.status ?? "PENDING"} options={[{ value: "PENDING", label: "Waiting" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "REJECTED", label: "Rejected" }, { value: "ALL", label: "All" }]} />
          </div>
          <DataTable columns={cols} rows={drafts.rows} rowKey={(r) => r.id} rowHref={(r) => `/upload/${r.id}`} empty={<EmptyState title="Nothing here" body="Uploaded bills and challans wait here until someone confirms or rejects them." />} />
          <Pagination page={drafts.page} pageCount={drafts.pageCount} total={drafts.total} pageSize={drafts.pageSize} />
        </section>
      </div>
    </>
  );
}
