"use client";

import { useEffect, useRef } from "react";
import { API_URL, api } from "./api";
import { getAccessToken } from "./session";

type PlanBundle<P, S> = { plan: P; steps: S[] };

/**
 * Subscribe to plan SSE and refresh plan/steps on each event.
 * Keeps compose / feed UIs in sync while approve runs server-side.
 */
export function usePlanStream<P extends { status: string }, S>(
  planId: string | null | undefined,
  onUpdate: (bundle: PlanBundle<P, S>, rawEvent: string) => void,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!planId) return;
    const token = getAccessToken();
    if (!token) return;

    const ctrl = new AbortController();
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/plans/${planId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (alive) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const data = line.slice(6);
            if (data === "ping" || data === ":") continue;
            try {
              const refreshed = await api<PlanBundle<P, S>>(`/api/plans/${planId}`, { token });
              if (alive) onUpdateRef.current(refreshed, data);
            } catch {
              // ignore refresh races
            }
          }
        }
      } catch {
        // aborted / closed
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [planId]);
}
