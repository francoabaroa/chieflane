"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SetupStatus = {
  ok: boolean;
  totalActiveSurfaces: number;
  totalSurfaces: number;
  totalUserSurfaces: number;
  setupHealthy: boolean;
};

export function FirstRunEmptyState({
  lane,
  fallbackMessage,
}: {
  lane: string;
  fallbackMessage: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/debug/setup-status", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`setup-status failed (${response.status})`);
        }
        const body = (await response.json()) as SetupStatus;
        if (active) {
          setStatus(body);
        }
      } catch {
        if (active) {
          setStatus(null);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const showFirstRun =
    status?.setupHealthy === true &&
    status.totalActiveSurfaces === 0 &&
    status.totalUserSurfaces === 0;

  const publish = () => {
    void (async () => {
      setIsPublishing(true);
      setError(null);
      try {
        const response = await fetch("/api/debug/publish-test-surface", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ lane }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: unknown }
            | null;
          throw new Error(
            typeof body?.error === "string"
              ? body.error
              : `publish-test-surface failed (${response.status})`
          );
        }
        router.refresh();
      } catch (publishError) {
        setError(
          publishError instanceof Error
            ? publishError.message
            : "Could not publish the test surface."
        );
      } finally {
        setIsPublishing(false);
      }
    })();
  };

  if (!showFirstRun) {
    return (
      <div className="flex flex-col items-start px-4 py-16 md:py-20 animate-fade-in">
        <p className="text-[0.875rem] text-text-secondary font-medium">
          {fallbackMessage}
        </p>
        <p className="text-[0.75rem] text-text-tertiary mt-1 max-w-[40ch] leading-relaxed">
          Surfaces appear here when your agent publishes work.
        </p>
      </div>
    );
  }

  return (
    <section className="animate-fade-in px-4 py-10 md:px-6 md:py-14">
      <div className="max-w-[44rem]">
        <div className="mb-4 h-px w-20 bg-accent/70" />
        <h2 className="font-[family-name:var(--font-display)] text-[1.4rem] leading-tight text-text-primary md:text-[1.9rem]">
          No surfaces yet. That is normal until an agent, cron job, or manual test publishes one.
        </h2>
        <p className="mt-3 max-w-[52ch] text-[0.875rem] leading-relaxed text-text-secondary">
          Publish one demo surface to confirm the shell is wired correctly, then leave the lanes to your normal workflows.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={publish}
            disabled={isPublishing}
            className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-accent bg-accent px-4 text-[0.8125rem] font-medium text-white hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
          >
            {isPublishing ? "Publishing..." : "Publish test surface"}
          </button>
          <a
            href="https://github.com/francoabaroa/chieflane#fastest-zero-assumption-local-setup"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-border bg-surface px-4 text-[0.8125rem] font-medium text-text-primary hover:bg-surface-hover"
          >
            Open setup docs
          </a>
        </div>
        {error ? (
          <p className="mt-3 text-[0.75rem] text-critical">{error}</p>
        ) : null}
      </div>
    </section>
  );
}
