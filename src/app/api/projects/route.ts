import { readJson, route } from "@/server/http/route";
import { createProject } from "@/server/services/projects.service";

export const POST = route(async ({ req, actor }) => createProject(actor, await readJson(req)));
