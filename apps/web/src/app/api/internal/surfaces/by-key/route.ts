import { NextRequest, NextResponse } from "next/server";
import { getSurfaceByKey } from "@/lib/db/surfaces";
import { authorizeInternalRequest } from "@/lib/auth/internal";

export async function GET(req: NextRequest) {
  const authError = authorizeInternalRequest(req);
  if (authError) {
    return authError;
  }

  const surfaceKey = req.nextUrl.searchParams.get("surfaceKey")?.trim();
  if (!surfaceKey) {
    return NextResponse.json(
      { ok: false, error: "surfaceKey is required" },
      { status: 400 }
    );
  }

  const surface = getSurfaceByKey(surfaceKey);
  if (!surface) {
    return NextResponse.json(
      { ok: false, error: "Surface not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(surface);
}
