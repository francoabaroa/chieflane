import { getDb } from "./index";
import { initDb } from "./init";
import { upsertSurfaceByKey } from "./surfaces";
import {
  surfaceEnvelopeSchema,
  type SurfaceEnvelopeInput,
} from "@chieflane/surface-schema";

const now = new Date().toISOString();

// All demo data in this seed file is fictional placeholder content for local evaluation.
const seeds: SurfaceEnvelopeInput[] = [
  {
    surfaceKey: "brief:morning:2026-04-08",
    lane: "today",
    status: "ready",
    priority: 95,
    title: "Morning Brief",
    subtitle: "Tuesday, April 8 2026",
    summary:
      "3 meetings today, 2 overdue tasks, and a board deck review due by EOD. Calendar is heavy 10am–2pm.",
    payload: {
      surfaceType: "brief",
      data: {
        headline: "Heavy meeting day — protect your afternoon for the board deck.",
        sections: [
          {
            title: "Calendar",
            body: "10:00 — Product sync with Eng leads (30m)\n11:00 — LP update call with Avery Example (45m)\n1:00 — Candidate debrief: Casey Example, Staff Engineer (30m)\n\nAfternoon is clear. Block 3–5pm for board deck.",
            tone: "neutral" as const,
          },
          {
            title: "Overdue Tasks",
            body: "• Q1 investor memo — draft has been pending review for 2 days\n• Reference check for Casey Example — waiting on Jordan Example since Friday",
            tone: "warn" as const,
          },
          {
            title: "Priority Items",
            body: "Board deck v2 — Lena shared comments last night. 4 sections need revision. The revenue slide needs the updated March actuals from finance.\n\nOutreach: 3 warm intros from last week's dinner haven't been followed up.",
            tone: "critical" as const,
          },
          {
            title: "Quick Wins",
            body: "• Approve the blog post draft (sitting in Drafts)\n• Reply to Devon's Slack about the demo timeline\n• Sign the NDA for Example Partners",
            tone: "good" as const,
          },
        ],
        metrics: [
          { label: "Meetings", value: "3" },
          { label: "Overdue", value: "2" },
          { label: "Pending Drafts", value: "4" },
          { label: "Follow-ups", value: "3" },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Start Board Deck Review",
        actionKey: "open_board_deck",
        style: "primary",
      },
      {
        id: "a2",
        kind: "navigate",
        label: "View Overdue",
        route: "/inbox",
        style: "secondary",
      },
      {
        id: "a3",
        kind: "mutation",
        label: "Dismiss",
        mutation: "dismiss",
        style: "ghost",
      },
    ],
    fallbackText:
      "Morning Brief: 3 meetings, 2 overdue tasks, board deck review due EOD. Heavy 10am–2pm.",
    blocks: {
      type: "SectionCard",
      props: {
        title: "Operator Note",
        tone: "neutral",
      },
      children: [
        {
          type: "TextBlock",
          props: {
            content:
              "Your real decision window starts after lunch. Keep anything non-blocking out of the morning stack unless it directly helps the board deck move.",
          },
        },
      ],
    },
    entityRefs: [],
    sourceRefs: [
      { kind: "calendar", title: "Google Calendar" },
      { kind: "task", title: "Linear Board" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "queue:inbox:triage:2026-04-08",
    lane: "inbox",
    status: "awaiting_review",
    priority: 85,
    title: "Inbox Triage",
    subtitle: "7 items need attention",
    summary:
      "Mix of approval requests, escalations, and follow-ups. 2 are time-sensitive.",
    payload: {
      surfaceType: "queue",
      data: {
        emptyMessage: "Inbox zero — nothing to triage",
        items: [
          {
            id: "q1",
            title: "Approve: Series B term sheet redlines",
            reason:
              "Legal sent final redlines. Partner expects response by noon.",
            score: 95,
            state: "ready" as const,
            dueAt: "12:00pm",
          },
          {
            id: "q2",
            title: "Review: Q1 investor memo draft",
            subtitle: "From: Riley Example",
            reason: "Overdue 2 days. Riley flagged it needs sign-off before Friday send.",
            score: 88,
            state: "blocked" as const,
            dueAt: "Thu",
          },
          {
            id: "q3",
            title: "Approve: Blog post — AI Agent Workflows",
            reason:
              "Content team needs publish approval. Scheduled for tomorrow.",
            score: 70,
            state: "ready" as const,
          },
          {
            id: "q4",
            title: "Escalation: Customer churn risk — Example Retail",
            reason:
              "CSM flagged renewal risk. They want exec sponsor call this week.",
            score: 82,
            state: "new" as const,
          },
          {
            id: "q5",
            title: "Follow-up: Jordan Example reference check",
            reason:
              "Sent Friday, no reply. Need before Thursday debrief.",
            score: 65,
            state: "ready" as const,
            dueAt: "Wed",
          },
          {
            id: "q6",
            title: "Review: Vendor contract — Example Analytics",
            subtitle: "Annual renewal, 15% increase proposed",
            reason: "Finance needs approval by Friday.",
            score: 60,
            state: "queued" as const,
            dueAt: "Fri",
          },
          {
            id: "q7",
            title: "FYI: Team offsite venue options",
            reason:
              "EA shortlisted 3 venues. No action needed yet.",
            score: 30,
            state: "queued" as const,
          },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Process Top Item",
        actionKey: "process_queue_item",
        style: "primary",
      },
      {
        id: "a2",
        kind: "mutation",
        label: "Archive All Done",
        mutation: "archive",
        confirmText: "Archive all completed items?",
        style: "ghost",
      },
    ],
    fallbackText:
      "Inbox Triage: 7 items. Top: Series B redlines (due noon), Q1 memo (overdue 2d).",
    entityRefs: [],
    sourceRefs: [
      { kind: "email", title: "Gmail — 4 threads" },
      { kind: "slack", title: "Slack — 2 escalations" },
      { kind: "linear", title: "Linear — 1 task" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "prep:meeting:lp-update-avery-example:2026-04-08",
    lane: "meetings",
    status: "ready",
    priority: 90,
    title: "Meeting Prep: LP Update",
    subtitle: "Avery Example — 11:00am today",
    summary:
      "Quarterly LP update. Avery tends to focus on cash runway and hiring velocity. Last meeting she asked about competitive positioning.",
    payload: {
      surfaceType: "prep",
      data: {
        summary:
          "Quarterly update with Avery Example (Example Ventures). She is the lead Series A investor and sits on the board. Historically focused on cash management, hiring pipeline quality, and market positioning. Last call (Jan 15) she pressed on competitive differentiation and asked about enterprise pipeline.",
        attendees: [
          {
            name: "Avery Example",
            role: "GP, Example Ventures — Board Member",
            lastContact: "Jan 15, 2026",
            notes:
              "Direct communicator. Appreciates data over narratives. Will likely ask about March cash position and Q2 hiring plan.",
          },
          {
            name: "Devon Example",
            role: "Associate, Example Ventures",
            lastContact: "Mar 22, 2026",
            notes:
              "Handles portfolio ops. Sent the data room access request last month.",
          },
        ],
        agenda: [
          { item: "Q1 metrics review (revenue, runway, burn)", owner: "You" },
          { item: "Product roadmap update", owner: "You" },
          { item: "Hiring update — 3 offers out", owner: "You" },
          { item: "Series B timeline and process", owner: "Both" },
          { item: "Any asks from Example Ventures", owner: "Avery" },
        ],
        talkingPoints: [
          "Revenue grew 34% QoQ — ahead of plan",
          "Runway is 16 months at current burn, 11 months at planned hiring",
          "Enterprise pipeline: 4 qualified deals, 2 in procurement",
          "Competitive: another category startup raised recently but is still pre-revenue in enterprise",
          "Key hire: VP Eng offer accepted, starts May 1",
        ],
        openQuestions: [
          "Does Example Ventures want to participate in Series B? At what level?",
          "Can Avery intro us to a relevant enterprise operator for the pilot motion?",
          "Feedback on updated board deck format?",
        ],
        commitments: [
          {
            description: "Send updated data room access to Devon",
            owner: "You",
            dueAt: "Apr 9",
            status: "pending",
          },
          {
            description: "Share March financial model",
            owner: "You",
            dueAt: "Apr 10",
          },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Generate Talking Notes",
        actionKey: "generate_talking_notes",
        style: "primary",
      },
      {
        id: "a2",
        kind: "agent",
        label: "Draft Follow-up Email",
        actionKey: "draft_followup_email",
        style: "secondary",
      },
      {
        id: "a3",
        kind: "mutation",
        label: "Mark Complete",
        mutation: "set_status",
        input: { status: "done" },
        style: "ghost",
      },
    ],
    fallbackText:
      "LP Update prep: Avery Example (Example Ventures), 11am. Key: Q1 metrics, Series B timeline, hiring update.",
    entityRefs: [
      { type: "person", id: "avery-example", label: "Avery Example" },
      { type: "company", id: "example-ventures", label: "Example Ventures" },
    ],
    sourceRefs: [
      { kind: "calendar", title: "Google Calendar event" },
      { kind: "crm", title: "Contact record — Avery Example" },
      { kind: "notes", title: "Last meeting notes — Jan 15" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "composer:gmail:followup-warm-intros:2026-04-08",
    lane: "drafts",
    status: "awaiting_review",
    priority: 70,
    title: "Follow-up: Warm Intros from Dinner",
    subtitle: "3 emails drafted",
    summary:
      "3 warm intro follow-ups from last Wednesday's dinner. One is a potential enterprise lead.",
    payload: {
      surfaceType: "composer",
      data: {
        channel: "gmail" as const,
        subject: "Great meeting you at the dinner last week",
        body: "Hi Pat,\n\nIt was great meeting you at dinner last Wednesday. I really enjoyed our conversation about scaling ops teams — your approach to the hiring pipeline at Example Cloud was fascinating.\n\nI'd love to continue the conversation. Would you be open to a 30-minute call next week? I think there could be some interesting overlap between what you're building and our platform.\n\nBest,\nChieflane Demo",
        recipients: [
          { name: "Pat Example", address: "pat@example.com" },
        ],
        variants: [
          {
            id: "v1",
            label: "Casual",
            body: "Hey Pat,\n\nReally enjoyed our chat at dinner last week. Your take on ops hiring was spot on.\n\nWould love to grab coffee and keep the conversation going. Free next week?\n\nBest,\nChieflane Demo",
          },
          {
            id: "v2",
            label: "Professional",
            body: "Hi Pat,\n\nThank you for the engaging conversation at last Wednesday's dinner. Your insights on scaling operations teams resonated strongly with challenges we're seeing across our customer base.\n\nI believe there could be meaningful synergies between Example Cloud's approach and our platform. Would you have availability for a 30-minute introductory call next week?\n\nLooking forward to connecting.\n\nBest regards,\nChieflane Demo",
          },
          {
            id: "v3",
            label: "Direct",
            body: "Pat — enjoyed dinner. Would love to show you what we're building. 30 min next week work?\n\n— Chieflane Demo",
          },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Approve & Send All",
        actionKey: "approve_and_send",
        confirmText: "Send all 3 follow-up emails?",
        style: "primary",
      },
      {
        id: "a2",
        kind: "agent",
        label: "Regenerate",
        actionKey: "regenerate_draft",
        style: "secondary",
      },
      {
        id: "a3",
        kind: "mutation",
        label: "Dismiss",
        mutation: "dismiss",
        style: "ghost",
      },
    ],
    fallbackText:
      "3 warm intro follow-up emails drafted from last week's dinner. Review and approve.",
    entityRefs: [
      { type: "person", id: "pat-example", label: "Pat Example" },
    ],
    sourceRefs: [
      { kind: "calendar", title: "Dinner event — Apr 2" },
      { kind: "notes", title: "Dinner notes" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "dossier:person:avery-example",
    lane: "people",
    status: "ready",
    priority: 80,
    title: "Dossier: Avery Example",
    subtitle: "GP, Example Ventures",
    summary:
      "Board member and lead Series A investor. Meeting today at 11am.",
    payload: {
      surfaceType: "dossier",
      data: {
        summary:
          "Avery Example is GP at Example Ventures and our lead Series A investor. She joined the board in Sep 2024. Communication style: direct, data-driven, appreciates concise updates. She is well-connected in enterprise SaaS and has made introductions to 3 potential customers. Her key concern is capital efficiency and path to Series B.",
        facts: [
          { label: "Title", value: "General Partner" },
          { label: "Firm", value: "Example Ventures" },
          { label: "Board Seat", value: "Since Sep 2024" },
          { label: "Investment", value: "Led $8M Series A" },
          { label: "Next Meeting", value: "Today, 11:00am" },
          { label: "Communication", value: "Direct, data-first" },
          { label: "LinkedIn", value: "1,200+ connections" },
          { label: "Last Interaction", value: "Jan 15, 2026" },
        ],
        contacts: [
          {
            name: "Avery Example",
            role: "GP, Example Ventures",
            email: "avery@example.com",
          },
          {
            name: "Devon Example",
            role: "Associate, Example Ventures",
            email: "devon@example.com",
          },
        ],
        signals: [
          {
            label: "Series B Interest",
            detail:
              "Asked about Series B timeline in last 2 board meetings. Likely wants to participate.",
            strength: "high" as const,
          },
          {
            label: "Enterprise Focus",
            detail:
              "Pushed hard on enterprise pipeline in Jan call. Wants to see 2+ signed enterprise deals before Series B.",
            strength: "high" as const,
          },
          {
            label: "Intro Network",
            detail:
              "Has offered intros to several strategic operator contacts. Follow up on these.",
            strength: "medium" as const,
          },
          {
            label: "Fund Timeline",
            detail:
              "Current fund closes at the end of 2026. She'll be deploying actively through Q3.",
            strength: "medium" as const,
          },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "navigate",
        label: "View Meeting Prep",
        surfaceId: "prep:meeting:lp-update-avery-example:2026-04-08",
        style: "primary",
      },
      {
        id: "a2",
        kind: "agent",
        label: "Update Dossier",
        actionKey: "refresh_surface",
        style: "secondary",
      },
    ],
    fallbackText:
      "Dossier: Avery Example, GP at Example Ventures. Board member, led $8M Series A. Meeting today 11am.",
    entityRefs: [
      { type: "person", id: "avery-example", label: "Avery Example" },
      { type: "company", id: "example-ventures", label: "Example Ventures" },
    ],
    sourceRefs: [
      { kind: "crm", title: "CRM contact record" },
      { kind: "notes", title: "Board meeting notes" },
      { kind: "email", title: "Gmail thread history" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "board:today:2026-04-08",
    lane: "today",
    status: "ready",
    priority: 80,
    title: "Today Board",
    subtitle: "Now / Next / Later",
    summary: "8 items across 3 columns. 2 blocked, 3 ready to go.",
    payload: {
      surfaceType: "board",
      data: {
        columns: [
          {
            id: "now",
            label: "Now",
            items: [
              {
                id: "t1",
                title: "Board deck v2 revisions",
                subtitle: "4 sections need update",
                priority: 95,
                dueAt: "EOD",
                tags: ["critical"],
              },
              {
                id: "t2",
                title: "LP update call prep",
                subtitle: "Avery Example, 11am",
                priority: 90,
                dueAt: "10:30am",
                tags: ["meeting"],
              },
            ],
          },
          {
            id: "next",
            label: "Next",
            items: [
              {
                id: "t3",
                title: "Review Q1 investor memo",
                subtitle: "Lena's draft",
                priority: 85,
                dueAt: "Thu",
                tags: ["overdue"],
              },
              {
                id: "t4",
                title: "Warm intro follow-ups",
                subtitle: "3 emails in drafts",
                priority: 70,
                tags: ["outreach"],
              },
              {
                id: "t5",
                title: "Approve blog post",
                priority: 65,
                tags: ["content"],
              },
            ],
          },
          {
            id: "later",
            label: "Later",
            items: [
              {
                id: "t6",
                title: "Vendor contract review",
                subtitle: "Example Analytics",
                priority: 55,
                dueAt: "Fri",
                tags: ["finance"],
              },
              {
                id: "t7",
                title: "Reference check follow-up",
                subtitle: "Jordan Example for Casey Example",
                priority: 50,
                dueAt: "Wed",
                tags: ["hiring"],
              },
              {
                id: "t8",
                title: "Offsite venue review",
                priority: 30,
                tags: ["ops"],
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Refresh Board",
        actionKey: "refresh_surface",
        style: "secondary",
      },
    ],
    fallbackText:
      "Today Board: 2 Now (board deck, LP prep), 3 Next (memo, intros, blog), 3 Later.",
    entityRefs: [],
    sourceRefs: [
      { kind: "task", title: "Linear" },
      { kind: "calendar", title: "Google Calendar" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "digest:kaizen:2026-w15",
    lane: "ops",
    status: "ready",
    priority: 60,
    title: "Weekly Kaizen Digest",
    subtitle: "Week 15 — System Improvements",
    summary:
      "3 friction patterns detected. 2 automation candidates. 1 improvement already applied.",
    payload: {
      surfaceType: "digest",
      data: {
        summary:
          "This week surfaced 3 recurring friction patterns. The most impactful is the manual data room update cycle which could be automated. One improvement (auto-calendar-prep) was applied successfully.",
        sections: [
          {
            title: "Auto-Calendar Prep (Applied)",
            body: "Meeting prep surfaces are now auto-generated 2 hours before external meetings. Tested with 4 meetings this week. All produced useful context. Average prep time reduced from 15 min to 3 min review.",
            tone: "good" as const,
          },
          {
            title: "Data Room Update Friction",
            body: "Data room was manually updated 3 times this week. Each time required pulling files from 4 different sources. Average time: 25 minutes. This is a strong automation candidate — financial model + metrics dashboard + deck can be auto-synced.",
            tone: "warn" as const,
          },
          {
            title: "Email Draft Latency",
            body: "Draft emails are sitting in review for average 1.8 days before being sent. 2 of 5 drafts this week expired their relevance window. Consider: auto-send approved templates, or daily draft digest notification.",
            tone: "warn" as const,
          },
        ],
        recommendations: [
          {
            id: "r1",
            label: "Auto-sync data room",
            description:
              "Connect financial model, metrics dashboard, and latest deck to auto-update the data room daily.",
            decision: "pending" as const,
          },
          {
            id: "r2",
            label: "Draft expiration alerts",
            description:
              "Add 24h and 48h nudges for pending drafts. Auto-archive after 72h if no action taken.",
            decision: "pending" as const,
          },
          {
            id: "r3",
            label: "Standing approval for routine emails",
            description:
              "Allow auto-send for meeting follow-ups and thank-you notes under 200 words. Keep human review for outbound sales and investor comms.",
            decision: "pending" as const,
          },
        ],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Apply Recommendations",
        actionKey: "apply_kaizen",
        confirmText: "Apply selected Kaizen recommendations?",
        style: "primary",
      },
      {
        id: "a2",
        kind: "mutation",
        label: "Archive",
        mutation: "archive",
        style: "ghost",
      },
    ],
    fallbackText:
      "Kaizen W15: 3 friction patterns, 2 automation candidates. Top: auto-sync data room.",
    blocks: {
      type: "SectionCard",
      props: {
        title: "Decision Grid",
        tone: "warn",
      },
      children: [
        {
          type: "ComparisonTable",
          props: {
            headers: ["Candidate", "Impact", "Cost"],
            rows: [
              ["Auto-sync data room", "High", "Medium"],
              ["Draft nudges", "High", "Low"],
              ["Standing approval pilot", "Medium", "Medium"],
            ],
          },
        },
      ],
    },
    entityRefs: [],
    sourceRefs: [
      { kind: "system", title: "Chieflane telemetry" },
      { kind: "memory", title: "MEMORY.md patterns" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },

  {
    surfaceKey: "prep:meeting:candidate-debrief-casey-example:2026-04-08",
    lane: "meetings",
    status: "ready",
    priority: 75,
    title: "Candidate Debrief: Casey Example",
    subtitle: "Staff Engineer — 1:00pm today",
    summary:
      "Final round debrief. 4 interviewers submitted feedback. Strong hire signal with one concern.",
    payload: {
      surfaceType: "prep",
      data: {
        summary:
          "Casey Example interviewed for Staff Engineer. 4 of 4 interviewers submitted scorecards. Overall strong hire with 3 strong yes and 1 lean yes (concern: limited distributed systems experience at scale). A competing offer expires Friday.",
        attendees: [
          {
            name: "Interviewer A",
            role: "VP Engineering",
            notes: "Strong yes. Loved her system design approach.",
          },
          {
            name: "Interviewer B",
            role: "Staff Engineer",
            notes: "Strong yes. Best coding interview they've seen in 6 months.",
          },
          {
            name: "Interviewer C",
            role: "Engineering Manager",
            notes: "Lean yes. Concerned about distributed systems depth.",
          },
          {
            name: "Interviewer D",
            role: "Product Lead",
            notes: "Strong yes. Excellent product thinking for an engineer.",
          },
        ],
        agenda: [
          { item: "Review interview scorecards", owner: "All" },
          { item: "Discuss distributed systems concern", owner: "Interviewer C" },
          { item: "Compensation package discussion", owner: "Interviewer A" },
          { item: "Decision: extend offer?", owner: "All" },
          { item: "Timeline: competing offer expires Friday", owner: "You" },
        ],
        talkingPoints: [
          "3 strong yes, 1 lean yes — well above hiring bar",
          "Distributed systems concern may be addressable with onboarding plan",
          "The competing offer is strong — we need to move fast",
          "Reference check with Jordan Example still pending",
        ],
        openQuestions: [
          "Can we extend without the reference check?",
          "What comp package will be competitive with the other offer?",
          "Is the distributed systems gap a dealbreaker for the first 6 months of work?",
        ],
        commitments: [],
      },
    },
    actions: [
      {
        id: "a1",
        kind: "agent",
        label: "Draft Offer Package",
        actionKey: "draft_offer",
        style: "primary",
      },
      {
        id: "a2",
        kind: "agent",
        label: "Follow Up on Reference",
        actionKey: "followup_reference",
        style: "secondary",
      },
    ],
    fallbackText:
      "Candidate debrief: Casey Example, Staff Eng. 3 strong yes, 1 lean yes. Competing offer expires Friday.",
    entityRefs: [
      { type: "person", id: "casey-example", label: "Casey Example" },
    ],
    sourceRefs: [
      { kind: "ats", title: "ATS scorecards" },
      { kind: "calendar", title: "Interview schedule" },
    ],
    freshness: { generatedAt: now },
    meta: {},
  },
];

async function main() {
  console.log("Seeding Chieflane database...");
  initDb();
  const db = getDb();

  db.prepare("DELETE FROM action_runs").run();
  db.prepare("DELETE FROM surface_events").run();
  db.prepare("DELETE FROM surfaces").run();

  for (const seed of seeds) {
    const surface = upsertSurfaceByKey(surfaceEnvelopeSchema.parse(seed));
    console.log(`  ✓ ${surface.surfaceKey} (${surface.payload.surfaceType})`);
  }

  console.log(`\nSeeded ${seeds.length} surfaces.`);
}

main().catch(console.error);
