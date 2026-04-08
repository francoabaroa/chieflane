import { NextRequest, NextResponse } from "next/server";
import { getSurfaceById, createActionRun, updateActionRun } from "@/lib/db/surfaces";
import { getActionDefinition } from "@/lib/actions/registry";
import { getActionKey } from "@/lib/actions/key";
import { resolveActionExecutionInput } from "@/lib/actions/input";
import { runAgentAction } from "@/lib/openclaw/client";
import { z } from "zod";

const actionRunRequestSchema = z.object({
  surfaceId: z.string().min(1),
  actionId: z.string().min(1),
  actionKey: z.string().min(1),
  blockInput: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = actionRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "surfaceId, actionId, and actionKey are required" },
      { status: 400 }
    );
  }

  const { surfaceId, actionId, actionKey, blockInput } = parsed.data;

  const surface = getSurfaceById(surfaceId);
  if (!surface) {
    return NextResponse.json(
      { ok: false, error: "Surface not found" },
      { status: 404 }
    );
  }

  const currentAction = surface.actions.find((action) => action.id === actionId);
  if (!currentAction) {
    return NextResponse.json(
      { ok: false, error: "Action is no longer available on this surface" },
      { status: 409 }
    );
  }

  const currentActionKey = getActionKey(currentAction);
  if (!currentActionKey || currentActionKey !== actionKey) {
    return NextResponse.json(
      { ok: false, error: "Action is stale. Refresh the surface and try again." },
      { status: 409 }
    );
  }

  const definition = getActionDefinition(currentActionKey);
  if (!definition) {
    return NextResponse.json(
      { ok: false, error: `Unknown action: ${currentActionKey}` },
      { status: 400 }
    );
  }

  const input = resolveActionExecutionInput(currentAction, blockInput);

  const actionRunId = createActionRun({
    surfaceId: surface.id,
    actionId,
    actionKey: currentActionKey,
    input,
  });

  try {
    updateActionRun({ id: actionRunId, status: "running" });

    const result =
      definition.kind === "shell"
        ? await definition.handler({ surface, input })
        : await runAgentAction({
            actionKey: currentActionKey,
            actionInstruction: definition.instruction,
            actionRunId,
            surface,
            input,
          });

    updateActionRun({
      id: actionRunId,
      status: "completed",
      output: result.output ?? null,
    });

    return NextResponse.json({
      actionRunId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";

    updateActionRun({
      id: actionRunId,
      status: "failed",
      errorText: message,
    });

    return NextResponse.json(
      { ok: false, actionRunId, error: message },
      { status: 500 }
    );
  }
}
