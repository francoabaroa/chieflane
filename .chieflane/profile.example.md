# Chieflane Profile Example

Use this as a starting point for `.chieflane/profile.md` when connecting real task sources.

## Task Sources

- Primary task source: Linear, GitHub Issues, Todoist, Notion, or workspace Markdown.
- Surface key pattern: `task:<source>:<task-id>`.
- Completion rule: close the matching Chieflane surface after the canonical task is complete and no longer needs review.
- Blocked rule: patch the surface to `blocked` and include the user note or source blocker.

## Commitment Sources

- Meeting commitments should use `commitment:<meeting-id>:<commitment-id>`.
- Keep the meeting surface visible while follow-up commitments are pending.
- Prefer patching an existing commitment surface over publishing a duplicate.
