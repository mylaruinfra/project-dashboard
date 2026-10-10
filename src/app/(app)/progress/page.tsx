import type { Metadata } from "next";
import Link from "next/link";
import { QueryFilters } from "@/components/common/QueryFilters";
import { ActivityBoard } from "@/components/progress/ActivityBoard";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ProgressRule } from "@/components/ui/ProgressRule";
import { Tabs } from "@/components/ui/Tabs";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDateShort, todayIso } from "@/lib/dates";
import { PHASE_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { listActivities, listProgressUpdates, listProjectProgress } from "@/server/services/progress.service";
import { projectOptions, slabOptions } from "@/server/services/projects.service";

export const metadata: Metadata = { title: "Work & Progress" };

export default async function ProgressPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [sp, actor] = await Promise.all([searchParams, requirePageActor()]);
  const projects = await projectOptions(actor);
  const projectId = sp.projectId && projects.some((p) => p.id === sp.projectId) ? sp.projectId : undefined;
  const tab = sp.tab === "updates" ? "updates" : "board";

  return (
    <>
      <TitleBlock eyebrow="Site" title="Work & progress" cells={[{ label: "Phases", value: "Excavation · Civil · Interior" }]} />
      <Tabs
        active={tab}
        items={[
          { key: "board", label: "Phases & activities", href: `/progress?tab=board${projectId ? `&projectId=${projectId}` : ""}` },
          { key: "updates", label: "Daily updates", href: `/progress?tab=updates${projectId ? `&projectId=${projectId}` : ""}` },
        ]}
      />
      <QueryFilters filters={[{ kind: "select", name: "projectId", label: "Project", options: projects.map((p) => ({ value: p.id, label: p.name })), placeholder: "All projects" }]} />
      {!projects.length ? <EmptyState title="No projects" body="You are not assigned to any project." /> : null}
      {tab === "board" && projects.length && !projectId ? await (async () => {
        const data = await listProjectProgress(actor, { page: sp.page });
        type R = (typeof data.rows)[number];
        const pct = (n: number) => <ProgressRule value={n} className="min-w-24" />;
        const cols: Column<R>[] = [
          { key: "p", header: "Project", cell: (r) => r.name },
          { key: "x", header: "Excavation", cell: (r) => pct(r.progress.EXCAVATION) },
          { key: "c", header: "Civil", cell: (r) => pct(r.progress.CIVIL) },
          { key: "i", header: "Interior", cell: (r) => pct(r.progress.INTERIOR) },
          { key: "o", header: "Overall", cell: (r) => pct(r.progress.overall) },
          { key: "n", header: "Next activity", cell: (r) => (r.next ? <>{r.next.name}{r.next.date ? <span className="body-sm block text-steel">{formatDateShort(r.next.date)}</span> : null}</> : "—") },
        ];
        return (
          <>
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} rowHref={(r) => `/progress?tab=board&projectId=${r.id}`} empty={<EmptyState title="No projects" />} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}
      {tab === "board" && projectId ? await (async () => {
        const [acts, slabs] = await Promise.all([listActivities(actor, projectId), slabOptions(actor, projectId)]);
        return <ActivityBoard projectId={projectId} phases={acts.phases} progress={acts.progress} slabs={slabs} canWrite={can(actor, "field.write")} canArchive={can(actor, "record.void")} today={todayIso()} />;
      })() : null}
      {tab === "updates" ? await (async () => {
        const data = await listProgressUpdates(actor, { page: sp.page, projectId });
        type R = (typeof data.rows)[number];
        const cols: Column<R>[] = [
          { key: "d", header: "Date", cell: (r) => formatDateShort(r.date) },
          { key: "a", header: "Activity", cell: (r) => <Link href={`/progress/activities/${r.activityId}`} className="hover:text-hazard">{r.activityName}<span className="body-sm block text-steel">{r.projectName} · {PHASE_LABEL[r.phase]}</span></Link> },
          { key: "p", header: "Progress", cell: (r) => <ProgressRule value={r.progress} className="min-w-32" /> },
          { key: "n", header: "Note", cell: (r) => r.note ?? "—" },
          { key: "b", header: "By", cell: (r) => r.byName },
        ];
        return (
          <>
            <DataTable columns={cols} rows={data.rows} rowKey={(r) => r.id} empty={<EmptyState title="No progress updates yet" />} />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} pageSize={data.pageSize} />
          </>
        );
      })() : null}
    </>
  );
}
