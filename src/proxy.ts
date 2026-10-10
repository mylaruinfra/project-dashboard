import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/server/auth/jwt";

/**
 * Next.js 16 proxy (formerly middleware): a fast first gate. Pages without a valid session
 * go to /login; API routes get a 401 envelope. Real permission checks live in the services.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");
  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout") || pathname === "/api/health";

  if (pathname === "/login" && session) return NextResponse.redirect(new URL("/dashboard", req.url));
  if (isPublic || session) return NextResponse.next();
  if (isApi) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again." } }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
