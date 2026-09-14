"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { gradeAny, type Grade } from "@/lib/grade";
import { ACCENT_KEYS, applyShortcut, insertAt } from "@/lib/accents";
import { TOPICS, type Generated, type Topic, type TopicId } from "@/lib/practical";
import { GRAMMAR_TOPICS, type GrammarId } from "@/lib/grammar";
import AccentBar from "./AccentBar";
import { useTracker } from "@/lib/tracker";
import { classifyError } from "@/lib/db/classify";

const subscribeNever = () => () => {};

/** Generated ids are "<topic>-<detail>"; the prefix is the topic. */
const topicOf = (id: string) => id.split("-")[0];

/**
 * Numbers and grammar are the same drill over different generators, so the
 * component takes a set id and looks the topics up here. Topic objects carry a
 * generate() function, which cannot cross the server/client boundary — only
 * the ids do.
 */
const SETS = {
  numbers: TOPICS as { id: string; title: string; generate: Topic["generate"] }[],
  grammar: GRAMMAR_TOPICS,
} as const;

export type DrillSet = keyof typeof SETS;

const randomItem = (topics: { generate: Topic["generate"] }[]): Generated =>
  topics[Math.floor(Math.random() * topics.length)].generate(Math.random);

/**
 * Unlike the vocabulary quiz, this never runs out — every question is
 * generated. So there is no queue and no end screen; the score just counts up
 * until you leave.
 */
export default function PracticalDrill({
  title,
  topicIds,
  set = "numbers",
}: {
  title: string;
  // Ids, not Topic objects: a Topic carries a generate() function, and
  // functions cannot cross the server/client boundary.
  topicIds: (TopicId | GrammarId)[];
  /** Which generator set the ids name. */
  set?: DrillSet;
}) {
  const topics = useMemo(
    () => SETS[set].filter((t) => (topicIds as string[]).includes(t.id)),
    [topicIds, set]
  );

  // Generated content differs every render, so it must not run during the
  // prerender — the server and first client render have to match.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  // A lazy initialiser runs exactly once, so the question is stable across
  // re-renders. It also runs during the prerender, which is why `mounted`
  // gates the render below: the server's pick and the client's would differ.
  const [item, setItem] = useState<Generated>(() => randomItem(topics));
  const shown = item;
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<Grade | null>(null);
  // Tagged "numbers" for both sets: the dashboard aggregates filter on
  // kind = 'vocab', so a third kind would need a schema change to show up at
  // all. The scope still says which drill it was.
  const tracker = useTracker({
    kind: "numbers",
    scope: topicIds.length === 1 ? topicIds[0] : set === "grammar" ? "grammar" : "all",
    direction: "n-a",
  });
  // Set when each question is shown; Date.now() must not run during render.
  const askedAt = useRef<number>(0);
  const [asked, setAsked] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const nextItem = useCallback(() => {
    setItem(randomItem(topics));
    setValue("");
    setPending(null);
    askedAt.current = Date.now();
  }, [topics]);

  useEffect(() => {
    if (shown) inputRef.current?.focus();
    askedAt.current = Date.now();
  }, [shown]);

  const check = (given: string) => {
    if (!shown || pending) return;
    const result = gradeAny(given, shown.answers);
    setPending(result);

    tracker.record({
      kind: "numbers",
      scope: topicOf(shown.id),
      // Generated questions have no fixed vocabulary key; the topic and the
      // prompt together identify what was asked ("times|10:45 pm").
      wordKey: `${topicOf(shown.id)}|${shown.prompt}`,
      direction: "n-a",
      prompt: shown.prompt,
      expected: result.status === "correct" ? given : shown.answers[0],
      given,
      status: result.status,
      errorKind: classifyError(given, shown.answers[0], result.status),
      ms: Date.now() - askedAt.current,
    });

    setAsked((n) => n + 1);
    if (result.status === "correct") {
      setCorrect((n) => n + 1);
      setStreak((n) => n + 1);
    } else {
      setStreak(0);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const hit = applyShortcut(el.value, el.selectionStart ?? el.value.length);
    if (!hit) return setValue(el.value);
    setValue(hit.text);
    requestAnimationFrame(() => el.setSelectionRange(hit.caret, hit.caret));
  };

  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el || pending) return;
    const { text, caret } = insertAt(
      value,
      el.selectionStart ?? value.length,
      el.selectionEnd ?? value.length,
      ch
    );
    setValue(text);
    el.focus();
    requestAnimationFrame(() => el.setSelectionRange(caret, caret));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !pending) {
      e.preventDefault();
      check("");
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      const ch = ACCENT_KEYS[Number(e.key) - 1];
      if (ch) {
        e.preventDefault();
        insert(ch);
      }
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) nextItem();
    else if (value.trim()) check(value);
  };

  if (!mounted)
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-[15px] text-ink-faint">Loading…</p>
      </div>
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Back to all modules"
            className="-ml-2 inline-flex h-11 shrink-0 items-center rounded-md px-2 text-[14px] text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          >
            ←
          </Link>
          <span className="truncate text-[14px] text-ink-soft">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-[13px] tabular-nums text-ink-faint">
          <span className="text-clay" aria-live="polite">
            {streak >= 3 ? `${streak} in a row` : ""}
          </span>
          <span>{asked ? `${correct} / ${asked}` : "—"}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-8 sm:px-8">
        <p className="text-[13px] uppercase tracking-[0.14em] text-ink-faint">
          Write it out in French
        </p>

        {/* Grammar prompts are English sentences, so they read better in the
            text face at a size that fits a full clause. */}
        <h2
          className={
            set === "grammar"
              ? "mt-3 text-balance font-serif text-3xl leading-tight tracking-[-0.015em] sm:text-4xl"
              : "answer-input mt-3 text-balance text-4xl leading-tight tracking-[-0.02em] tabular-nums sm:text-5xl"
          }
        >
          {shown.prompt}
        </h2>

        {shown.hint && !pending && (
          <p className="mt-3 text-[15px] italic text-ink-faint">{shown.hint}</p>
        )}

        <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="mt-8">
          <input
            ref={inputRef}
            value={value}
            onChange={onChange}
            readOnly={!!pending}
            placeholder="en toutes lettres"
            aria-label="Your answer in French"
            lang="fr"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint={pending ? "next" : "done"}
            className={`answer-input w-full border-b-2 bg-transparent pb-3 text-2xl outline-none transition-colors sm:text-3xl ${
              pending
                ? pending.status === "correct"
                  ? "border-correct text-correct"
                  : "border-clay text-ink"
                : "border-rule-strong focus:border-ink"
            }`}
          />

          {!pending && <AccentBar onInsert={insert} />}

          {pending && <DrillFeedback grade={pending} item={shown} given={value} />}

          <div className="mt-8 flex items-center gap-3">
            <button
              type="submit"
              className="h-12 flex-1 rounded-md bg-ink text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:flex-none sm:px-10"
            >
              {pending ? "Next" : "Check"}
            </button>

            {!pending && (
              <button
                type="button"
                onClick={() => check("")}
                title="Reveal the answer (Esc)"
                className="inline-flex h-12 shrink-0 items-center rounded-md border border-rule-strong px-5 text-[15px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              >
                Skip
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}

function DrillFeedback({
  grade,
  item,
  given,
}: {
  grade: Grade;
  item: Generated;
  given: string;
}) {
  if (grade.status === "correct")
    return <p className="mt-4 text-[15px] font-medium text-correct">Correct.</p>;

  // Where several forms are right, show the others too — that's the lesson.
  const others = item.answers.filter((a) => a !== grade.expected);

  return (
    <div
      className={`mt-4 rounded-md px-4 py-3 ${
        grade.status === "accent" ? "bg-warn-bg" : "bg-clay-soft"
      }`}
    >
      <p
        className={`text-[13px] font-medium uppercase tracking-[0.1em] ${
          grade.status === "accent" ? "text-warn" : "text-clay"
        }`}
      >
        {grade.status === "accent"
          ? "Accents"
          : given.trim()
            ? "Not quite"
            : "Skipped"}
      </p>
      <p lang="fr" className="answer-input mt-1.5 break-words text-xl text-ink">
        {grade.expected}
      </p>
      {others.length > 0 && (
        <p className="mt-2 text-[14px] text-ink-soft">
          Also correct:{" "}
          <span lang="fr" className="answer-input">
            {others.join(" · ")}
          </span>
        </p>
      )}
    </div>
  );
}
