"use client";

import { useEffect, useMemo, useState } from "react";
import { PUSH_DISABLED_KEY } from "./PwaRuntime";

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

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);
    if (!isSupported) {
      return;
    }

    void (async () => {
      const [configResponse, registration] = await Promise.all([
        fetch("/api/push/public-key", { cache: "no-store" }),
        navigator.serviceWorker.ready,
      ]);

      const config = (await configResponse.json()) as {
        enabled: boolean;
        publicKey?: string | null;
      };

      setAvailable(config.enabled);
      setPublicKey(config.publicKey ?? null);

      if (!config.enabled) {
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      setEnabled(Boolean(subscription));
    })().catch(() => {
      setMessage("Push setup is unavailable right now.");
    });
  }, []);

  const buttonLabel = useMemo(() => {
    if (!supported) {
      return "Notifications unavailable";
    }
    if (!available) {
      return "Push not configured";
    }
    if (enabled) {
      return "Disable notifications";
    }
    return "Enable notifications";
  }, [available, enabled, supported]);

  if (!supported) {
    return null;
  }

  const handleEnable = async () => {
    if (!publicKey) {
      setMessage("Set VAPID keys to enable push.");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notifications are still blocked.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      window.localStorage.removeItem(PUSH_DISABLED_KEY);
      setEnabled(true);
      setMessage("Notifications enabled for urgent surfaces.");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setEnabled(false);
        return;
      }

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      window.localStorage.setItem(PUSH_DISABLED_KEY, "true");
      setEnabled(false);
      setMessage("Notifications disabled.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-text-primary">
            Push notifications
          </h2>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-text-secondary max-w-[50ch]">
            Get notified when a high-priority surface is blocked, awaiting review,
            or newly published.
          </p>
        </div>

        <button
          type="button"
          onClick={enabled ? handleDisable : handleEnable}
          disabled={busy || !available}
          className="inline-flex items-center justify-center border border-border px-4 py-2 text-[0.8125rem] font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
        >
          {buttonLabel}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 text-[0.75rem] text-text-tertiary">
        {message}
      </p>
    </div>
  );
}
