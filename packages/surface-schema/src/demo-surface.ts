import type { SurfaceEnvelopeInput } from "./index";

export function buildPublishTestSurfaceInput(lane = "today"): SurfaceEnvelopeInput {
  return {
    surfaceKey: `demo:welcome:${Date.now()}`,
    lane: lane as SurfaceEnvelopeInput["lane"],
    status: "ready",
    title: "Welcome to Chieflane",
    summary: "This test surface confirms that OpenClaw can publish into the shell.",
    payload: {
      surfaceType: "brief",
      data: {
        headline: "Chieflane is connected",
        sections: [
          {
            title: "Why the lanes were empty",
            body: "Empty lanes are normal until an agent, cron workflow, or manual test publishes a surface.",
            tone: "neutral",
          },
          {
            title: "What this proves",
            body: "OpenClaw successfully called surface_publish and the shell stored and rendered the result.",
            tone: "good",
          },
        ],
        metrics: [
          { label: "Lane", value: lane },
          { label: "Source", value: "publish-test-surface" },
        ],
      },
    },
    actions: [
      {
        id: "archive_demo",
        kind: "mutation",
        label: "Archive demo",
        mutation: "archive",
        style: "secondary",
      },
    ],
    fallbackText: "Chieflane demo surface published successfully.",
    freshness: {
      generatedAt: new Date().toISOString(),
    },
    meta: {
      demo: true,
      createdBy: "publish-test-surface",
    },
  };
}
