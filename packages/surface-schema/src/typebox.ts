import { Type } from "@sinclair/typebox";

const ToneTB = Type.Union([
  Type.Literal("neutral"),
  Type.Literal("good"),
  Type.Literal("warn"),
  Type.Literal("critical"),
]);

export const ActionTB = Type.Object({
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

export const EntityRefTB = Type.Object({
  type: Type.String(),
  id: Type.String(),
  label: Type.Optional(Type.String()),
});

export const SourceRefTB = Type.Object({
  kind: Type.String(),
  title: Type.String(),
  href: Type.Optional(Type.String()),
});

export const FreshnessTB = Type.Object({
  generatedAt: Type.String(),
  expiresAt: Type.Optional(Type.String()),
});

const BriefPayloadTB = Type.Object({
  surfaceType: Type.Literal("brief"),
  data: Type.Object({
    headline: Type.String(),
    sections: Type.Array(
      Type.Object({
        title: Type.String(),
        body: Type.String(),
        tone: Type.Optional(ToneTB),
      })
    ),
    metrics: Type.Optional(
      Type.Array(
        Type.Object({
          label: Type.String(),
          value: Type.String(),
        })
      )
    ),
  }),
});

const QueuePayloadTB = Type.Object({
  surfaceType: Type.Literal("queue"),
  data: Type.Object({
    emptyMessage: Type.Optional(Type.String()),
    items: Type.Array(
      Type.Object({
        id: Type.String(),
        title: Type.String(),
        subtitle: Type.Optional(Type.String()),
        reason: Type.String(),
        score: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
        dueAt: Type.Optional(Type.String()),
        state: Type.Optional(
          Type.Union([
            Type.Literal("new"),
            Type.Literal("queued"),
            Type.Literal("ready"),
            Type.Literal("blocked"),
            Type.Literal("done"),
          ])
        ),
      })
    ),
  }),
});

const BoardPayloadTB = Type.Object({
  surfaceType: Type.Literal("board"),
  data: Type.Object({
    columns: Type.Array(
      Type.Object({
        id: Type.String(),
        label: Type.String(),
        items: Type.Array(
          Type.Object({
            id: Type.String(),
            title: Type.String(),
            subtitle: Type.Optional(Type.String()),
            priority: Type.Optional(Type.Number()),
            dueAt: Type.Optional(Type.String()),
            tags: Type.Optional(Type.Array(Type.String())),
          })
        ),
      })
    ),
  }),
});

const ComposerPayloadTB = Type.Object({
  surfaceType: Type.Literal("composer"),
  data: Type.Object({
    channel: Type.Union([
      Type.Literal("gmail"),
      Type.Literal("slack"),
      Type.Literal("whatsapp"),
      Type.Literal("telegram"),
      Type.Literal("generic"),
    ]),
    subject: Type.Optional(Type.String()),
    body: Type.String(),
    recipients: Type.Array(
      Type.Object({
        name: Type.Optional(Type.String()),
        address: Type.String(),
      })
    ),
    variants: Type.Array(
      Type.Object({
        id: Type.String(),
        label: Type.String(),
        body: Type.String(),
      })
    ),
  }),
});

const PrepLikePayloadDataTB = Type.Object({
  summary: Type.String(),
  attendees: Type.Array(
    Type.Object({
      name: Type.String(),
      role: Type.Optional(Type.String()),
      lastContact: Type.Optional(Type.String()),
      notes: Type.Optional(Type.String()),
    })
  ),
  agenda: Type.Array(
    Type.Object({
      item: Type.String(),
      owner: Type.Optional(Type.String()),
    })
  ),
  talkingPoints: Type.Array(Type.String()),
  openQuestions: Type.Array(Type.String()),
  commitments: Type.Array(
    Type.Object({
      description: Type.String(),
      owner: Type.Optional(Type.String()),
      dueAt: Type.Optional(Type.String()),
      status: Type.Optional(Type.String()),
    })
  ),
});

const PrepPayloadTB = Type.Object({
  surfaceType: Type.Literal("prep"),
  data: PrepLikePayloadDataTB,
});

const DebriefPayloadTB = Type.Object({
  surfaceType: Type.Literal("debrief"),
  data: PrepLikePayloadDataTB,
});

const DossierPayloadTB = Type.Object({
  surfaceType: Type.Literal("dossier"),
  data: Type.Object({
    summary: Type.String(),
    facts: Type.Array(
      Type.Object({
        label: Type.String(),
        value: Type.String(),
      })
    ),
    contacts: Type.Array(
      Type.Object({
        name: Type.String(),
        role: Type.Optional(Type.String()),
        email: Type.Optional(Type.String()),
      })
    ),
    signals: Type.Array(
      Type.Object({
        label: Type.String(),
        detail: Type.String(),
        strength: Type.Optional(
          Type.Union([
            Type.Literal("low"),
            Type.Literal("medium"),
            Type.Literal("high"),
          ])
        ),
      })
    ),
  }),
});

const DigestPayloadTB = Type.Object({
  surfaceType: Type.Literal("digest"),
  data: Type.Object({
    summary: Type.String(),
    sections: Type.Array(
      Type.Object({
        title: Type.String(),
        body: Type.String(),
        tone: Type.Optional(ToneTB),
      })
    ),
    recommendations: Type.Optional(
      Type.Array(
        Type.Object({
          id: Type.String(),
          label: Type.String(),
          description: Type.String(),
          decision: Type.Optional(
            Type.Union([
              Type.Literal("pending"),
              Type.Literal("apply"),
              Type.Literal("defer"),
              Type.Literal("reject"),
            ])
          ),
        })
      )
    ),
  }),
});

export const SurfacePayloadTB = Type.Union([
  BriefPayloadTB,
  QueuePayloadTB,
  BoardPayloadTB,
  ComposerPayloadTB,
  PrepPayloadTB,
  DebriefPayloadTB,
  DossierPayloadTB,
  DigestPayloadTB,
  Type.Object({
    surfaceType: Type.Literal("profile360"),
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
  Type.Object({
    surfaceType: Type.Literal("review_packet"),
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
  Type.Object({
    surfaceType: Type.Literal("timeline"),
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
  Type.Object({
    surfaceType: Type.Literal("flow_monitor"),
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
]);
