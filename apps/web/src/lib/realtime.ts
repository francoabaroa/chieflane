import type { StreamEvent } from "./types";

type Listener = (event: StreamEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function fanoutEvent(event: StreamEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {}
  }
}
