"use client";

import { useRouter } from "next/navigation";
import type { StoredSurface } from "@chieflane/surface-schema";
import { SurfaceBlocksRenderer } from "@chieflane/surface-renderer-web";
import { runSurfaceAction } from "@/lib/actions/client";
import { BriefSurface } from "./BriefSurface";
import { QueueSurface } from "./QueueSurface";
import { ComposerSurface } from "./ComposerSurface";
import { PrepDebriefSurface } from "./PrepDebriefSurface";
import { DossierSurface } from "./DossierSurface";
import { BoardSurface } from "./BoardSurface";
import { DigestSurface } from "./DigestSurface";

export function SurfaceRenderer({ surface }: { surface: StoredSurface }) {
  const router = useRouter();
  const { payload } = surface;

  const handleBlockAction = async (
    actionId: string,
    blockInput?: Record<string, unknown>
  ) => {
    const action = surface.actions.find((item) => item.id === actionId);
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`);
    }

    if (action.kind === "navigate") {
      const route =
        action.route ??
        (action.surfaceId ? `/surface/${action.surfaceId}` : null);
      if (route) {
        router.push(route);
      }
      return;
    }

    await runSurfaceAction(surface.id, action, blockInput);
  };

  const frame = (() => {
    switch (payload.surfaceType) {
      case "brief":
        return <BriefSurface data={payload.data} />;
      case "queue":
        return <QueueSurface data={payload.data} />;
      case "composer":
        return <ComposerSurface data={payload.data} />;
      case "prep":
      case "debrief":
        return <PrepDebriefSurface data={payload.data} />;
      case "dossier":
        return <DossierSurface data={payload.data} />;
      case "board":
        return <BoardSurface data={payload.data} />;
      case "digest":
        return <DigestSurface data={payload.data} />;
      default:
        return <GenericSurface surface={surface} />;
    }
  })();

  return (
    <div className="space-y-5">
      {frame}
      {surface.blocks ? (
        <SurfaceBlocksRenderer
          key={`${surface.id}:${surface.version}`}
          spec={surface.blocks}
          state={{
            surfaceId: surface.id,
            surfaceVersion: surface.version,
            surfaceType: surface.payload.surfaceType,
            payload: surface.payload.data,
          }}
          onAction={handleBlockAction}
          onNavigate={(route) => router.push(route)}
        />
      ) : null}
    </div>
  );
}

function GenericSurface({ surface }: { surface: StoredSurface }) {
  return (
    <div className="border-l-[3px] border-border pl-4 py-2">
      <span className="text-[0.6875rem] text-text-tertiary uppercase tracking-wider font-medium font-[family-name:var(--font-mono)]">
        {surface.payload.surfaceType}
      </span>
      <pre className="mt-2 text-[0.8125rem] text-text-secondary whitespace-pre-wrap font-[family-name:var(--font-body)] leading-relaxed max-w-[65ch]">
        {surface.fallbackText}
      </pre>
    </div>
  );
}
