"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SurfaceAction } from "@chieflane/surface-schema";
import { runSurfaceAction } from "@/lib/actions/client";
import { useActionProgressStore } from "@/lib/client/action-progress-store";
import { ActionComposerSheet } from "./ActionComposerSheet";
import { Loader2 } from "lucide-react";

const STYLE_CLASSES: Record<string, string> = {
  primary:
    "bg-accent text-white font-semibold hover:bg-accent-hover",
  secondary:
    "bg-surface text-text-primary border border-border hover:bg-surface-hover",
  ghost:
    "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
  danger:
    "bg-critical-muted text-critical border border-critical/20 hover:bg-critical/10",
};

export function ActionBar({
  actions,
  surfaceId,
  onAction,
  embedded = false,
}: {
  actions: SurfaceAction[];
  surfaceId: string;
  onAction?: (
    action: SurfaceAction,
    input?: Record<string, unknown>
  ) => Promise<void>;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [composerAction, setComposerAction] = useState<SurfaceAction | null>(
    null
  );
  const progress = useActionProgressStore(
    (state) => state.bySurfaceId[surfaceId]
  );

  if (!actions.length) return null;

  const executeAction = async (
    action: SurfaceAction,
    blockInput?: Record<string, unknown>
  ) => {
    if (loading) return;

    if (action.kind === "navigate") {
      const route = action.route || (action.surfaceId ? `/surface/${action.surfaceId}` : null);
      if (route) router.push(route);
      return;
    }

    if (action.kind === "mutation" || action.kind === "agent") {
      const confirmText = action.confirmText;
      if (confirmText && !window.confirm(confirmText)) return false;
    }

    setLoading(action.id);
    try {
      if (onAction) {
        await onAction(action, blockInput);
      } else {
        const result = await runSurfaceAction(surfaceId, action, blockInput);
        setMessage(result.message ?? null);
      }
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const handleClick = async (action: SurfaceAction) => {
    if (action.kind !== "navigate" && action.inputSpec) {
      setComposerAction(action);
      return;
    }

    await executeAction(action);
  };

  const progressMessage = (() => {
    if (!progress) {
      return message;
    }

    if (progress.status === "failed") {
      return progress.text ?? "Action failed";
    }

    if (progress.status === "completed") {
      return progress.text ?? message ?? "Done";
    }

    return progress.text ?? "Updating...";
  })();

  return (
    <div
      className={`border-t border-border bg-base px-4 py-3 ${
        embedded
          ? "sticky bottom-0"
          : "fixed left-0 right-0 z-40 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:relative md:bottom-auto"
      }`}
    >
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const isLoading = loading === action.id;
          return (
            <button
              key={action.id}
              onClick={() => handleClick(action)}
              disabled={Boolean(loading)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-md px-4 py-2 text-[0.8125rem] transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                STYLE_CLASSES[action.style ?? "secondary"]
              } disabled:opacity-50`}
            >
              {isLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {action.label}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-[0.75rem] text-text-tertiary">
        {progressMessage}
      </p>
      <ActionComposerSheet
        action={composerAction}
        open={Boolean(composerAction)}
        submitting={Boolean(loading)}
        onClose={() => setComposerAction(null)}
        onSubmit={async (input) => {
          if (!composerAction) {
            return;
          }
          const ok = await executeAction(composerAction, input);
          if (ok) {
            setComposerAction(null);
          }
        }}
      />
    </div>
  );
}
