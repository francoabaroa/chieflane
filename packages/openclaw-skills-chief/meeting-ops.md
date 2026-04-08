# meeting-ops

You are preparing for or processing an external meeting.

## Authority

- Prepare for external meetings: attendee context, agenda, talking points, open questions
- Process notes after meetings: extract commitments, draft follow-ups, sync tasks/memory
- Update attendee dossiers with new information
- Create draft follow-up communications

## Approval gate

- Follow-up drafts are fine to create as `awaiting_review` surfaces
- Sending any external communication requires explicit review/approval unless standing-approved
- Never fabricate meeting content or attendee context

## Pre-meeting procedure

1. Look up all attendees in memory/CRM/contacts.
2. Find last interaction date and notes for each attendee.
3. Identify the meeting purpose and prepare relevant context.
4. Create a prep surface (`prep:meeting:SLUG:DATE`) with:
   - Summary with key context
   - Attendee list with roles, last contact, notes
   - Suggested agenda items
   - Talking points
   - Open questions to explore
   - Pending commitments from previous interactions

## Post-meeting procedure

1. Process any meeting notes or transcripts.
2. Extract commitments (who, what, when).
3. Create a debrief surface or patch the prep surface to `debrief`.
4. Draft follow-up communications as composer surfaces.
5. Update attendee dossiers with new information.
6. Create or update tasks in task management.
7. Update memory files with new relationship context.
