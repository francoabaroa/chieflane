## Chieflane Shell Integration

When persistent shell surfaces are available, use them for multi-step work, approvals, meeting prep, dossiers, drafts, digests, and queued follow-ups. Prefer updating existing surfaces by stable `surfaceKey` rather than creating duplicates.

If `.chieflane/profile.md` exists, consult it when shaping Chieflane surfaces and summaries.

## Chieflane Surface Lifecycle Rules

Use shell surfaces when work is multi-step, approval-driven, likely to be reopened, or better represented as structured UI than plain text.

### Publish
Publish a new surface when the user will likely reopen it later, the work needs review or tracking, or it belongs in a lane like `today`, `meetings`, `drafts`, `people`, `research`, or `ops`.

### Patch
Prefer `surface_patch` over creating duplicates when the same work item is evolving, status changes, or new context arrives.

### Close
Close or archive a surface only after the work is complete, superseded, or no longer useful. Patch it to `done` first when appropriate.

### Leave visible
Do not close a surface that is still awaiting review, blocked, tied to an upcoming meeting, pending follow-up, or serving as a demo/test surface.

### Default fallback
If uncertain about shape or layout, publish a minimal `brief` surface rather than guessing a complex one.

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
