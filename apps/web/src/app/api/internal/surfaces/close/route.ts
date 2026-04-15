import { NextRequest, NextResponse } from "next/server";
import { surfaceCloseRequestSchema } from "@chieflane/surface-schema";
import { closeSurface } from "@/lib/db/surfaces";
import { fanoutEvent } from "@/lib/realtime";
import { authorizeInternalRequest } from "@/lib/auth/internal";
import { sendSurfaceNotification } from "@/lib/push";

function isSurfaceNotFoundError(err: unknown) {
  return err instanceof Error && err.message.startsWith("Surface not found:");
}

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

  const parsed = surfaceCloseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const surface = closeSurface(
      parsed.data.surfaceKey,
      parsed.data.finalStatus ?? "archived"
    );
    fanoutEvent({
      type: "surface.closed",
      surfaceId: surface.id,
      version: surface.version,
      data: {
        lane: surface.lane,
        status: surface.status,
        surface,
      },
    });
    try {
      await sendSurfaceNotification(surface, "surface.closed");
    } catch (err) {
      console.error("Non-fatal surface close notification failure", err);
    }

    return NextResponse.json({
      ok: true,
      surfaceId: surface.id,
      surfaceKey: surface.surfaceKey,
      version: surface.version,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: isSurfaceNotFoundError(err) ? 404 : 500 }
    );
  }
}
