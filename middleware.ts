/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Enforce allowlisted access across the demo (public link, private access).
 * Notes:
 * - OpenAPI spec must be publicly accessible for Microsoft Foundry / Copilot tool import
 *   because the importer fetches the schema server-to-server (no cookies).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCookieName, isExpiredNow, verifySession } from "./lib/demoAuth";

// Public UI/auth routes (no session required)
const PUBLIC = new Set(["/login", "/api/auth/login", "/api/health"]);

// Public API routes needed for integrations/importers (no session required)
const PUBLIC_PATHS = [
  "/api/health",
   "/api/openapi", 
  "/api/openapi.json", // ✅ needed for Foundry OpenAPI tool import
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip Next.js internals + static assets
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // ✅ Bypass auth for public API paths (must come BEFORE session checks)
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

  // Verify session cookie
  const token = req.cookies.get(getCookieName())?.value || "";
  const secret = process.env.DEMO_AUTH_SECRET || "";
  const session = secret ? verifySession(token, secret) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Success → pass request through and add a helpful header for logs
  const res = NextResponse.next();
  res.headers.set("x-demo-user", session.email);
  return res;
}

// Apply middleware to all routes except static files (good default)
export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
