import { z } from "zod";
import { readJson, route } from "@/server/http/route";
import { createActivity } from "@/server/services/progress.service";

export const POST = route(async ({ req, actor }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const { projectId } = z.object({ projectId: z.uuid() }).parse(body);
  return createActivity(actor, projectId, body);
});
