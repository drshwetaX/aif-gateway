import { NextRequest, NextResponse } from "next/server";
import {
  getCookieName,
  isExpiredNow,
  isEmailAllowed,
  tryDecodeSession,
} from "./lib/demoAuthEdge";

// ⚠️ Dev / preview convenience only
// NEVER leave this true in prod unless you want open access
const BYPASS_LOGIN = process.env.NODE_ENV !== "production";

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
  "/api/foundry",   // server-to-server (Bearer auth inside handler)
];

export function middleware(req: NextRequest) {
  // 🔓 Dev/preview bypass
  if (BYPASS_LOGIN) return NextResponse.next();

  const { pathname } = req.nextUrl;

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

  // Demo expired → force login
  if (isExpiredNow()) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("expired", "1");
    url.searchParams.set("next", pathname); // 🔥 critical
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
    url.searchParams.set("next", pathname); // 🔥 critical
    return NextResponse.redirect(url);
  }

  // Optional allowlist enforcement at Edge
  const hasEdgeAllowlist =
    !!process.env.DEMO_ALLOWED_EMAILS ||
    !!process.env.DEMO_ALLOWED_DOMAINS;

  if (hasEdgeAllowlist && !isEmailAllowed(session.email)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "not_allowlisted");
    url.searchParams.set("next", pathname);
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
