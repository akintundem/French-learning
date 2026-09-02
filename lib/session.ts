"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { Word } from "./vocab";
import { grade, type Direction, type Grade } from "./grade";

export type Answered = { word: Word; given: string; result: Grade };

/** What the learner reads. */
export const promptOf = (w: Word, d: Direction) => (d === "en-fr" ? w.en : w.fr);

/** What they must type. */
export const answerOf = (w: Word, d: Direction) => (d === "en-fr" ? w.fr : w.en);

// The mounted flag never changes after hydration, so there is nothing to
// subscribe to.
const subscribeNever = () => () => {};

const shuffle = <T,>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function useSession(
  words: Word[],
  direction: Direction = "en-fr",
  limit?: number
) {
  // The page is prerendered, so the server and the first client render must
  // agree. useSyncExternalStore gives a stable server snapshot (false) and a
  // client snapshot of true, so the shuffle happens on the client only —
  // without a setState-in-effect cascade.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );

  const [seed, setSeed] = useState(0);
  const [override, setOverride] = useState<Word[] | null>(null);

  const queue = useMemo(() => {
    if (!mounted) return [];
    void seed; // a new seed forces a fresh shuffle
    const source = override ?? words;
    const shuffled = shuffle(source);
    return override || !limit ? shuffled : shuffled.slice(0, limit);
  }, [mounted, seed, override, words, limit]);

  const ready = mounted;
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [pending, setPending] = useState<Grade | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const current = queue[index];
  const done = index >= queue.length;

  const submit = useCallback(
    (given: string) => {
      if (!current || pending) return;
      // The prompt and the expected answer swap with the direction.
      const result = grade(given, answerOf(current, direction), direction);
      setPending(result);
      setAnswered((a) => [...a, { word: current, given, result }]);
      setStreak((s) => {
        const next = result.status === "correct" ? s + 1 : 0;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    },
    [current, pending, direction]
  );

  const next = useCallback(() => {
    setPending(null);
    setIndex((i) => i + 1);
  }, []);

  const restart = useCallback(
    (only?: Word[]) => {
      setOverride(only?.length ? only : null);
      setSeed((n) => n + 1);
      setIndex(0);
      setAnswered([]);
      setPending(null);
      setStreak(0);
      setBestStreak(0);
    },
    []
  );

  const correct = useMemo(
    () => answered.filter((a) => a.result.status === "correct").length,
    [answered]
  );

  const missed = useMemo(
    () => answered.filter((a) => a.result.status !== "correct").map((a) => a.word),
    [answered]
  );

  return {
    ready,
    current, index, total: queue.length, done, pending,
    answered, correct, missed, streak, bestStreak,
    submit, next, restart,
  };
}
