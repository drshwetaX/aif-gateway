/**
 * Author: Dr Shweta Shah
 * Date: 2026-01-27
 * Purpose: Enforce allowlisted access across the demo (public link, private access).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCookieName, isExpiredNow, verifySession } from "./lib/auth/demoAuth";

const PUBLIC = new Set(["/login", "/api/auth/login", "/api/health"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) return NextResponse.next();
  if (PUBLIC.has(pathname)) return NextResponse.next();

  if (isExpiredNow()) {
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

  const res = NextResponse.next();
  res.headers.set("x-demo-user", session.email);
  return res;
}

export const config = { matcher: ["/((?!.*\\..*).*)"] };
