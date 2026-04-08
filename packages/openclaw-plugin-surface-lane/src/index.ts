import { Type } from "@sinclair/typebox";

const PLUGIN_ID = "surface-lane";

const Action = Type.Object({
  id: Type.String(),
  kind: Type.Union([
    Type.Literal("navigate"),
    Type.Literal("mutation"),
    Type.Literal("agent"),
  ]),
  label: Type.String(),
  style: Type.Optional(
    Type.Union([
      Type.Literal("primary"),
      Type.Literal("secondary"),
      Type.Literal("ghost"),
      Type.Literal("danger"),
    ])
  ),
  route: Type.Optional(Type.String()),
  surfaceId: Type.Optional(Type.String()),
  mutation: Type.Optional(Type.String()),
  actionKey: Type.Optional(Type.String()),
  input: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  confirmText: Type.Optional(Type.String()),
});

const EntityRef = Type.Object({
  type: Type.String(),
  id: Type.String(),
  label: Type.Optional(Type.String()),
});

const SourceRef = Type.Object({
  kind: Type.String(),
  title: Type.String(),
  href: Type.Optional(Type.String()),
});

const Freshness = Type.Object({
  generatedAt: Type.String(),
  expiresAt: Type.Optional(Type.String()),
});

const SurfacePublish = Type.Object({
  surfaceKey: Type.String({ description: "Stable key like 'brief:morning:2026-04-08'" }),
  lane: Type.Union([
    Type.Literal("today"),
    Type.Literal("inbox"),
    Type.Literal("meetings"),
    Type.Literal("drafts"),
    Type.Literal("people"),
    Type.Literal("research"),
    Type.Literal("ops"),
  ], { description: "Which lane this surface belongs to" }),
  status: Type.Optional(
    Type.Union([
      Type.Literal("queued"),
      Type.Literal("ready"),
      Type.Literal("awaiting_review"),
      Type.Literal("blocked"),
      Type.Literal("done"),
      Type.Literal("archived"),
    ])
  ),
  priority: Type.Optional(Type.Number({ minimum: 0, maximum: 100, description: "0–100, higher = more important" })),
  title: Type.String({ description: "Surface title" }),
  subtitle: Type.Optional(Type.String()),
  summary: Type.String({ description: "One sentence: why am I seeing this?" }),
  payload: Type.Object({
    surfaceType: Type.String({ description: "One of: brief, queue, board, composer, prep, debrief, dossier, profile360, review_packet, digest, timeline, flow_monitor" }),
    data: Type.Any({ description: "Type-specific data matching the surfaceType" }),
  }),
  actions: Type.Optional(Type.Array(Action, { description: "1–5 user actions" })),
  blocks: Type.Optional(Type.Any({ description: "json-render spec for generative interior blocks" })),
  fallbackText: Type.String({ description: "Plain text summary for chat channels" }),
  entityRefs: Type.Optional(Type.Array(EntityRef)),
  sourceRefs: Type.Optional(Type.Array(SourceRef)),
  freshness: Freshness,
  meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

const SurfacePatch = Type.Object({
  surfaceKey: Type.String({ description: "surfaceKey of the surface to patch" }),
  patch: Type.Object({
    status: Type.Optional(Type.String()),
    priority: Type.Optional(Type.Number()),
    title: Type.Optional(Type.String()),
    subtitle: Type.Optional(Type.String()),
    summary: Type.Optional(Type.String()),
    payload: Type.Optional(Type.Any()),
    actions: Type.Optional(Type.Array(Action)),
    blocks: Type.Optional(Type.Any()),
    fallbackText: Type.Optional(Type.String()),
    entityRefs: Type.Optional(Type.Array(EntityRef)),
    sourceRefs: Type.Optional(Type.Array(SourceRef)),
    freshness: Type.Optional(Freshness),
    meta: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  }, { description: "Fields to update" }),
});

const SurfaceClose = Type.Object({
  surfaceKey: Type.String({ description: "surfaceKey of the surface to close" }),
  finalStatus: Type.Optional(
    Type.Union([Type.Literal("done"), Type.Literal("archived")])
  ),
});

type PluginApi = {
  config?: {
    plugins?: {
      entries?: Record<string, { config?: Record<string, unknown> }>;
    };
  };
  registerTool: (
    tool: {
      name: string;
      description: string;
      parameters: unknown;
      execute: (id: string, params: unknown) => Promise<{
        content: Array<{ type: "text"; text: string }>;
      }>;
    },
    options?: Record<string, unknown>
  ) => void;
};

function getPluginConfig(api: PluginApi) {
  return api.config?.plugins?.entries?.[PLUGIN_ID]?.config ?? {};
}

function requireSetting(api: PluginApi, key: "shellApiUrl" | "shellInternalApiKey") {
  const config = getPluginConfig(api);
  const fromConfig = config[key];
  if (typeof fromConfig === "string" && fromConfig.length > 0) {
    return fromConfig;
  }

  const envKey = key === "shellApiUrl" ? "SHELL_API_URL" : "SHELL_INTERNAL_API_KEY";
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv;
  }

  throw new Error(
    `Missing required plugin setting: ${key}. Configure it in plugins.entries.${PLUGIN_ID}.config or set ${envKey}.`
  );
}

async function post(api: PluginApi, path: string, body: unknown) {
  const baseUrl = requireSetting(api, "shellApiUrl");
  const apiKey = requireSetting(api, "shellInternalApiKey");

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shell API failed (${response.status}): ${text}`);
  }

  return response.json();
}

export const pluginEntry = {
  id: PLUGIN_ID,
  name: "Surface Lane",
  description: "Publish persistent surfaces to the Chieflane shell app",
  register(api: PluginApi) {
    api.registerTool(
      {
        name: "surface_publish",
        description:
          "Create or replace a persistent shell surface for work that should be reviewed, tracked, or acted upon later. Use for multi-step work, approval-driven tasks, meeting prep, drafts, dossiers, task boards, and digests.",
        parameters: SurfacePublish,
        async execute(_id: string, params: unknown) {
          const result = await post(api, "/api/internal/surfaces/publish", params);
          return {
            content: [
              {
                type: "text" as const,
                text: `Published surface ${(result as { surfaceKey: string; version: number }).surfaceKey} (v${(result as { version: number }).version})`,
              },
            ],
          };
        },
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: "surface_patch",
        description:
          "Patch an existing shell surface by surfaceKey. Use to update status, priority, data, or actions without replacing the whole surface.",
        parameters: SurfacePatch,
        async execute(_id: string, params: unknown) {
          const result = await post(api, "/api/internal/surfaces/patch", params);
          return {
            content: [
              {
                type: "text" as const,
                text: `Patched surface ${(result as { surfaceKey: string; version: number }).surfaceKey} (v${(result as { version: number }).version})`,
              },
            ],
          };
        },
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: "surface_close",
        description:
          "Close or archive a shell surface. Use when work is complete and the surface no longer needs attention.",
        parameters: SurfaceClose,
        async execute(_id: string, params: unknown) {
          await post(api, "/api/internal/surfaces/close", params);
          return {
            content: [
              {
                type: "text" as const,
                text: `Closed surface ${(params as { surfaceKey: string }).surfaceKey}`,
              },
            ],
          };
        },
      },
      { optional: true }
    );
  },
};

export default pluginEntry;
