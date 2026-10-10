import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { Actor } from "../auth/actor";
import { requireActor } from "../auth/session";
import { type ErrorEnvelope, toAppError } from "../errors";

export interface RouteContext<P> {
  req: NextRequest;
  actor: Actor;
  params: P;
}

type Handler<P> = (ctx: RouteContext<P>) => Promise<unknown>;

/**
 * The one wrapper every API route uses: resolves async params, requires a session,
 * returns { ok: true, data } or the error envelope { ok: false, error }.
 */
export function route<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      const actor = await requireActor();
      const params = (await ctx.params) ?? ({} as P);
      const data = await handler({ req, actor, params });
      if (data instanceof Response) return data;
      return NextResponse.json({ ok: true, data: data ?? null });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Same envelope, no session required (login). */
export function publicRoute(handler: (req: NextRequest) => Promise<unknown>) {
  return async (req: NextRequest) => {
    try {
      const data = await handler(req);
      if (data instanceof Response) return data;
      return NextResponse.json({ ok: true, data: data ?? null });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  const appErr = toAppError(err);
  if (appErr.code === "INTERNAL") console.error(err);
  const body: ErrorEnvelope = { ok: false, error: { code: appErr.code, message: appErr.message, fields: appErr.fields } };
  return NextResponse.json(body, { status: appErr.status });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function searchParamsObject(req: NextRequest): Record<string, string> {
  return Object.fromEntries(req.nextUrl.searchParams.entries());
}
