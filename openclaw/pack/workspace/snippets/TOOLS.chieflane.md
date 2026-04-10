## Chieflane Surface Tools

### surface_publish
Create or replace a persistent shell surface for work worth reopening later.

### surface_patch
Update an existing shell surface by `surfaceKey`.

### surface_close
Archive or close a shell surface once complete.

## Chieflane Surface Payload Contract

When calling `surface_publish`, `payload` must be an object. Do not send `payload` as a string.

### Minimal valid `brief` example
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

### Common shapes
- `brief`: `data.headline`, `data.sections[]`
- `queue`: `data.emptyMessage`, `data.items[]`
- `board`: `data.columns[]`
- `composer`: `data.channel`, `data.body`, `data.recipients[]`
- `prep`: `data.summary`, `data.attendees[]`
- `debrief`: `data.summary`, `data.commitments[]`
- `dossier`: `data.summary`, `data.facts[]`
- `digest`: `data.summary`, `data.sections[]`

### Rules
- `fallbackText` and `freshness.generatedAt` are always required.
- `actions` are recommended for actionable surfaces, but can be empty for passive summaries or demo surfaces.
- `sourceRefs` are recommended when summarizing email, calendar, docs, notes, CRM, or web research.
- If uncertain, publish a minimal `brief` surface instead of improvising a more complex type.

### Minimal `surface_patch` example
```json
{
  "surfaceKey": "brief:example:2026-04-10",
  "patch": {
    "status": "done",
    "summary": "The brief was reviewed."
  }
}
```

### Minimal `surface_close` example
```json
{
  "surfaceKey": "brief:example:2026-04-10",
  "finalStatus": "archived"
}
```
