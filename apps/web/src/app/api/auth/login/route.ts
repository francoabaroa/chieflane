import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getAuthCookieOptions,
  isAppAuthEnabled,
} from "@/lib/auth/app";
import { getSafePostLoginRedirect } from "@/lib/auth/redirect";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  if (!isAppAuthEnabled()) {
    return NextResponse.json({ ok: false, error: "App auth is not enabled" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let body: { password?: string; next?: string } | null = null;

  if (contentType.includes("application/json")) {
    try {
      const parsed = await req.json();
      body = isRecord(parsed) ? parsed as { password?: string; next?: string } : null;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }
  }

  const password =
    contentType.includes("application/json")
      ? body?.password
      : (await req.formData()).get("password");

  if (typeof password !== "string" || password !== process.env.SHELL_APP_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Invalid password" },
      { status: 401 }
    );
  }

  const nextParam = req.nextUrl.searchParams.get("next") ?? body?.next ?? null;
  const redirectTarget = getSafePostLoginRedirect(nextParam);

  const response = NextResponse.json({ ok: true, redirectTo: redirectTarget });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createSessionToken(),
    ...getAuthCookieOptions(),
  });
  return response;
}
