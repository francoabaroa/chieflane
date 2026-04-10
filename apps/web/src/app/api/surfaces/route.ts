import { NextRequest, NextResponse } from "next/server";
import {
  getSurfacesByLane,
  getAllSurfaces,
  getSurfaceById,
  getSurfaceByKey,
} from "@/lib/db/surfaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lane = req.nextUrl.searchParams.get("lane");
  const id = req.nextUrl.searchParams.get("id");
  const surfaceKey = req.nextUrl.searchParams.get("surfaceKey");

  if (surfaceKey) {
    const surface = getSurfaceByKey(surfaceKey);
    if (!surface) {
      return NextResponse.json(
        { error: "Surface not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(surface);
  }

  if (id) {
    const surface = getSurfaceById(id);
    if (!surface) {
      return NextResponse.json(
        { error: "Surface not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(surface);
  }

  const surfaces = lane ? getSurfacesByLane(lane) : getAllSurfaces();
  return NextResponse.json(surfaces);
}
