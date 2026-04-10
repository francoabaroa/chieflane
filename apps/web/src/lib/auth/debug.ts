import type { NextRequest } from "next/server";
import {
  AUTH_COOKIE_NAME,
  isAppAuthEnabled,
  isValidSessionToken,
} from "./app";

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  );
}

export function isAuthorizedDebugRequest(req: NextRequest) {
  const internalApiKey = process.env.SHELL_INTERNAL_API_KEY;
  if (
    internalApiKey &&
    req.headers.get("authorization") === `Bearer ${internalApiKey}`
  ) {
    return true;
  }

  if (isAppAuthEnabled()) {
    const session = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    return isValidSessionToken(session);
  }

  return (
    process.env.NODE_ENV !== "production" &&
    isLoopbackHostname(req.nextUrl.hostname)
  );
}
