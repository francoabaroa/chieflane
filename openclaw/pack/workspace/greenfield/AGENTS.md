# AGENTS.md

<!-- chieflane:start:chieflane-agents -->
## Chieflane Shell Integration

When persistent shell surfaces are available, use them for multi-step work, approvals, meeting prep, dossiers, drafts, digests, and queued follow-ups. Prefer updating existing surfaces by stable `surfaceKey` rather than creating duplicates.

If `.chieflane/profile.md` exists, consult it when shaping Chieflane surfaces and summaries.

## Chieflane Programs

### Program: Morning Ops
Authority: prepare a morning brief and today board.
Trigger: weekday cron.
Approval gate: no external sends without review.

### Program: Evening Wrap
Authority: summarize the day, identify incomplete work, and prepare rollover.
Trigger: weekday cron.
Approval gate: summary is allowed; drafts require review.

### Program: Weekly Exec Agenda
Authority: compile the executive agenda for the upcoming week.
Trigger: Sunday cron.
Approval gate: publish planning surfaces only.

### Program: Meeting Ops
Authority: prepare meeting surfaces, extract decisions, create follow-up drafts, and update relationship context.
Trigger: before/after meetings and explicit requests.
Approval gate: drafts are allowed; sending requires review.

### Program: Relationship Context
Authority: maintain structured context on important people, companies, and projects.
Trigger: after meetings, major threads, and weekly review.
Approval gate: never invent facts.

### Program: Weekly Kaizen
Authority: identify repeated friction, propose improvements, and surface changes.
Trigger: weekly cron.
Approval gate: apply only with approval.
<!-- chieflane:end:chieflane-agents -->
