import { getDb, type Tx } from "./db/client";
import { toAppError } from "./errors";

/** Runs work in one DB transaction and maps database errors (unique, check) to AppError. */
export async function inTx<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await getDb().transaction(work);
  } catch (err) {
    const appErr = toAppError(err);
    if (appErr.code === "INTERNAL") throw err;
    throw appErr;
  }
}
