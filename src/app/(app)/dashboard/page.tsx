import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCell } from "@/components/ui/KpiCell";
import { KpiStrip } from "@/components/ui/KpiStrip";
import { LinkButton } from "@/components/ui/LinkButton";
import { Money } from "@/components/ui/Money";
import { Notice } from "@/components/ui/Notice";
import { ProgressRule } from "@/components/ui/ProgressRule";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { TitleBlock } from "@/components/ui/TitleBlock";
import { can } from "@/lib/access";
import { formatDate, formatDateShort, todayIso } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/domain";
import { requirePageActor } from "@/server/auth/session";
import { getDashboard } from "@/server/services/dashboard.service";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const d = await getDashboard(actor);

  return (
    <>
      <TitleBlock
        eyebrow="Owner home"
        title={`Hello, ${actor.name.split(" ")[0]}`}
        cells={[
          { label: "Date", value: formatDate(todayIso()) },
          { label: "Role", value: ROLE_LABEL[actor.role] },
          { label: "Active sites", value: d.sites.length },
          { label: "Needs attention", value: d.attention.length },
        ]}
        actions={can(actor, "project.write") ? <LinkButton href="/projects/new">New project</LinkButton> : can(actor, "field.write") ? <LinkButton href="/upload">Upload challan</LinkButton> : null}
      />

      <div className="space-y-10">
        <section>
          <SectionLabel tone="hazard">Attention needed</SectionLabel>
          {d.attention.length ? (
            <div className="space-y-px bg-hairline">
              {d.attention.map((a) => (
                <Notice key={a.id} tone={a.tone} title={a.title} action={<LinkButton href={a.href} variant={a.tone === "hazard" ? "primary" : "secondary"} size="sm" full>{a.action}</LinkButton>}>
                  {a.detail}
                </Notice>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing needs you right now" body="Uploads waiting for review, missing site locations and cost overruns show up here." />
          )}
        </section>

        {d.totals ? (
          <section>
            <SectionLabel>Money overview</SectionLabel>
            <KpiStrip columns={3}>
              <KpiCell label="Spent" value={<Money value={d.totals.spent} compact />} sub={<>Out of <Money value={d.totals.budget} compact /> estimated</>} />
              <KpiCell label="We owe" tone="hazard" value={<Money value={d.totals.owe} compact />} sub="Unpaid vendor and labor bills" />
              <KpiCell label="Clients owe us" value={<Money value={d.totals.clientsOwe} compact />} sub="Contract value minus money received" />
            </KpiStrip>
          </section>
        ) : null}

        <section>
          <SectionLabel action={<Link href="/projects" className="label-technical inline-flex min-h-11 items-center text-steel hover:text-ink">All projects</Link>}>Active sites</SectionLabel>
          {d.sites.length ? (
            <ul className="divide-y divide-hairline border border-hairline bg-paper">
              {d.sites.map((s) => (
                <li key={s.id}>
                  <Link href={`/projects/${s.id}`} className="group flex flex-col gap-3 p-4 hover:bg-surface-low lg:flex-row lg:items-center lg:gap-6">
                    <div className="min-w-0 lg:w-1/4">
                      <p className="font-display text-base font-bold group-hover:text-hazard">{s.name}</p>
                      <p className="label-code text-steel">
                        {s.code} · {s.clientName}
                      </p>
                    </div>
                    <ProgressRule value={s.progress} label={`${s.name} progress`} className="lg:w-2/5" />
                    <div className="flex items-center justify-between gap-4 body-sm text-steel lg:flex-1">
                      <span className="min-w-0 truncate">
                        <span className="text-steel">Next:</span>{" "}
                        <span className="font-medium text-ink">{s.next ? `${s.next.name}${s.next.date ? ` (${formatDateShort(s.next.date)})` : ""}` : "No open activities"}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 group-hover:text-ink" aria-hidden />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No active sites" body={actor.role === "ENGINEER" ? "Ask a manager to assign you to a project." : "Create your first project to get started."} action={can(actor, "project.write") ? <LinkButton href="/projects/new">New project</LinkButton> : undefined} />
          )}
        </section>
      </div>
    </>
  );
}
