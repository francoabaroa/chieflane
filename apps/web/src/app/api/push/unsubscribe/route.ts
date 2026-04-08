import { NextRequest, NextResponse } from "next/server";
import { removePushSubscription } from "@/lib/push";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("endpoint" in body) ||
    typeof body.endpoint !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "Endpoint is required" },
      { status: 400 }
    );
  }

  removePushSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
