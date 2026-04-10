import type { z } from "zod";
import { surfaceContracts } from "./contracts";

export function formatSurfaceValidationError(args: {
  tool: "surface_publish" | "surface_patch";
  error: z.ZodError;
  input: unknown;
}) {
  const inputObject =
    args.input != null && typeof args.input === "object"
      ? (args.input as Record<string, unknown>)
      : undefined;
  const payload =
    inputObject?.payload != null && typeof inputObject.payload === "object"
      ? (inputObject.payload as Record<string, unknown>)
      : undefined;
  const surfaceType =
    typeof payload?.surfaceType === "string" ? payload.surfaceType : undefined;
  const firstIssue = args.error.issues[0];
  const issuePath =
    firstIssue?.path.length != null && firstIssue.path.length > 0
      ? firstIssue.path.join(".")
      : "(unknown path)";

  if (
    args.tool === "surface_publish" &&
    surfaceType != null &&
    surfaceType in surfaceContracts
  ) {
    const contract =
      surfaceContracts[surfaceType as keyof typeof surfaceContracts];
    return [
      `Invalid ${args.tool} payload for surfaceType "${surfaceType}".`,
      `Expected a payload like { surfaceType: "${surfaceType}", data: ... }.`,
      `Required fields for ${surfaceType}: ${contract.requiredPaths.join(", ")}.`,
      `First error: ${issuePath} - ${firstIssue?.message ?? "invalid value"}.`,
    ].join(" ");
  }

  if (args.tool === "surface_publish") {
    return [
      "Invalid surface_publish payload.",
      'payload must be an object like { surfaceType: "brief", data: { headline, sections, metrics } }, not a string or arbitrary JSON shape.',
      `First error: ${issuePath} - ${firstIssue?.message ?? "invalid value"}.`,
    ].join(" ");
  }

  return [
    "Invalid surface_patch payload.",
    "patch must be a non-empty object with only valid updatable fields.",
    `First error: ${issuePath} - ${firstIssue?.message ?? "invalid value"}.`,
  ].join(" ");
}
