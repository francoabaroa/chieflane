import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    db.prepare("select 1 as ok").get();

    return NextResponse.json({
      ok: true,
      service: "chieflane",
      db: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      {
        ok: false,
        service: "chieflane",
        error: "internal_error",
      },
      { status: 500 }
    );
  }
}
