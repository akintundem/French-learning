"use client";

import { useCallback, useEffect, useRef } from "react";
import type { NewAttempt } from "./db/types";

type Pending = Omit<NewAttempt, "sessionId">;

/**
 * Records attempts without getting in the way of the quiz. Everything is
 * queued and flushed in the background: a failed write loses a few rows of
 * statistics, which must never block or slow down answering.
 */
export function useTracker(opts: {
  kind: "vocab" | "numbers";
  scope: string;
  direction: string;
}) {
  const sessionId = useRef<string | null>(null);
  const queue = useRef<Pending[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { kind, scope, direction } = opts;

  const flush = useCallback(async () => {
    const id = sessionId.current;
    if (!id || !queue.current.length) return;
    const batch = queue.current.splice(0, queue.current.length);
    try {
      await fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attempts: batch.map((a) => ({ ...a, sessionId: id })),
        }),
        keepalive: true,
      });
    } catch {
      // Statistics are best-effort; never surface a write failure to the learner.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, scope, direction }),
        });
        const { id } = await res.json();
        if (!cancelled) {
          sessionId.current = id;
          void flush(); // anything answered before the session landed
        }
      } catch {
        // Practice continues untracked.
      }
    })();

    return () => {
      cancelled = true;
      void flush();
    };
  }, [kind, scope, direction, flush]);

  // A closing tab should not lose the last few answers.
  useEffect(() => {
    const onHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  const record = useCallback(
    (a: Pending) => {
      queue.current.push(a);
      if (timer.current) clearTimeout(timer.current);
      // Batch a few answers together rather than one request per question.
      timer.current = setTimeout(() => void flush(), 1500);
    },
    [flush]
  );

  return { record };
}
