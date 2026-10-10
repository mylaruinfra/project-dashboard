import { readJson, route } from "@/server/http/route";
import { createTransaction } from "@/server/services/transactions.service";

export const POST = route(async ({ req, actor }) => createTransaction(actor, await readJson(req)));
