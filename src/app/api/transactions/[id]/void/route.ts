import { readJson, route } from "@/server/http/route";
import { voidTransaction } from "@/server/services/transactions.service";

export const POST = route<{ id: string }>(async ({ req, actor, params }) => voidTransaction(actor, params.id, await readJson(req)));
