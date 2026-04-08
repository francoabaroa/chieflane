import { v4 as uuid } from "uuid";
import type {
  ActionRunStatus,
  StoredSurface,
  SurfaceEnvelope,
  SurfacePatch,
} from "@chieflane/surface-schema";
import { getDb } from "./index";

type Row = Record<string, unknown>;
const OPEN_SURFACE_STATUS_FILTER = "status NOT IN ('done', 'archived')";

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToSurface(row: Row): StoredSurface {
  return {
    id: row.id as string,
    surfaceKey: row.surface_key as string,
    lane: row.lane as StoredSurface["lane"],
    status: row.status as StoredSurface["status"],
    priority: row.priority as number,
    title: row.title as string,
    subtitle: (row.subtitle as string) || undefined,
    summary: row.summary as string,
    payload: parseJson(
      row.payload_json,
      {} as StoredSurface["payload"]
    ),
    actions: parseJson(row.actions_json, []),
    blocks: parseJson(row.blocks_json, undefined),
    fallbackText: row.fallback_text as string,
    entityRefs: parseJson(row.entity_refs_json, []),
    sourceRefs: parseJson(row.source_refs_json, []),
    freshness: {
      generatedAt: row.generated_at as string,
      expiresAt: (row.expires_at as string) || undefined,
    },
    meta: parseJson(row.meta_json, {}),
    version: row.version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    archivedAt: (row.archived_at as string) || undefined,
  };
}

function getSurfaceRowByKey(surfaceKey: string): Row | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM surfaces WHERE surface_key = ?")
    .get(surfaceKey) as Row | undefined;
}

function getSurfaceRowById(id: string): Row | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM surfaces WHERE id = ?").get(id) as
    | Row
    | undefined;
}

export function recordSurfaceEvent(
  surfaceId: string,
  kind: string,
  payload: Record<string, unknown>,
  actor = "system"
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO surface_events (
      id, surface_id, kind, payload_json, actor, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    surfaceId,
    kind,
    JSON.stringify(payload),
    actor,
    new Date().toISOString()
  );
}

export function createActionRun(args: {
  surfaceId: string;
  actionId: string;
  actionKey?: string;
  input?: Record<string, unknown>;
}) {
  const db = getDb();
  const id = uuid();

  db.prepare(
    `INSERT INTO action_runs (
      id, surface_id, action_id, action_key, status, input_json, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    args.surfaceId,
    args.actionId,
    args.actionKey ?? null,
    "pending",
    JSON.stringify(args.input ?? {}),
    new Date().toISOString()
  );

  return id;
}

export function updateActionRun(args: {
  id: string;
  status: ActionRunStatus;
  output?: Record<string, unknown> | null;
  errorText?: string | null;
}) {
  const db = getDb();
  db.prepare(
    `UPDATE action_runs
     SET status = ?, output_json = ?, error_text = ?, ended_at = ?, started_at = COALESCE(started_at, ?)
     WHERE id = ?`
  ).run(
    args.status,
    args.output ? JSON.stringify(args.output) : null,
    args.errorText ?? null,
    args.status === "running" ? null : new Date().toISOString(),
    new Date().toISOString(),
    args.id
  );
}

export function upsertSurfaceByKey(envelope: SurfaceEnvelope): StoredSurface {
  const db = getDb();
  const now = new Date().toISOString();
  const surfaceType = envelope.payload.surfaceType;
  const existing = getSurfaceRowByKey(envelope.surfaceKey);

  if (existing) {
    const newVersion = (existing.version as number) + 1;
    db.prepare(
      `UPDATE surfaces SET
        lane = ?, surface_type = ?, status = ?, priority = ?,
        title = ?, subtitle = ?, summary = ?,
        payload_json = ?, actions_json = ?, blocks_json = ?,
        fallback_text = ?,
        entity_refs_json = ?, source_refs_json = ?,
        meta_json = ?, version = ?,
        generated_at = ?, expires_at = ?,
        archived_at = CASE WHEN ? = 'archived' THEN COALESCE(archived_at, ?) ELSE NULL END,
        updated_at = ?
      WHERE surface_key = ?`
    ).run(
      envelope.lane,
      surfaceType,
      envelope.status ?? "ready",
      envelope.priority ?? 50,
      envelope.title,
      envelope.subtitle ?? null,
      envelope.summary,
      JSON.stringify(envelope.payload),
      JSON.stringify(envelope.actions ?? []),
      envelope.blocks ? JSON.stringify(envelope.blocks) : null,
      envelope.fallbackText,
      JSON.stringify(envelope.entityRefs ?? []),
      JSON.stringify(envelope.sourceRefs ?? []),
      JSON.stringify(envelope.meta ?? {}),
      newVersion,
      envelope.freshness.generatedAt,
      envelope.freshness.expiresAt ?? null,
      envelope.status ?? "ready",
      now,
      now,
      envelope.surfaceKey
    );

    const updated = getSurfaceRowByKey(envelope.surfaceKey);
    if (!updated) {
      throw new Error(`Unable to update surface ${envelope.surfaceKey}`);
    }

    const surface = rowToSurface(updated);
    recordSurfaceEvent(surface.id, "surface.updated", {
      surfaceKey: surface.surfaceKey,
      version: surface.version,
    });
    return surface;
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO surfaces (
      id, surface_key, lane, surface_type, status, priority,
      title, subtitle, summary,
      payload_json, actions_json, blocks_json,
      fallback_text,
      entity_refs_json, source_refs_json,
      meta_json, version,
      generated_at, expires_at, archived_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
  ).run(
    id,
    envelope.surfaceKey,
    envelope.lane,
    surfaceType,
    envelope.status ?? "ready",
    envelope.priority ?? 50,
    envelope.title,
    envelope.subtitle ?? null,
    envelope.summary,
    JSON.stringify(envelope.payload),
    JSON.stringify(envelope.actions ?? []),
    envelope.blocks ? JSON.stringify(envelope.blocks) : null,
    envelope.fallbackText,
    JSON.stringify(envelope.entityRefs ?? []),
    JSON.stringify(envelope.sourceRefs ?? []),
    JSON.stringify(envelope.meta ?? {}),
    envelope.freshness.generatedAt,
    envelope.freshness.expiresAt ?? null,
    envelope.status === "archived" ? now : null,
    now,
    now
  );

  const inserted = getSurfaceRowById(id);
  if (!inserted) {
    throw new Error(`Unable to create surface ${envelope.surfaceKey}`);
  }

  const surface = rowToSurface(inserted);
  recordSurfaceEvent(surface.id, "surface.published", {
    surfaceKey: surface.surfaceKey,
    version: surface.version,
  });
  return surface;
}

export function patchSurface(
  surfaceKey: string,
  patch: SurfacePatch
): StoredSurface {
  const db = getDb();
  const existing = getSurfaceRowByKey(surfaceKey);

  if (!existing) {
    throw new Error(`Surface not found: ${surfaceKey}`);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.lane !== undefined) {
    fields.push("lane = ?");
    values.push(patch.lane);
  }
  if (patch.status !== undefined) {
    fields.push("status = ?");
    values.push(patch.status);
    fields.push("archived_at = ?");
    values.push(patch.status === "archived" ? new Date().toISOString() : null);
  }
  if (patch.priority !== undefined) {
    fields.push("priority = ?");
    values.push(patch.priority);
  }
  if (patch.title !== undefined) {
    fields.push("title = ?");
    values.push(patch.title);
  }
  if (patch.subtitle !== undefined) {
    fields.push("subtitle = ?");
    values.push(patch.subtitle);
  }
  if (patch.summary !== undefined) {
    fields.push("summary = ?");
    values.push(patch.summary);
  }
  if (patch.payload !== undefined) {
    fields.push("payload_json = ?");
    values.push(JSON.stringify(patch.payload));
    fields.push("surface_type = ?");
    values.push(patch.payload.surfaceType);
  }
  if (patch.actions !== undefined) {
    fields.push("actions_json = ?");
    values.push(JSON.stringify(patch.actions));
  }
  if (patch.blocks !== undefined) {
    fields.push("blocks_json = ?");
    values.push(patch.blocks ? JSON.stringify(patch.blocks) : null);
  }
  if (patch.fallbackText !== undefined) {
    fields.push("fallback_text = ?");
    values.push(patch.fallbackText);
  }
  if (patch.entityRefs !== undefined) {
    fields.push("entity_refs_json = ?");
    values.push(JSON.stringify(patch.entityRefs));
  }
  if (patch.sourceRefs !== undefined) {
    fields.push("source_refs_json = ?");
    values.push(JSON.stringify(patch.sourceRefs));
  }
  if (patch.meta !== undefined) {
    fields.push("meta_json = ?");
    values.push(JSON.stringify(patch.meta));
  }
  if (patch.freshness !== undefined) {
    fields.push("generated_at = ?");
    values.push(patch.freshness.generatedAt);
    fields.push("expires_at = ?");
    values.push(patch.freshness.expiresAt ?? null);
  }

  if (fields.length === 0) {
    throw new Error("Patch payload cannot be empty");
  }

  const newVersion = (existing.version as number) + 1;
  fields.push("version = ?");
  values.push(newVersion);
  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(surfaceKey);

  db.prepare(
    `UPDATE surfaces SET ${fields.join(", ")} WHERE surface_key = ?`
  ).run(...values);

  const updated = getSurfaceRowByKey(surfaceKey);
  if (!updated) {
    throw new Error(`Unable to patch surface ${surfaceKey}`);
  }

  const surface = rowToSurface(updated);
  recordSurfaceEvent(surface.id, "surface.patched", {
    surfaceKey: surface.surfaceKey,
    version: surface.version,
    patch,
  });
  return surface;
}

export function closeSurface(
  surfaceKey: string,
  finalStatus: "done" | "archived" = "archived"
): StoredSurface {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getSurfaceRowByKey(surfaceKey);

  if (!existing) {
    throw new Error(`Surface not found: ${surfaceKey}`);
  }

  const newVersion = (existing.version as number) + 1;
  db.prepare(
    `UPDATE surfaces
     SET status = ?, archived_at = ?, updated_at = ?, version = ?
     WHERE surface_key = ?`
  ).run(finalStatus, now, now, newVersion, surfaceKey);

  const updated = getSurfaceRowByKey(surfaceKey);
  if (!updated) {
    throw new Error(`Unable to close surface ${surfaceKey}`);
  }

  const surface = rowToSurface(updated);
  recordSurfaceEvent(surface.id, "surface.closed", {
    surfaceKey: surface.surfaceKey,
    version: surface.version,
    status: surface.status,
  });
  return surface;
}

export function getSurfacesByLane(lane: string): StoredSurface[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM surfaces
       WHERE lane = ? AND ${OPEN_SURFACE_STATUS_FILTER}
       ORDER BY priority DESC, updated_at DESC`
    )
    .all(lane) as Row[];
  return rows.map(rowToSurface);
}

export function getSurfaceById(id: string): StoredSurface | null {
  const row = getSurfaceRowById(id);
  if (row) {
    return rowToSurface(row);
  }

  const byKey = getSurfaceRowByKey(id);
  return byKey ? rowToSurface(byKey) : null;
}

export function getAllSurfaces(): StoredSurface[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM surfaces
       WHERE ${OPEN_SURFACE_STATUS_FILTER}
       ORDER BY priority DESC, updated_at DESC`
    )
    .all() as Row[];
  return rows.map(rowToSurface);
}
