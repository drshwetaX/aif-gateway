import { NextRequest, NextResponse } from "next/server";
import {
  getCookieName,
  isExpiredNow,
  isEmailAllowed,
  tryDecodeSession,
} from "./lib/demoAuthEdge";

// Only bypass login if you explicitly set DEMO_BYPASS_LOGIN=1
const BYPASS_LOGIN = process.env.DEMO_BYPASS_LOGIN === "1";

// Public UI/auth routes (no session required)
const PUBLIC = new Set([
  "/login",
  "/api/auth/login",
  "/api/health",
]);

// Public API routes that must never redirect to /login
const PUBLIC_PATHS = [
  "/api/health",
  "/api/openapi",
  "/api/openapi.json",
  "/api/foundry", // server-to-server (Bearer auth inside handler)
];

export function middleware(req: NextRequest) {
  if (BYPASS_LOGIN) return NextResponse.next();

  const { pathname, search } = req.nextUrl;

  // Skip Next.js internals & static assets
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Public APIs (no redirect, no cookies)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public UI routes
  if (PUBLIC.has(pathname)) {
    return NextResponse.next();
  }

  // Preserve full destination (path + query)
  const fullNext = `${pathname}${search || ""}`;

  // Demo expired → force login
  if (isExpiredNow()) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("expired", "1");
    url.searchParams.set("next", fullNext);
    return NextResponse.redirect(url);
  }

  // Decode session (edge-safe)
  const token = req.cookies.get(getCookieName())?.value || "";
  const session = tryDecodeSession(token);

  // No session → login + preserve destination
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "no_session");
    url.searchParams.set("next", fullNext);
    return NextResponse.redirect(url);
  }

  // Optional allowlist enforcement at Edge
  const hasEdgeAllowlist =
    !!process.env.DEMO_ALLOWED_EMAILS || !!process.env.DEMO_ALLOWED_DOMAINS;

  if (hasEdgeAllowlist && !isEmailAllowed(session.email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "not_allowlisted");
    url.searchParams.set("next", fullNext);
    return NextResponse.redirect(url);
  }

  // ✅ Auth success — pass through
  const res = NextResponse.next();
  res.headers.set("x-demo-user", session.email);
  return res;
}

// Apply to everything except static files
export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
