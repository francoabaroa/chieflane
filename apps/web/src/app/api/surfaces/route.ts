import { NextRequest, NextResponse } from "next/server";
import { getSurfacesByLane, getAllSurfaces, getSurfaceById } from "@/lib/db/surfaces";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lane = req.nextUrl.searchParams.get("lane");
  const id = req.nextUrl.searchParams.get("id");

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
