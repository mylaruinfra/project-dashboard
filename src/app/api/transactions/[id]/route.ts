import { readJson, route } from "@/server/http/route";
import { updateTransaction } from "@/server/services/transactions.service";

export const PUT = route<{ id: string }>(async ({ req, actor, params }) => updateTransaction(actor, params.id, await readJson(req)));
