import { route } from "@/server/http/route";
import { removeMember } from "@/server/services/projects.service";

/** Removes an assignment (configuration, not a financial record). */
export const DELETE = route<{ id: string; userId: string }>(async ({ actor, params }) => removeMember(actor, params.id, params.userId));
