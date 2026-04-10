import { NextRequest, NextResponse } from "next/server";
import { surfacePatchRequestSchema } from "@chieflane/surface-schema";
import { formatSurfaceValidationError } from "@chieflane/surface-schema/errors";
import { patchSurface } from "@/lib/db/surfaces";
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

  const parsed = surfacePatchRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: formatSurfaceValidationError({
          tool: "surface_patch",
          error: parsed.error,
          input: body,
        }),
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  try {
    const surface = patchSurface(parsed.data.surfaceKey, parsed.data.patch);
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
      console.error("Non-fatal surface patch notification failure", err);
    }

    return NextResponse.json({
      ok: true,
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
