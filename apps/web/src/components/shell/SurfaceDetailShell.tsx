"use client";

import { useRouter } from "next/navigation";
import type { StoredSurface } from "@chieflane/surface-schema";
import {
  formatDateTime,
  formatRelativeTime,
  getSafeExternalHref,
} from "@chieflane/shared";
import { SurfaceRenderer } from "@/components/surfaces/SurfaceRenderer";
import { ActionBar } from "@/components/shell/ActionBar";
import { StatusChip } from "@/components/shell/StatusChip";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";

export function SurfaceDetailShell({
  surface,
  embedded = false,
}: {
  surface: StoredSurface;
  embedded?: boolean;
}) {
  const router = useRouter();

  return (
    <div
      className={`flex min-h-0 flex-col ${embedded ? "border-l border-border" : "min-h-screen"}`}
    >
      <div
        className={`${embedded ? "" : "sticky top-0"} z-20 border-b border-border bg-base`}
      >
        <div className="px-4 py-4 md:px-6 md:py-5">
          {!embedded && (
            <button
              onClick={() => router.back()}
              className="mb-4 inline-flex items-center gap-1.5 px-2 py-1 text-[0.75rem] font-medium text-text-secondary transition-colors hover:text-text-primary"
              type="button"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back</span>
            </button>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[1.5rem] md:text-[2rem] leading-[1.1] text-text-primary font-[family-name:var(--font-display)]">
                {surface.title}
              </h1>
              {surface.subtitle && (
                <p className="mt-1 text-[0.8125rem] text-text-tertiary">
                  {surface.subtitle}
                </p>
              )}
            </div>
            <StatusChip status={surface.status} />
          </div>

          <p className="mt-2 text-[0.875rem] text-text-secondary leading-relaxed max-w-[65ch]">
            {surface.summary}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.625rem] text-text-tertiary font-[family-name:var(--font-mono)] tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              {formatRelativeTime(surface.freshness.generatedAt)}
            </span>
            <span className="uppercase tracking-wider">
              {surface.payload.surfaceType}
            </span>
            <span>v{surface.version}</span>
            {surface.freshness.expiresAt && (
              <span>Expires {formatDateTime(surface.freshness.expiresAt)}</span>
            )}
          </div>
        </div>
      </div>

      <div className={`flex-1 px-4 py-5 md:px-6 ${embedded ? "pb-4" : "pb-24 md:pb-6"}`}>
        <SurfaceRenderer surface={surface} />

        {surface.sourceRefs.length > 0 && (
          <div className="mt-8 border-t border-border pt-5">
            <h3 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)]">
              Sources
            </h3>
            <div className="space-y-1.5">
              {surface.sourceRefs.map((ref, index) => {
                const safeHref = getSafeExternalHref(ref.href);

                return (
                  <div
                    key={`${ref.kind}-${ref.title}-${index}`}
                    className="flex items-baseline gap-2"
                  >
                    <span className="text-[0.625rem] uppercase tracking-wider text-text-tertiary font-[family-name:var(--font-mono)]">
                      {ref.kind}
                    </span>
                    {safeHref ? (
                      <a
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[0.8125rem] text-accent hover:underline"
                      >
                        {ref.title}
                        <ExternalLink size={10} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-[0.8125rem] text-text-secondary">
                        {ref.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ActionBar actions={surface.actions} surfaceId={surface.id} embedded={embedded} />
    </div>
  );
}
