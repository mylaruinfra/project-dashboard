/** Option lists the transaction and stock forms need, loaded once per page. */
import type { Actor } from "../auth/actor";
import { aiEnabled } from "../ai";
import { materialOptions } from "./materials.service";
import { projectOptions } from "./projects.service";
import { listLaborRates } from "./settings.service";
import { vendorOptions } from "./vendors.service";

export async function txnFormOptions(actor: Actor) {
  const [projects, vendors, materials, laborRates] = await Promise.all([projectOptions(actor), vendorOptions(actor), materialOptions(actor), listLaborRates(actor)]);
  return { projects, vendors, materials, laborRates, role: actor.role, aiEnabled: aiEnabled() };
}

export type TxnFormOptionsData = Awaited<ReturnType<typeof txnFormOptions>>;
