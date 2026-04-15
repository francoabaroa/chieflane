"use client";

import Link from "next/link";
import { useState } from "react";
import type { StoredSurface, SurfaceAction } from "@chieflane/surface-schema";
import { runSurfaceAction } from "@/lib/actions/client";
import { getQuickSurfaceActions } from "@/lib/actions/surface-actions";
import { useActionProgressStore } from "@/lib/client/action-progress-store";
import { ActionComposerSheet } from "./ActionComposerSheet";
import { Loader2 } from "lucide-react";

const QUICK_BUTTON_CLASSES: Record<string, string> = {
  primary:
    "border-accent/40 bg-accent-muted text-accent hover:bg-accent/10 hover:border-accent/60",
  secondary:
    "border-border bg-base text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  ghost:
    "border-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-primary",
  danger:
    "border-critical/20 bg-critical-muted text-critical hover:bg-critical/10",
};

export function CardQuickActions({ surface }: { surface: StoredSurface }) {
  const actions = getQuickSurfaceActions(surface);
  const [loading, setLoading] = useState<string | null>(null);
  const [composerAction, setComposerAction] = useState<SurfaceAction | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const progress = useActionProgressStore(
    (state) => state.bySurfaceId[surface.id]
  );

  if (!actions.length) {
    return null;
  }

  const executeAction = async (
    action: SurfaceAction,
    blockInput?: Record<string, unknown>
  ) => {
    if (loading || action.kind === "navigate") {
      return false;
    }

    if (action.confirmText && !window.confirm(action.confirmText)) {
      return false;
    }

    setErrorMessage(null);
    setLoading(action.id);
    try {
      await runSurfaceAction(surface.id, action, blockInput);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      setLoading(null);
    }
  };

  const handleAction = async (action: SurfaceAction) => {
    if (action.kind === "navigate") {
      return;
    }

    if (action.inputSpec) {
      setErrorMessage(null);
      setComposerAction(action);
      return;
    }

    await executeAction(action);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:gap-1.5">
      {actions.map((action) => {
        const isLoading = loading === action.id;
        const style = action.style ?? "secondary";

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => void handleAction(action)}
            disabled={Boolean(loading)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-[0.8125rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 md:min-h-8 md:px-2.5 md:text-[0.75rem] ${
              QUICK_BUTTON_CLASSES[style]
            }`}
          >
            {isLoading ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : null}
            {action.label}
          </button>
        );
      })}

      <Link
        href={`/surface/${surface.id}`}
        className="inline-flex min-h-[44px] items-center rounded-md border border-transparent px-3 text-[0.8125rem] font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent md:min-h-8 md:px-2.5 md:text-[0.75rem]"
      >
        More
      </Link>

      {progress?.status === "running" ? (
        <span className="ml-auto text-[0.6875rem] text-text-tertiary">
          Updating...
        </span>
      ) : null}

      {errorMessage && !composerAction ? (
        <p
          className="basis-full text-[0.75rem] leading-snug text-critical"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <ActionComposerSheet
        action={composerAction}
        open={Boolean(composerAction)}
        submitting={Boolean(loading)}
        errorMessage={errorMessage}
        onClose={() => {
          setComposerAction(null);
          setErrorMessage(null);
        }}
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
