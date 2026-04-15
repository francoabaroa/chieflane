# chief-shell

You have access to three shell tools:
- `surface_publish` - create or replace a persistent shell surface
- `surface_patch` - update fields on an existing surface
- `surface_close` - archive or close a surface

## When to publish a surface

Use shell surfaces for work that is multi-step, approval-driven, likely to be reopened, better presented as structured UI than plain text, tied to people or meetings, or part of a recurring workflow.

## When not to publish a surface

Do not publish a surface for trivial acknowledgements, short confirmations, one-off factual answers, or work with no follow-up value.

## Minimal valid example

Use this exact shape when uncertain:

```json
{
  "surfaceKey": "brief:example:2026-04-10",
  "lane": "today",
  "status": "ready",
  "priority": 50,
  "title": "Example brief",
  "summary": "Why the user is seeing this.",
  "fallbackText": "Why the user is seeing this.",
  "freshness": {
    "generatedAt": "2026-04-10T09:00:00.000Z"
  },
  "payload": {
    "surfaceType": "brief",
    "data": {
      "headline": "Example headline",
      "sections": [
        {
          "title": "Status",
          "body": "The structured payload is valid.",
          "tone": "good"
        }
      ],
      "metrics": []
    }
  },
  "actions": [],
  "sourceRefs": [],
  "entityRefs": [],
  "meta": {}
}
```

## Common shapes

### brief
Required: `payload.surfaceType = "brief"`, `payload.data.headline`, `payload.data.sections[]`, `fallbackText`, `freshness.generatedAt`.
Recommended: `actions[]`, `sourceRefs[]`, `priority`.

### queue
Required: `payload.surfaceType = "queue"`, `payload.data.emptyMessage`, `payload.data.items[]`, `fallbackText`, `freshness.generatedAt`.

### board
Required: `payload.surfaceType = "board"`, `payload.data.columns[]`, `fallbackText`, `freshness.generatedAt`.

### composer
Required: `payload.surfaceType = "composer"`, `payload.data.channel`, `payload.data.body`, `payload.data.recipients[]`, `fallbackText`, `freshness.generatedAt`.

### prep / debrief
Required: `payload.surfaceType`, `payload.data.summary`, `payload.data.attendees[]`, `fallbackText`, `freshness.generatedAt`.

### dossier / digest
Required: `payload.surfaceType`, the typed `payload.data` object, `fallbackText`, `freshness.generatedAt`.

## Required vs recommended

Always required:
- `surfaceKey`
- `lane`
- `title`
- `summary`
- `payload`
- `fallbackText`
- `freshness.generatedAt`

Recommended unless not applicable:
- `actions`
- `sourceRefs`
- `entityRefs`
- `priority`

## Safe defaults

When uncertain, use `brief`, lane `today`, status `ready`, priority `50`, `actions: []`, and `sourceRefs: []` unless the surface summarizes external material.

## Lifecycle

Reuse `surfaceKey` whenever possible. Prefer `surface_patch` over duplicates. Patch a surface to `done` before closing it when the work is complete. Leave surfaces visible while review, follow-up, or an upcoming meeting still matters.

## Task sync rules

When a canonical task or commitment is created, updated, completed, blocked, or deleted:
- Publish or patch the corresponding Chieflane surface.
- Keep the same `surfaceKey` for the same underlying task.
- Prefer `surface_patch` over duplicate publishes.
- Close or archive the surface when the underlying task is complete and no longer needs review.

Suggested task surfaceKey patterns:
- `task:<source>:<task-id>`
- `commitment:<meeting-id>:<commitment-id>`

When a user triggers `complete_surface_canonical`, `message_openclaw_about_surface`, or `mark_blocked_canonical` from the Chieflane UI, update the canonical task source first when one exists, then patch or close the exact current `surfaceKey`. Do not create a duplicate follow-up unless the current surface should remain visible and there is a genuinely separate next action.

## Surface hygiene rules

On hygiene sweeps:
- Archive done surfaces older than 12 hours unless they are explicitly pinned or marked as demo/test material.
- Close stale meeting prep after the meeting has ended and the debrief or commitments have been captured.
- Refresh stale summaries older than 24 hours when the surface is still relevant.
- Deduplicate by `surfaceKey`; keep the freshest useful surface and patch it rather than publishing a second copy.
- Never delete surfaces destructively.

## Surface types

- `brief` - Morning briefs, daily summaries, short updates, and wrap-ups.
- `queue` - Inbox triage, review queues, and approval flows.
- `board` - Task boards and multi-column work tracking.
- `composer` - Drafted messages and reviewable communications.
- `prep` - Meeting preparation and talking-point packets.
- `debrief` - Meeting follow-up and commitment capture.
- `dossier` - Research packets and structured context for people or accounts.
- `profile360` - Broader relationship profiles spanning multiple systems.
- `review_packet` - Structured review bundles for hiring, documents, or approvals.
- `digest` - Longer-form summaries, synthesis, and recommendations.
- `timeline` - Chronological activity views and event trails.
- `flow_monitor` - Automation and workflow run monitoring surfaces.

## Freshness

Always set `freshness.generatedAt` to the current timestamp. Add `expiresAt` when the surface is time-sensitive.
