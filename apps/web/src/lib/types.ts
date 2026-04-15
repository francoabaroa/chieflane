import type { Lane, Status, StoredSurface } from "@chieflane/surface-schema";

export interface LaneConfig {
  id: Lane;
  label: string;
  icon: string;
  description: string;
}

export const LANES: LaneConfig[] = [
  {
    id: "today",
    label: "Today",
    icon: "Zap",
    description: "Your daily command center",
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: "Inbox",
    description: "Triage and approvals",
  },
  {
    id: "meetings",
    label: "Meetings",
    icon: "Calendar",
    description: "Prep, debrief, follow-ups",
  },
  {
    id: "drafts",
    label: "Drafts",
    icon: "PenLine",
    description: "Messages and communications",
  },
  {
    id: "people",
    label: "People",
    icon: "Users",
    description: "Contacts and relationships",
  },
  {
    id: "research",
    label: "Research",
    icon: "BookOpen",
    description: "Deep dives and synthesis",
  },
  {
    id: "ops",
    label: "Ops",
    icon: "Activity",
    description: "System health and automations",
  },
];

export interface StreamEvent {
  type: "surface.updated" | "surface.closed" | "action.progress";
  surfaceId: string;
  version?: number;
  data?: {
    lane?: Lane;
    status?: Status;
    surface?: StoredSurface;
    actionKey?: string;
    actionRunId?: string;
    event?: string;
    text?: string;
  };
}
