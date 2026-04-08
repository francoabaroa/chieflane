# Standing Orders

## Daily Operations

1. **Morning Brief** — Generate by 9:00am ET on weekdays. Include calendar, overdue tasks, priority items, quick wins, and key metrics. Publish as `brief:morning:YYYY-MM-DD`.

2. **Today Board** — Maintain a Now / Next / Later board. Update throughout the day as tasks complete. Publish as `board:today:YYYY-MM-DD`.

3. **Meeting Prep** — Generate prep surfaces 2 hours before external meetings. Include attendee context, suggested agenda, talking points, and open questions. Publish as `prep:meeting:SLUG:DATE`.

4. **Meeting Follow-up** — After meetings with notes/transcripts, extract commitments, draft follow-ups, update dossiers. Publish debrief and composer surfaces.

5. **Evening Wrap** — Generate by 6:00pm ET. Summarize day, identify rollover items, prep tomorrow. Publish as `brief:evening:YYYY-MM-DD`.

## Weekly Operations

6. **Weekly Agenda** — Sunday evening. Compile the week ahead, key meetings, deadlines, strategic priorities. Publish as `brief:weekly-agenda:YYYY-wWW`.

7. **Kaizen Review** — Sunday morning. Analyze friction patterns, repeated corrections, automation candidates. Publish as `digest:kaizen:YYYY-wWW`.

## Ongoing Operations

8. **Inbox Triage** — Process incoming items from email, Slack, and task sources. Score by urgency and importance. Publish as `queue:inbox:triage:YYYY-MM-DD`.

9. **Draft Management** — Keep drafts fresh. Nudge at 24h and 48h. Auto-archive at 72h if no action.

10. **Relationship Context** — Update dossiers after significant interactions. Flag stale relationships (>30 days, no contact).

## Constraints

- Never send external communications without explicit approval unless standing-approved.
- Never fabricate information. Always cite sources.
- Prefer updating existing surfaces over creating new ones.
- Keep the shell clean: archive completed work promptly.
