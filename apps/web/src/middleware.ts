import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  isAppAuthEnabled,
  isValidSessionToken,
} from "@/lib/auth/app";

const PUBLIC_PATHS = [
  "/login",
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/manifest.json",
  "/sw.js",
  "/apple-icon",
];

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/api/internal/")
  );
}

function withCacheScope(response: NextResponse, scope: "public" | "private") {
  response.headers.set("x-chieflane-cache-scope", scope);
  return response;
}

export function middleware(req: NextRequest) {
  if (!isAppAuthEnabled() || isPublicPath(req.nextUrl.pathname)) {
    return withCacheScope(NextResponse.next(), "public");
  }

  const session = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (isValidSessionToken(session)) {
    return withCacheScope(NextResponse.next(), "private");
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return withCacheScope(
      NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
      "private"
    );
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return withCacheScope(NextResponse.redirect(loginUrl), "private");
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
