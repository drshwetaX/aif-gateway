import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const cookieName = process.env.DEMO_COOKIE_NAME || "aif_demo_auth";

  const { pathname } = req.nextUrl;

  // Allow public paths
  const PUBLIC = [
    "/login",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/health",
  ];

  // Always allow Next internals + static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // If no password is configured, don't block (useful for local dev)
  if (!process.env.DEMO_PASSWORD) {
    return NextResponse.next();
  }

  const authed = req.cookies.get(cookieName)?.value === "1";
  if (authed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/:path*"],
};
