import { and, eq, ne } from "drizzle-orm";
import { formatINRCompact } from "@/lib/money";
import type { Actor } from "../auth/actor";
import { getDb } from "../db/client";
import { clients, projects } from "../db/schema";
import { canSeeMoney } from "../permissions";
import { pendingDraftCount } from "./drafts.service";
import { kpisForProjects } from "./kpis";
import { nextActivityFor, phaseProgressFor } from "./progress.service";
import { projectScopeFilter } from "./scope";

export interface AttentionItem {
  id: string;
  tone: "hazard" | "ink";
  title: string;
  detail: string;
  href: string;
  action: string;
}

export async function getDashboard(actor: Actor) {
  const db = getDb();
  const money = canSeeMoney(actor);
  const sites = await db
    .select({ id: projects.id, name: projects.name, code: projects.code, status: projects.status, latitude: projects.latitude, clientName: clients.name })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(await projectScopeFilter(actor, projects.id), ne(projects.status, "ARCHIVED"), ne(projects.status, "COMPLETED")));
  const ids = sites.map((s) => s.id);
  const [progress, kpis, nextByProject] = await Promise.all([phaseProgressFor(db, ids), money ? kpisForProjects(db, ids) : Promise.resolve(null), nextActivityFor(db, ids)]);

  const attention: AttentionItem[] = [];
  const drafts = await pendingDraftCount(actor);
  if (drafts > 0) {
    attention.push({ id: "drafts", tone: "hazard", title: `${drafts} upload${drafts > 1 ? "s" : ""} waiting for review`, detail: "Bills and challans read by AI do not count until someone confirms them.", href: "/upload", action: "Review" });
  }
  for (const s of sites.filter((x) => x.latitude === null)) {
    attention.push({ id: `gps-${s.id}`, tone: "ink", title: `Set the site location for ${s.name}`, detail: "GPS is not set yet. Add it from the site or type it in.", href: `/projects/${s.id}?tab=overview`, action: "Add location" });
  }
  if (kpis) {
    for (const s of sites) {
      const k = kpis.get(s.id)!;
      if (k.estimatedCost > 0 && k.actualCost > k.estimatedCost) {
        attention.push({ id: `over-${s.id}`, tone: "hazard", title: `${s.name} is over the estimate`, detail: `Actual cost ${formatINRCompact(k.actualCost)} against ${formatINRCompact(k.estimatedCost)} estimated.`, href: `/projects/${s.id}?tab=budget`, action: "See budget" });
      }
    }
  }

  const totals = kpis
    ? [...kpis.values()].reduce(
        (a, k) => ({ spent: a.spent + k.actualCost, budget: a.budget + k.estimatedCost, owe: a.owe + k.pendingPayments, clientsOwe: a.clientsOwe + Math.max(0, k.clientBalance) }),
        { spent: 0, budget: 0, owe: 0, clientsOwe: 0 },
      )
    : null;

  return {
    attention: attention.slice(0, 6),
    totals,
    sites: sites.map((s) => {
      return { ...s, progress: progress.get(s.id)?.overall ?? 0, next: nextByProject.get(s.id) ?? null };
    }),
  };
}
