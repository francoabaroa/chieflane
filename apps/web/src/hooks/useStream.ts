"use client";

import { useEffect, useRef } from "react";
import type { StreamEvent } from "@/lib/types";

export function useStream(onEvent: (event: StreamEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const handleStreamEvent = (event: MessageEvent) => {
      try {
        onEventRef.current(JSON.parse(event.data) as StreamEvent);
      } catch {
        // Ignore malformed event payloads.
      }
    };

    const connect = () => {
      if (!active) {
        return;
      }

      const eventSource = new EventSource("/api/stream");
      eventSourceRef.current = eventSource;
      eventSource.addEventListener("surface.updated", handleStreamEvent);
      eventSource.addEventListener("surface.closed", handleStreamEvent);
      eventSource.addEventListener("action.progress", handleStreamEvent);

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
