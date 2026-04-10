import type { SurfaceEnvelopeInput, SurfaceType } from "./index";

export type SurfaceContract = {
  surfaceType: SurfaceType;
  label: string;
  purpose: string;
  requiredPaths: string[];
  recommendedPaths: string[];
  minimalExample: SurfaceEnvelopeInput;
};

function baseExample(
  surfaceKey: string,
  lane: SurfaceEnvelopeInput["lane"],
  title: string,
  summary: string
) {
  return {
    surfaceKey,
    lane,
    status: "ready" as const,
    priority: 50,
    title,
    summary,
    fallbackText: summary,
    freshness: {
      generatedAt: "2026-04-10T09:00:00.000Z",
    },
  };
}

export const surfaceContracts: Record<SurfaceType, SurfaceContract> = {
  brief: {
    surfaceType: "brief",
    label: "Brief",
    purpose: "Morning briefs, daily summaries, short updates, and wrap-ups.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.headline",
      "payload.data.sections[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]", "priority"],
    minimalExample: {
      ...baseExample(
        "brief:example:2026-04-10",
        "today",
        "Example brief",
        "Why the user is seeing this."
      ),
      payload: {
        surfaceType: "brief",
        data: {
          headline: "Example headline",
          sections: [
            {
              title: "Status",
              body: "The structured payload is valid.",
              tone: "good",
            },
          ],
          metrics: [],
        },
      },
      actions: [],
      sourceRefs: [],
      entityRefs: [],
      meta: {},
    },
  },
  queue: {
    surfaceType: "queue",
    label: "Queue",
    purpose: "Inbox triage, review queues, and approval flows.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.emptyMessage",
      "payload.data.items[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]", "priority"],
    minimalExample: {
      ...baseExample(
        "queue:example:approvals",
        "inbox",
        "Approval queue",
        "Items waiting for review."
      ),
      payload: {
        surfaceType: "queue",
        data: {
          emptyMessage: "Nothing pending.",
          items: [
            {
              id: "item-1",
              title: "Approve follow-up email",
              reason: "Draft is ready to send.",
              state: "ready",
            },
          ],
        },
      },
    },
  },
  board: {
    surfaceType: "board",
    label: "Board",
    purpose: "Task boards and multi-column work tracking.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.columns[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "priority"],
    minimalExample: {
      ...baseExample(
        "board:example:today",
        "today",
        "Today board",
        "The current work board."
      ),
      payload: {
        surfaceType: "board",
        data: {
          columns: [
            {
              id: "now",
              label: "Now",
              items: [
                {
                  id: "task-1",
                  title: "Confirm launch notes",
                },
              ],
            },
          ],
        },
      },
    },
  },
  composer: {
    surfaceType: "composer",
    label: "Composer",
    purpose: "Drafted messages and reviewable communications.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.channel",
      "payload.data.body",
      "payload.data.recipients[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "composer:example:follow-up",
        "drafts",
        "Follow-up draft",
        "A draft is ready for review."
      ),
      payload: {
        surfaceType: "composer",
        data: {
          channel: "gmail",
          subject: "Quick follow-up",
          body: "Thanks again for the conversation. Here are the next steps.",
          recipients: [{ address: "person@example.com" }],
          variants: [],
        },
      },
    },
  },
  prep: {
    surfaceType: "prep",
    label: "Prep",
    purpose: "Meeting preparation and talking-point packets.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.summary",
      "payload.data.attendees[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "prep:example:meeting-123",
        "meetings",
        "Meeting prep",
        "Preparation for the upcoming meeting."
      ),
      payload: {
        surfaceType: "prep",
        data: {
          summary: "Review account progress before the meeting.",
          attendees: [{ name: "Alex Rivera" }],
          agenda: [{ item: "Q2 plan" }],
          talkingPoints: ["Confirm owner for rollout"],
          openQuestions: ["What is blocking launch?"],
          commitments: [],
        },
      },
    },
  },
  debrief: {
    surfaceType: "debrief",
    label: "Debrief",
    purpose: "Meeting follow-up and commitment capture.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.summary",
      "payload.data.commitments[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "debrief:example:meeting-123",
        "meetings",
        "Meeting debrief",
        "Commitments and next steps from the meeting."
      ),
      payload: {
        surfaceType: "debrief",
        data: {
          summary: "The team aligned on scope and owners.",
          attendees: [{ name: "Alex Rivera" }],
          agenda: [],
          talkingPoints: ["Scope is locked"],
          openQuestions: [],
          commitments: [
            {
              description: "Send final scope by Friday",
              owner: "Franco",
            },
          ],
        },
      },
    },
  },
  dossier: {
    surfaceType: "dossier",
    label: "Dossier",
    purpose: "Research packets and structured context for people or accounts.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.summary",
      "payload.data.facts[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "dossier:person:alex-rivera",
        "people",
        "Alex Rivera",
        "Current relationship context and key facts."
      ),
      payload: {
        surfaceType: "dossier",
        data: {
          summary: "Alex leads platform partnerships.",
          facts: [{ label: "Company", value: "Northstar" }],
          contacts: [{ name: "Alex Rivera", email: "alex@example.com" }],
          signals: [
            {
              label: "Renewal risk",
              detail: "Needs a faster integration timeline.",
              strength: "medium",
            },
          ],
        },
      },
    },
  },
  profile360: {
    surfaceType: "profile360",
    label: "Profile 360",
    purpose: "Broader relationship profiles spanning multiple systems.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["sourceRefs[]", "entityRefs[]"],
    minimalExample: {
      ...baseExample(
        "profile360:person:alex-rivera",
        "people",
        "Alex Rivera 360",
        "Cross-source relationship summary."
      ),
      payload: {
        surfaceType: "profile360",
        data: {
          company: "Northstar",
          role: "Head of Platform Partnerships",
        },
      },
    },
  },
  review_packet: {
    surfaceType: "review_packet",
    label: "Review Packet",
    purpose: "Structured review bundles for hiring, documents, or approvals.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "review:packet:hiring-1",
        "inbox",
        "Candidate review",
        "Packet ready for review."
      ),
      payload: {
        surfaceType: "review_packet",
        data: {
          subject: "Candidate packet",
          rubric: "Strong product sense",
        },
      },
    },
  },
  digest: {
    surfaceType: "digest",
    label: "Digest",
    purpose: "Longer-form summaries, synthesis, and recommendations.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data.summary",
      "payload.data.sections[]",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "digest:example:week-15",
        "research",
        "Weekly digest",
        "Summary of key developments."
      ),
      payload: {
        surfaceType: "digest",
        data: {
          summary: "Three key updates matter this week.",
          sections: [
            {
              title: "Product",
              body: "Launch is still on track.",
              tone: "good",
            },
          ],
          recommendations: [],
        },
      },
    },
  },
  timeline: {
    surfaceType: "timeline",
    label: "Timeline",
    purpose: "Chronological activity views and event trails.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["sourceRefs[]"],
    minimalExample: {
      ...baseExample(
        "timeline:example:account-1",
        "research",
        "Timeline",
        "Chronological activity summary."
      ),
      payload: {
        surfaceType: "timeline",
        data: {
          events: [{ at: "2026-04-10", label: "Kickoff call" }],
        },
      },
    },
  },
  flow_monitor: {
    surfaceType: "flow_monitor",
    label: "Flow Monitor",
    purpose: "Automation and workflow run monitoring surfaces.",
    requiredPaths: [
      "payload.surfaceType",
      "payload.data",
      "fallbackText",
      "freshness.generatedAt",
    ],
    recommendedPaths: ["actions[]", "priority"],
    minimalExample: {
      ...baseExample(
        "flow:monitor:ops-1",
        "ops",
        "Flow monitor",
        "Workflow state summary."
      ),
      payload: {
        surfaceType: "flow_monitor",
        data: {
          status: "healthy",
          lastRunAt: "2026-04-10T09:00:00.000Z",
        },
      },
    },
  },
};

export const commonSurfaceContractOrder: SurfaceType[] = [
  "brief",
  "queue",
  "board",
  "composer",
  "prep",
  "debrief",
  "dossier",
  "digest",
];
