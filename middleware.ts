import { NextRequest, NextResponse } from "next/server";
import { getCookieName, isExpiredNow, isEmailAllowed, tryDecodeSession } from "./lib/demoAuthEdge";

// ✅ Set true to bypass login (DO NOT leave true in a shared/prod demo)
const BYPASS_LOGIN = true;

// Public UI/auth routes (no session required)
const PUBLIC = new Set(["/login", "/api/auth/login", "/api/health"]);

// Public API routes needed for integrations/importers (no session required)
const PUBLIC_PATHS = [
  "/api/health",
  "/api/openapi",
  "/api/openapi.json",
  "/api/run",
];

export function middleware(req: NextRequest) {
  // ✅ One-and-only bypass switch
  if (BYPASS_LOGIN) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Skip Next.js internals + static assets
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Bypass auth for public API paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Bypass auth for public UI/auth routes
  if (PUBLIC.has(pathname)) {
    return NextResponse.next();
  }

  // Expired demo window → redirect to login
  if (isExpiredNow()) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("expired", "1");
    return NextResponse.redirect(url);
  }

  // Edge-safe session decode
  const token = req.cookies.get(getCookieName())?.value || "";
  const session = tryDecodeSession(token);

  // Allowlist enforcement
  if (!session || !isEmailAllowed(session.email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  res.headers.set("x-demo-user", session.email);
  return res;
}


export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
