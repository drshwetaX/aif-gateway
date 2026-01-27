/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-26
 * Purpose: Require allowlisted login for all routes except /login and auth endpoints.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCookieName, isDemoExpiredNow, verifySession } from "./lib/demoAuth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/health",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow next internals / static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Hard expiry: force everyone to login page
  if (isDemoExpiredNow()) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("expired", "1");
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get(getCookieName())?.value || "";
  const secret = process.env.DEMO_AUTH_SECRET || "";
  const session = secret ? verifySession(token, secret) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Useful identity propagation: API routes can read x-demo-user
  const res = NextResponse.next();
  res.headers.set("x-demo-user", session.email);
  return res;
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
