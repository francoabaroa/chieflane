"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { SurfaceAction } from "@chieflane/surface-schema";

export function ActionComposerSheet({
  action,
  open,
  submitting = false,
  errorMessage,
  onClose,
  onSubmit,
}: {
  action: SurfaceAction | null;
  open: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (input?: Record<string, unknown>) => Promise<void>;
}) {
  if (!open || !action || action.kind === "navigate") {
    return null;
  }

  return createPortal(
    <ActionComposerSheetContent
      key={action.id}
      action={action}
      submitting={submitting}
      errorMessage={errorMessage}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
    document.body
  );
}

function ActionComposerSheetContent({
  action,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: {
  action: Exclude<SurfaceAction, { kind: "navigate" }>;
  submitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (input?: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const spec = action.inputSpec;
  const hasInput = Boolean(spec);
  const mode = spec?.mode ?? "textarea";
  const label = spec?.label ?? "Note";
  const trimmedValue = value.trim();

  const handleSubmit = async () => {
    if (spec?.required && !trimmedValue) {
      setError(`${label} is required.`);
      return;
    }

    await onSubmit(hasInput ? { note: trimmedValue } : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-composer-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/30"
        aria-label="Close action composer"
        onClick={onClose}
      />
      <div className="safe-area-bottom absolute inset-x-0 bottom-0 border-t border-border bg-base p-4 shadow-[0_-16px_40px_rgba(0,0,0,0.16)] rounded-t-lg md:left-1/2 md:max-w-md md:-translate-x-1/2 md:border-x">
        <div className="mb-3">
          <h3
            id="action-composer-title"
            className="text-sm font-semibold text-text-primary"
          >
            {action.label}
          </h3>
        </div>

        {hasInput ? (
          <label className="block">
            <span className="mb-1.5 block text-[0.75rem] font-medium text-text-secondary">
              {label}
            </span>
            {mode === "text" ? (
              <input
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                placeholder={spec?.placeholder}
                maxLength={spec?.maxLength}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            ) : (
              <textarea
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                placeholder={spec?.placeholder}
                maxLength={spec?.maxLength}
                className="min-h-28 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            )}
          </label>
        ) : null}

        {error || errorMessage ? (
          <p className="mt-2 text-[0.75rem] text-critical" role="alert">
            {error ?? errorMessage}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md border border-border px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Sending..." : spec?.submitLabel ?? action.label}
          </button>
        </div>
      </div>
    </div>
  );
}
