import { notFound } from "@/server/errors";
import { readJson, route } from "@/server/http/route";
import { updateBasics, updateBuilding, updateEstimate, updateSite } from "@/server/services/projects.service";

const SECTIONS = { basics: updateBasics, site: updateSite, building: updateBuilding, estimate: updateEstimate } as const;

/** PUT /api/projects/:id/(basics|site|building|estimate) — one wizard section at a time. */
export const PUT = route<{ id: string; section: string }>(async ({ req, actor, params }) => {
  const fn = SECTIONS[params.section as keyof typeof SECTIONS];
  if (!fn) throw notFound("Section");
  return fn(actor, params.id, await readJson(req));
});
