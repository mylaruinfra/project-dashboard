import type { Metadata } from "next";
import { SearchBox } from "@/components/common/SearchBox";
import { StatusFilter } from "@/components/common/StatusFilter";
import { ProjectStatusChip } from "@/components/projects/ProjectStatusChip";
import { Chip } from "@/components/ui/Chip";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { Money } from "@/components/ui/Money";
import { Pagination } from "@/components/ui/Pagination";
import { ProgressRule } from "@/components/ui/ProgressRule";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can, canSeeMoney } from "@/lib/access";
import { formatDate } from "@/lib/dates";
import { PROJECT_TYPE_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { listProjects } from "@/server/services/projects.service";

export const metadata: Metadata = { title: "Projects" };

type Row = Awaited<ReturnType<typeof listProjects>>["rows"][number];

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const actor = await requirePageActor();
  const data = await listProjects(actor, sp);
  const money = canSeeMoney(actor);

  const cols: Column<Row>[] = [
    {
      key: "name",
      header: "Project",
      cell: (r) => (
        <span className="block min-w-36">
          {r.name}
          <span className="label-code block text-steel">{r.code}</span>
        </span>
      ),
    },
    { key: "client", header: "Client", cell: (r) => r.clientName },
    { key: "status", header: "Status", cell: (r) => <span className="flex gap-1"><ProjectStatusChip status={r.status} />{r.gpsMissing ? <Chip tone="hazard">No GPS</Chip> : null}</span> },
    { key: "type", header: "Type", cell: (r) => PROJECT_TYPE_LABEL[r.type] },
    { key: "progress", header: "Progress", cell: (r) => <ProgressRule value={r.progress} className="min-w-36" /> },
    { key: "dates", header: "Dates", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.startDate)} → {formatDate(r.expectedCompletion)}</span> },
  ];
  if (money) {
    cols.push(
      { key: "est", header: "Estimated", align: "right", cell: (r) => <Money value={r.kpis?.estimatedCost} compact /> },
      { key: "act", header: "Actual", align: "right", cell: (r) => <Money value={r.kpis?.actualCost} compact /> },
    );
  }

  return (
    <>
      <TitleBlock eyebrow="Register" title="Projects" cells={[{ label: "Showing", value: `${data.total} projects` }]} actions={can(actor, "project.write") ? <LinkButton href="/projects/new">New project</LinkButton> : null} />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBox placeholder="Search name or code" />
        <StatusFilter
          basePath="/projects"
          current={sp.status ?? "ACTIVE_ALL"}
          params={{ q: sp.q }}
          options={[
            { value: "ACTIVE_ALL", label: "Active" },
            { value: "COMPLETED", label: "Completed" },
            { value: "ARCHIVED", label: "Archived" },
            { value: "ALL", label: "All" },
          ]}
        />
      </div>
      <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/projects/${r.id}`} empty={<EmptyState title="No projects here" body={actor.role === "ENGINEER" ? "You are not assigned to any project yet." : "Create one with the New project button."} />} />
      <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
    </>
  );
}
