import webpush from "web-push";
import type { StoredSurface } from "@chieflane/surface-schema";
import { getDb } from "@/lib/db";

type PushSubscriptionRecord = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type PushRow = {
  endpoint: string;
  keys_json: string;
};

function getPushConfig() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function getPushSubscriptions(): PushSubscriptionRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT endpoint, keys_json FROM push_subscriptions")
    .all() as PushRow[];

  return rows.map((row) => ({
    endpoint: row.endpoint,
    ...JSON.parse(row.keys_json),
  }));
}

export function getPushPublicKey() {
  return getPushConfig()?.publicKey ?? null;
}

export function savePushSubscription(subscription: PushSubscriptionRecord) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO push_subscriptions (
      endpoint, keys_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      keys_json = excluded.keys_json,
      updated_at = excluded.updated_at`
  ).run(
    subscription.endpoint,
    JSON.stringify({
      expirationTime: subscription.expirationTime ?? null,
      keys: subscription.keys,
    }),
    now,
    now
  );
}

export function removePushSubscription(endpoint: string) {
  const db = getDb();
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

function shouldNotify(surface: StoredSurface, eventType: "surface.updated" | "surface.closed") {
  if (eventType === "surface.closed") {
    return surface.priority >= 90;
  }

  return (
    surface.priority >= 80 ||
    surface.status === "awaiting_review" ||
    surface.status === "blocked"
  );
}

export async function sendSurfaceNotification(
  surface: StoredSurface,
  eventType: "surface.updated" | "surface.closed"
) {
  const config = getPushConfig();
  if (!config || !shouldNotify(surface, eventType)) {
    return;
  }

  webpush.setVapidDetails(
    config.subject,
    config.publicKey,
    config.privateKey
  );

  const subscriptions = getPushSubscriptions();
  const payload = JSON.stringify({
    title:
      eventType === "surface.closed"
        ? `Completed: ${surface.title}`
        : surface.title,
    body: surface.summary,
    url:
      eventType === "surface.closed"
        ? `/${surface.lane}`
        : `/surface/${surface.id}`,
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          removePushSubscription(subscription.endpoint);
        }
      }
    })
  );
}
