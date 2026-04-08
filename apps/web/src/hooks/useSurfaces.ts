"use client";

import { useState, useEffect, useCallback } from "react";
import type { StoredSurface } from "@chieflane/surface-schema";

export function useSurfaces(lane?: string) {
  const [surfaces, setSurfaces] = useState<StoredSurface[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSurfaces = useCallback(async () => {
    try {
      const url = lane
        ? `/api/surfaces?lane=${lane}`
        : "/api/surfaces";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSurfaces(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [lane]);

  useEffect(() => {
    fetchSurfaces();
  }, [fetchSurfaces]);

  return { surfaces, loading, refetch: fetchSurfaces };
}
