import "server-only";
import { notFound, redirect } from "next/navigation";
import { AppError } from "../errors";

/** For server pages: NOT_FOUND → 404 page, FORBIDDEN → the no-access page. */
export async function pageData<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === "NOT_FOUND" || err.code === "VALIDATION") notFound();
      if (err.code === "FORBIDDEN") redirect("/no-access");
    }
    throw err;
  }
}

/** For pages a role must not open at all. */
export function denyUnless(allowed: boolean): void {
  if (!allowed) redirect("/no-access");
}
