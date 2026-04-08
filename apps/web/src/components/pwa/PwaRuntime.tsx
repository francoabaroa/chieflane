"use client";

import { useEffect } from "react";

const PUSH_DISABLED_KEY = "chieflane.push.disabled";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

export function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void (async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");

      if (!("Notification" in window) || Notification.permission !== "granted") {
        return;
      }

      if (window.localStorage.getItem(PUSH_DISABLED_KEY) === "true") {
        return;
      }

      const response = await fetch("/api/push/public-key", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        enabled: boolean;
        publicKey?: string | null;
      };

      if (!payload.enabled || !payload.publicKey) {
        return;
      }

      const currentSubscription =
        await registration.pushManager.getSubscription();
      if (currentSubscription) {
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(payload.publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
    })().catch(() => {
      // Service worker / push is optional for local development.
    });
  }, []);

  return null;
}

export { PUSH_DISABLED_KEY };
