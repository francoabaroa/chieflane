import { NextRequest, NextResponse } from "next/server";

export function authorizeInternalRequest(req: NextRequest) {
  const apiKey = process.env.SHELL_INTERNAL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "SHELL_INTERNAL_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${apiKey}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  return null;
}
