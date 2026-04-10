import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  getAllSurfaces,
  getTotalSurfaceCount,
  getUserSurfaceCount,
} from "@/lib/db/surfaces";
import { isAuthorizedDebugRequest } from "@/lib/auth/debug";
import { findRepoRoot } from "@/lib/repo-root";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorizedDebugRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const totalActiveSurfaces = getAllSurfaces().length;
  const totalSurfaces = getTotalSurfaceCount();
  const totalUserSurfaces = getUserSurfaceCount();
  const currentStatusPath = path.join(
    findRepoRoot(),
    ".chieflane",
    "current-status.json"
  );
  const currentStatusRaw = await fs
    .readFile(currentStatusPath, "utf8")
    .then((body) => JSON.parse(body) as unknown)
    .catch(() => ({} as unknown));
  const currentStatus =
    currentStatusRaw != null && typeof currentStatusRaw === "object"
      ? (currentStatusRaw as Record<string, unknown>)
      : {};

  const bootstrap =
    currentStatus.bootstrap != null && typeof currentStatus.bootstrap === "object"
      ? (currentStatus.bootstrap as Record<string, unknown>)
      : null;
  const verify =
    currentStatus.verify != null && typeof currentStatus.verify === "object"
      ? (currentStatus.verify as Record<string, unknown>)
      : null;

  return NextResponse.json({
    ok: true,
    totalActiveSurfaces,
    totalSurfaces,
    totalUserSurfaces,
    setupHealthy: bootstrap?.ok === true && verify?.ok === true,
    bootstrap,
    verify,
  });
}
