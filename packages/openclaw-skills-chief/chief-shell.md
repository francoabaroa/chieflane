# chief-shell

You have access to three shell tools:
- `surface_publish` — create or replace a persistent shell surface
- `surface_patch` — update fields on an existing surface
- `surface_close` — archive or close a surface

## When to publish a surface

Use shell surfaces for work that is:
- Multi-step or approval-driven
- Likely to be reopened, reviewed, or referenced later
- Better presented as structured UI than plain text
- Tied to people, meetings, tasks, drafts, or research
- Part of a recurring workflow (morning brief, weekly review, etc.)

## When NOT to publish a surface

Do NOT publish a surface for:
- Trivial acknowledgements ("Got it", "Done")
- One-off factual answers
- Short confirmations
- Work with no follow-up value
- Anything that won't be reopened

## Surface types

Choose the right frame:
- `brief` — morning brief, evening wrap, weekly agenda
- `queue` — inbox triage, approval queue, outreach queue
- `board` — today board, task sweep (Now / Next / Later)
- `composer` — Gmail drafts, Slack DMs, channel updates, follow-ups
- `prep` — meeting prep, podcast prep
- `debrief` — meeting follow-up, commitment extraction
- `dossier` — LP brief, customer brief, lead research, partner research
- `profile360` — full contact profile with cross-source data
- `review_packet` — hiring packet, reference synthesis, doc/style review
- `digest` — Slack thread analysis, research digest, Kaizen review
- `timeline` — chronological event/activity stream
- `flow_monitor` — task flow / automation run status

## Rules

1. **Reuse surfaceKey.** Prefer updating an existing surface via `surface_patch` instead of creating duplicates. Use stable keys: `brief:morning:YYYY-MM-DD`, `meeting:evt_ID`, `draft:gmail:thread_ID`, `dossier:person:slug`.

2. **Always include fallbackText.** Every surface must have a concise plain-text fallback for chat channels.

3. **Actions are required.** Every surface must expose 1–5 actions that are obvious, clear, and immediately useful. Use `kind: "agent"` for AI-driven actions, `kind: "mutation"` for shell-only state changes, `kind: "navigate"` for linking between surfaces.

4. **Cite your sources.** Every surface must include `sourceRefs` whenever claims come from email, calendar, notes, docs, CRM, or web research.

5. **Use the right lane.** Assign each surface to the correct lane:
   - `today` — daily command center items
   - `inbox` — triage and approval queues
   - `meetings` — prep, debrief, follow-ups
   - `drafts` — messages and communications
   - `people` — contacts and relationships
   - `research` — deep dives and synthesis
   - `ops` — system health, automation monitors, kaizen

6. **Use the right status.** Track lifecycle:
   - `queued` — waiting to be processed
   - `ready` — ready for review
   - `awaiting_review` — needs human decision
   - `blocked` — waiting on external dependency
   - `done` — completed
   - `archived` — no longer needs attention

7. **Close completed work.** When work completes, first patch the surface to `done`, then close/archive it if it no longer needs attention.

8. **Priority matters.** Set 0–100 priority. Higher = more important. Morning brief = 95, FYI items = 30.

9. **Keep summaries skimmable.** The `summary` field should answer "why am I seeing this?" in one sentence.

10. **Freshness is non-negotiable.** Always set `freshness.generatedAt` to the current timestamp. Set `expiresAt` for time-sensitive surfaces.
