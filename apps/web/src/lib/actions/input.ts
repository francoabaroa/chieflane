import type { SurfaceAction } from "@chieflane/surface-schema";

export const ACTION_BLOCK_INPUT_KEY = "blockInput";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function resolveActionExecutionInput(
  action: SurfaceAction,
  blockInput?: unknown
): Record<string, unknown> {
  const persistedInput =
    action.kind === "navigate" ? {} : { ...(action.input ?? {}) };

  if (!isRecord(blockInput) || Object.keys(blockInput).length === 0) {
    return persistedInput;
  }

  return {
    ...persistedInput,
    [ACTION_BLOCK_INPUT_KEY]: blockInput,
  };
}
