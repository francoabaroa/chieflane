import { z } from "zod";

export const laneSchema = z.enum([
  "today",
  "inbox",
  "meetings",
  "drafts",
  "people",
  "research",
  "ops",
]);
export type Lane = z.infer<typeof laneSchema>;

export const statusSchema = z.enum([
  "queued",
  "ready",
  "awaiting_review",
  "blocked",
  "done",
  "archived",
]);
export type Status = z.infer<typeof statusSchema>;

export const surfaceTypeSchema = z.enum([
  "brief",
  "queue",
  "board",
  "composer",
  "prep",
  "debrief",
  "dossier",
  "profile360",
  "review_packet",
  "digest",
  "timeline",
  "flow_monitor",
]);
export type SurfaceType = z.infer<typeof surfaceTypeSchema>;

export const actionInputSpecSchema = z.object({
  mode: z.enum(["text", "textarea"]).default("textarea"),
  label: z.string(),
  placeholder: z.string().optional(),
  submitLabel: z.string().optional(),
  required: z.boolean().default(false),
  maxLength: z.number().int().positive().optional(),
});
export type ActionInputSpec = z.infer<typeof actionInputSpecSchema>;

export const actionSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("navigate"),
    label: z.string(),
    route: z.string().optional(),
    surfaceId: z.string().optional(),
    style: z
      .enum(["primary", "secondary", "ghost", "danger"])
      .default("secondary"),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("mutation"),
    label: z.string(),
    mutation: z.enum(["archive", "dismiss", "set_status"]),
    input: z.record(z.string(), z.unknown()).optional().default({}),
    inputSpec: actionInputSpecSchema.optional(),
    confirmText: z.string().optional(),
    style: z
      .enum(["primary", "secondary", "ghost", "danger"])
      .default("secondary"),
  }),
  z.object({
    id: z.string(),
    kind: z.literal("agent"),
    label: z.string(),
    actionKey: z.string(),
    input: z.record(z.string(), z.unknown()).optional().default({}),
    inputSpec: actionInputSpecSchema.optional(),
    confirmText: z.string().optional(),
    style: z
      .enum(["primary", "secondary", "ghost", "danger"])
      .default("primary"),
  }),
]);
export type SurfaceAction = z.infer<typeof actionSchema>;

export const entityRefSchema = z.object({
  type: z.string(),
  id: z.string(),
  label: z.string().optional(),
});
export type EntityRef = z.infer<typeof entityRefSchema>;

export const sourceRefSchema = z.object({
  kind: z.string(),
  title: z.string(),
  href: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const freshnessSchema = z.object({
  generatedAt: z.string(),
  expiresAt: z.string().optional(),
});
export type Freshness = z.infer<typeof freshnessSchema>;

const briefSectionSchema = z.object({
  title: z.string(),
  body: z.string(),
  tone: z.enum(["neutral", "good", "warn", "critical"]).default("neutral"),
});

const briefData = z.object({
  headline: z.string(),
  sections: z.array(briefSectionSchema),
  metrics: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .default([]),
});
export type BriefData = z.infer<typeof briefData>;

const queueItem = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  reason: z.string(),
  score: z.number().min(0).max(100).optional(),
  dueAt: z.string().optional(),
  state: z
    .enum(["new", "queued", "ready", "blocked", "done"])
    .default("ready"),
});
export type QueueItem = z.infer<typeof queueItem>;

const queueData = z.object({
  emptyMessage: z.string().default("Nothing pending."),
  items: z.array(queueItem),
});
export type QueueData = z.infer<typeof queueData>;

const composerData = z.object({
  channel: z.enum(["gmail", "slack", "whatsapp", "telegram", "generic"]),
  subject: z.string().optional(),
  body: z.string(),
  recipients: z
    .array(z.object({ name: z.string().optional(), address: z.string() }))
    .default([]),
  variants: z
    .array(z.object({ id: z.string(), label: z.string(), body: z.string() }))
    .default([]),
});
export type ComposerData = z.infer<typeof composerData>;

const prepData = z.object({
  summary: z.string(),
  attendees: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        lastContact: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .default([]),
  agenda: z
    .array(z.object({ item: z.string(), owner: z.string().optional() }))
    .default([]),
  talkingPoints: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  commitments: z
    .array(
      z.object({
        description: z.string(),
        owner: z.string().optional(),
        dueAt: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .default([]),
});
export type PrepData = z.infer<typeof prepData>;

const dossierData = z.object({
  summary: z.string(),
  facts: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .default([]),
  contacts: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        email: z.string().optional(),
      })
    )
    .default([]),
  signals: z
    .array(
      z.object({
        label: z.string(),
        detail: z.string(),
        strength: z.enum(["low", "medium", "high"]).default("medium"),
      })
    )
    .default([]),
});
export type DossierData = z.infer<typeof dossierData>;

const boardColumn = z.object({
  id: z.string(),
  label: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      subtitle: z.string().optional(),
      priority: z.number().optional(),
      dueAt: z.string().optional(),
      tags: z.array(z.string()).default([]),
    })
  ),
});

const boardData = z.object({
  columns: z.array(boardColumn),
});
export type BoardData = z.infer<typeof boardData>;

const digestData = z.object({
  summary: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      tone: z.enum(["neutral", "good", "warn", "critical"]).default("neutral"),
    })
  ),
  recommendations: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
        decision: z
          .enum(["pending", "apply", "defer", "reject"])
          .default("pending"),
      })
    )
    .default([]),
});
export type DigestData = z.infer<typeof digestData>;

export const payloadSchema = z.discriminatedUnion("surfaceType", [
  z.object({ surfaceType: z.literal("brief"), data: briefData }),
  z.object({ surfaceType: z.literal("queue"), data: queueData }),
  z.object({ surfaceType: z.literal("composer"), data: composerData }),
  z.object({ surfaceType: z.literal("dossier"), data: dossierData }),
  z.object({ surfaceType: z.literal("prep"), data: prepData }),
  z.object({ surfaceType: z.literal("debrief"), data: prepData }),
  z.object({ surfaceType: z.literal("board"), data: boardData }),
  z.object({ surfaceType: z.literal("digest"), data: digestData }),
  z.object({
    surfaceType: z.literal("profile360"),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    surfaceType: z.literal("review_packet"),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    surfaceType: z.literal("timeline"),
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    surfaceType: z.literal("flow_monitor"),
    data: z.record(z.string(), z.unknown()),
  }),
]);
export type SurfacePayload = z.infer<typeof payloadSchema>;

export const surfaceEnvelopeSchema = z.object({
  surfaceKey: z.string(),
  lane: laneSchema,
  status: statusSchema.default("ready"),
  priority: z.number().int().min(0).max(100).default(50),
  title: z.string(),
  subtitle: z.string().optional(),
  summary: z.string(),
  payload: payloadSchema,
  actions: z.array(actionSchema).default([]),
  blocks: z.unknown().optional(),
  fallbackText: z.string(),
  entityRefs: z.array(entityRefSchema).default([]),
  sourceRefs: z.array(sourceRefSchema).default([]),
  freshness: freshnessSchema,
  meta: z.record(z.string(), z.unknown()).default({}),
});
export type SurfaceEnvelope = z.infer<typeof surfaceEnvelopeSchema>;
export type SurfaceEnvelopeInput = z.input<typeof surfaceEnvelopeSchema>;

export const surfacePatchSchema = z
  .object({
    lane: laneSchema.optional(),
    status: statusSchema.optional(),
    priority: z.number().int().min(0).max(100).optional(),
    title: z.string().optional(),
    subtitle: z.string().nullable().optional(),
    summary: z.string().optional(),
    payload: payloadSchema.optional(),
    actions: z.array(actionSchema).optional(),
    blocks: z.unknown().optional(),
    fallbackText: z.string().optional(),
    entityRefs: z.array(entityRefSchema).optional(),
    sourceRefs: z.array(sourceRefSchema).optional(),
    freshness: freshnessSchema.optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Patch payload cannot be empty",
  });
export type SurfacePatch = z.infer<typeof surfacePatchSchema>;
export type SurfacePatchInput = z.input<typeof surfacePatchSchema>;

export const surfacePatchRequestSchema = z.object({
  surfaceKey: z.string(),
  patch: surfacePatchSchema,
});

export const surfaceCloseRequestSchema = z.object({
  surfaceKey: z.string(),
  finalStatus: z.enum(["done", "archived"]).optional(),
});

export const actionRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);
export type ActionRunStatus = z.infer<typeof actionRunStatusSchema>;

export interface StoredSurface extends SurfaceEnvelope {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
