import { NextRequest, NextResponse } from "next/server";
import { getCookieName, isExpiredNow, isEmailAllowed, tryDecodeSession } from "./lib/demoAuthEdge";

const BYPASS_LOGIN = process.env.NODE_ENV !== "production";

const PUBLIC = new Set(["/login", "/api/auth/login", "/api/health"]);

const PUBLIC_PATHS = [
  "/api/health",
  "/api/openapi",
  "/api/openapi.json",
  "/api/run",
  "/api/foundry",
];

export function middleware(req: NextRequest) {
  if (BYPASS_LOGIN) return NextResponse.next();

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (PUBLIC.has(pathname)) {
    return NextResponse.next();
  }

  if (isExpiredNow()) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("expired", "1");
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get(getCookieName())?.value || "";
  const session = tryDecodeSession(token);

  // ✅ Require a valid session (login API already enforces allowlist + password)
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "no_session");
    return NextResponse.redirect(url);
  }

  // ✅ Only enforce allowlist at Edge if allowlist env vars are present there
  const hasEdgeAllowlist =
    !!process.env.DEMO_ALLOWED_EMAILS || !!process.env.DEMO_ALLOWED_DOMAINS;

  if (hasEdgeAllowlist && !isEmailAllowed(session.email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "not_allowlisted");
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("x-demo-user", session.email);
  return res;
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
