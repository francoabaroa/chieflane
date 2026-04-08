import { NextRequest, NextResponse } from "next/server";
import { surfaceEnvelopeSchema } from "@chieflane/surface-schema";
import { upsertSurfaceByKey } from "@/lib/db/surfaces";
import { fanoutEvent } from "@/lib/realtime";
import { authorizeInternalRequest } from "@/lib/auth/internal";
import { sendSurfaceNotification } from "@/lib/push";

export async function POST(req: NextRequest) {
  const authError = authorizeInternalRequest(req);
  if (authError) {
    return authError;
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = surfaceEnvelopeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const surface = upsertSurfaceByKey(parsed.data);
  fanoutEvent({
    type: "surface.updated",
    surfaceId: surface.id,
    version: surface.version,
    data: {
      lane: surface.lane,
      status: surface.status,
    },
  });
  try {
    await sendSurfaceNotification(surface, "surface.updated");
  } catch (err) {
    console.error("Non-fatal surface publish notification failure", err);
  }

  return NextResponse.json({
    ok: true,
    surfaceId: surface.id,
    surfaceKey: surface.surfaceKey,
    version: surface.version,
  });
}
