import { route } from "@/server/http/route";
import { listActivities } from "@/server/services/progress.service";
import { slabOptions } from "@/server/services/projects.service";
import { purchaseOrderOptions } from "@/server/services/stock.service";
import { can } from "@/server/permissions";

/** Pickers that depend on the chosen project (slabs, open POs, activities). */
export const GET = route<{ id: string }>(async ({ actor, params }) => {
  const [slabs, activities] = await Promise.all([slabOptions(actor, params.id), listActivities(actor, params.id)]);
  const purchaseOrders = can(actor, "finance.read") ? await purchaseOrderOptions(actor, params.id) : [];
  return {
    slabs,
    purchaseOrders,
    activities: Object.values(activities.phases)
      .flat()
      .map((a) => ({ id: a.id, label: a.name, phase: a.phase })),
  };
});
