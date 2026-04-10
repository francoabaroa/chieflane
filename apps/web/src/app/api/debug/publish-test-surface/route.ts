import { NextRequest, NextResponse } from "next/server";
import { buildPublishTestSurfaceInput } from "@chieflane/surface-schema/demo-surface";
import { isAuthorizedDebugRequest } from "@/lib/auth/debug";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAuthorizedDebugRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const lane =
    body != null &&
    typeof body === "object" &&
    typeof (body as { lane?: unknown }).lane === "string"
      ? (body as { lane: string }).lane
      : "today";

  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "OpenClaw gateway is not configured for publish-test-surface.",
      },
      { status: 503 }
    );
  }

  const publishArgs = buildPublishTestSurfaceInput(lane);
  const response = await fetch(`${gatewayUrl}/tools/invoke`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${gatewayToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      tool: "surface_publish",
      action: "json",
      args: publishArgs,
      sessionKey: "main",
      dryRun: false,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: await response.text(),
      },
      { status: response.status }
    );
  }

  const result = (await response.json()) as { ok?: boolean; error?: unknown };
  if (result.ok === false) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    surfaceKey: publishArgs.surfaceKey,
  });
}
