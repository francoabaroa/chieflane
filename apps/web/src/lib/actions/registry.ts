import { statusSchema, type StoredSurface } from "@chieflane/surface-schema";
import { closeSurface, patchSurface } from "@/lib/db/surfaces";
import { fanoutEvent } from "@/lib/realtime";

export type ActionResult = {
  ok: boolean;
  message?: string;
  output?: Record<string, unknown>;
};

export type ShellActionHandler = (args: {
  surface: StoredSurface;
  input: Record<string, unknown>;
}) => Promise<ActionResult>;

type ActionDefinition =
  | {
      kind: "shell";
      description: string;
      handler: ShellActionHandler;
    }
  | {
      kind: "agent";
      description: string;
      instruction: string;
    };

function broadcastSurfaceUpdate(surface: StoredSurface) {
  fanoutEvent({
    type: "surface.updated",
    surfaceId: surface.id,
    version: surface.version,
    data: {
      lane: surface.lane,
      status: surface.status,
      surface,
    },
  });
}

function broadcastSurfaceClose(surface: StoredSurface) {
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
}

function updateSurfaceStatus(surface: StoredSurface, status: StoredSurface["status"]) {
  if (status === "done") {
    const closed = closeSurface(surface.surfaceKey, "done");
    broadcastSurfaceClose(closed);
    return closed;
  }

  const updated = patchSurface(surface.surfaceKey, { status });
  broadcastSurfaceUpdate(updated);
  return updated;
}

export const actionRegistry: Record<string, ActionDefinition> = {
  refresh_surface: {
    kind: "agent",
    description: "Refresh a surface with the latest context and sources.",
    instruction:
      "Refresh the current surface with the latest relevant context and preserve the same surfaceKey when updating it.",
  },
  open_board_deck: {
    kind: "agent",
    description: "Open and review the board deck workstream.",
    instruction:
      "Review the board deck workstream, gather missing dependencies, and update or create the appropriate shell surfaces.",
  },
  process_queue_item: {
    kind: "agent",
    description: "Process the highest-value queue item.",
    instruction:
      "Process the most urgent queue item shown on this surface. Update the current queue surface and create any follow-up surfaces that improve review or execution.",
  },
  generate_talking_notes: {
    kind: "agent",
    description: "Generate succinct talking notes for a meeting.",
    instruction:
      "Generate concise talking notes for the meeting and patch this meeting surface with the notes or a supporting draft surface if needed.",
  },
  draft_followup_email: {
    kind: "agent",
    description: "Draft the appropriate follow-up email.",
    instruction:
      "Draft the appropriate follow-up email, keep sending gated for review, and publish or patch the relevant composer surface.",
  },
  regenerate_draft: {
    kind: "agent",
    description: "Regenerate a communication draft variant.",
    instruction:
      "Regenerate the draft while preserving intent, recipients, and provenance. Patch the current composer surface instead of duplicating it when possible.",
  },
  followup_reference: {
    kind: "agent",
    description: "Follow up on a missing reference or outreach thread.",
    instruction:
      "Prepare the follow-up needed for this reference or outreach thread and update the relevant draft or queue surface.",
  },
  draft_offer: {
    kind: "agent",
    description: "Draft an offer package or related outreach.",
    instruction:
      "Prepare the offer-related draft or packet, keep it in review state, and update the related meeting, review, or draft surface.",
  },
  apply_kaizen: {
    kind: "agent",
    description: "Apply or plan a kaizen recommendation.",
    instruction:
      "Apply the approved kaizen recommendation when it is safe to do so, otherwise turn it into a concrete tracked surface update with clear next steps.",
  },
  approve_and_send: {
    kind: "agent",
    description: "Approve and send a reviewed communication or action.",
    instruction:
      "Complete the approved action, then patch the current surface to reflect the outcome and archive it if it no longer needs attention.",
  },
  complete_surface_canonical: {
    kind: "agent",
    description:
      "Mark this task complete in the canonical task system and close the linked surface.",
    instruction: [
      "The user completed this work from the Chieflane UI.",
      "Update the canonical task source if one exists.",
      "If no external task source exists, update the normal workspace task source or memory.",
      "Then patch or close this exact surfaceKey.",
      "Prefer closing the current surface rather than creating duplicates.",
    ].join("\n"),
  },
  message_openclaw_about_surface: {
    kind: "agent",
    description:
      "Send a user note about the current surface to OpenClaw and update the linked workflow.",
    instruction: [
      "The user submitted a live note from Chieflane about this surface.",
      "Use the note to update the canonical workflow or task system.",
      "Patch this surface or create one follow-up surface only if needed.",
    ].join("\n"),
  },
  mark_blocked_canonical: {
    kind: "agent",
    description:
      "Mark the canonical work item blocked and reflect it in this surface.",
    instruction: [
      "The user marked this work item blocked from Chieflane.",
      "Update the canonical task source if one exists.",
      "Patch this surface to blocked and add the user note if provided.",
    ].join("\n"),
  },
  archive_surface: {
    kind: "shell",
    description: "Archive a surface locally.",
    handler: async ({ surface }) => {
      const archived = closeSurface(surface.surfaceKey, "archived");
      broadcastSurfaceClose(archived);
      return { ok: true, message: `Archived ${surface.surfaceKey}` };
    },
  },
  archive: {
    kind: "shell",
    description: "Archive a surface locally.",
    handler: async ({ surface }) => {
      const archived = closeSurface(surface.surfaceKey, "archived");
      broadcastSurfaceClose(archived);
      return { ok: true, message: `Archived ${surface.surfaceKey}` };
    },
  },
  dismiss: {
    kind: "shell",
    description: "Dismiss a surface locally.",
    handler: async ({ surface }) => {
      const archived = closeSurface(surface.surfaceKey, "archived");
      broadcastSurfaceClose(archived);
      return { ok: true, message: `Dismissed ${surface.surfaceKey}` };
    },
  },
  mark_done: {
    kind: "shell",
    description: "Mark a surface as done.",
    handler: async ({ surface }) => {
      updateSurfaceStatus(surface, "done");
      return { ok: true, message: `Marked ${surface.surfaceKey} as done` };
    },
  },
  set_status: {
    kind: "shell",
    description: "Set a surface status.",
    handler: async ({ surface, input }) => {
      const parsed = statusSchema.safeParse(input.status);
      if (!parsed.success) {
        throw new Error("Invalid status");
      }

      updateSurfaceStatus(surface, parsed.data);
      return { ok: true, message: `Status updated to ${parsed.data}` };
    },
  },
};

export function getActionDefinition(actionKey: string) {
  return actionRegistry[actionKey];
}
