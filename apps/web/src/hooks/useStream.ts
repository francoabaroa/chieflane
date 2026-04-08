"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { StreamEvent } from "@/lib/types";

export function useStream(onEvent: (event: StreamEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handleStreamEvent = useEffectEvent((event: MessageEvent) => {
    try {
      onEvent(JSON.parse(event.data) as StreamEvent);
    } catch {
      // Ignore malformed event payloads.
    }
  });

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const connect = () => {
      if (!active) {
        return;
      }

      const eventSource = new EventSource("/api/stream");
      eventSourceRef.current = eventSource;

      const handleEvent = (event: MessageEvent) => {
        handleStreamEvent(event);
      };

      eventSource.addEventListener("surface.updated", handleEvent);
      eventSource.addEventListener("surface.closed", handleEvent);
      eventSource.addEventListener("action.progress", handleEvent);

      eventSource.onerror = () => {
        eventSource.close();
        if (!active) {
          return;
        }
        reconnectTimer = setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      eventSourceRef.current?.close();
    };
  }, []);

  return eventSourceRef;
}
