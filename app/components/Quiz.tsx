"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Word } from "@/lib/vocab";
import type { Direction } from "@/lib/grade";
import { answerOf, promptOf, useSession } from "@/lib/session";
import { grade } from "@/lib/grade";
import { ACCENT_KEYS, applyShortcut, insertAt } from "@/lib/accents";
import { useTracker } from "@/lib/tracker";
import { classifyError } from "@/lib/db/classify";
import AccentBar from "./AccentBar";

export default function Quiz({
  title,
  words,
  limit,
  scope,
}: {
  title: string;
  words: Word[];
  limit?: number;
  /** Module id (or "all"/"random") — what the statistics are grouped by. */
  scope: string;
}) {
  const [direction, setDirection] = useState<Direction>("en-fr");
  const tracker = useTracker({ kind: "vocab", scope, direction });
  // Set when each question is shown; Date.now() must not run during render.
  const askedAt = useRef<number>(0);
  const s = useSession(words, direction, limit);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Refocus after every advance so a full round can be typed without reaching
  // for the mouse — and so mobile keyboards stay up.
  useEffect(() => {
    if (!s.done) inputRef.current?.focus();
    askedAt.current = Date.now();
  }, [s.index, s.done]);

  const submit = (given: string) => {
    if (!s.current || s.pending) return;
    const expected = answerOf(s.current, direction);
    const result = grade(given, expected, direction);

    tracker.record({
      kind: "vocab",
      scope,
      wordKey: `${scope}|${s.current.fr}`,
      direction,
      prompt: promptOf(s.current, direction),
      expected,
      given,
      status: result.status,
      errorKind: classifyError(given, expected, result.status),
      ms: Date.now() - askedAt.current,
    });

    s.submit(given);
  };

  const advance = () => {
    s.next();
    setValue("");
    askedAt.current = Date.now();
  };

  // Accents only matter when the answer is French.
  const needsAccents = direction === "en-fr";

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    if (!needsAccents) return setValue(raw);

    const hit = applyShortcut(raw, el.selectionStart ?? raw.length);
    if (!hit) return setValue(raw);

    setValue(hit.text);
    // Restore the caret after React re-renders with the converted text.
    requestAnimationFrame(() => el.setSelectionRange(hit.caret, hit.caret));
  };

  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el || s.pending) return;
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

  const changeDirection = (d: Direction) => {
    if (d === direction) return;
    setDirection(d);
    setValue("");
    s.restart();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !s.pending) {
      e.preventDefault();
      submit("");
      return;
    }
    // Alt+1..9 inserts the nine commonest accents without leaving the keyboard.
    if (needsAccents && e.altKey && !e.ctrlKey && !e.metaKey && /^[1-9]$/.test(e.key)) {
      const ch = ACCENT_KEYS[Number(e.key) - 1];
      if (ch) {
        e.preventDefault();
        insert(ch);
      }
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (s.pending) advance();
    else if (value.trim()) submit(value);
  };

  if (!s.ready)
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-[15px] text-ink-faint">Shuffling…</p>
      </div>
    );

  if (s.done)
    return <Results session={s} title={title} direction={direction} />;

  const progress = s.total ? (s.index / s.total) * 100 : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={title} index={s.index} total={s.total} streak={s.streak} />

      <div className="h-px w-full bg-rule">
        <div
          className="h-px bg-clay transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto w-full max-w-xl px-5 pt-6 sm:px-8">
        <DirectionToggle value={direction} onChange={changeDirection} />
      </div>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-8 sm:px-8">
        <p className="text-[13px] uppercase tracking-[0.14em] text-ink-faint">
          {direction === "en-fr" ? "Write in French" : "Write in English"}
        </p>

        <h2
          lang={direction === "en-fr" ? "en" : "fr"}
          className="mt-3 text-balance font-serif text-3xl leading-tight tracking-[-0.015em] sm:text-4xl"
        >
          {promptOf(s.current, direction)}
        </h2>

        {s.current.note && (
          <p className="mt-3 text-[15px] italic text-ink-faint">{s.current.note}</p>
        )}

        <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="mt-8">
          <input
            ref={inputRef}
            value={value}
            onChange={onChange}
            readOnly={!!s.pending}
            placeholder={direction === "en-fr" ? "votre réponse" : "your answer"}
            aria-label={
              direction === "en-fr"
                ? "Your answer in French"
                : "Your answer in English"
            }
            lang={direction === "en-fr" ? "fr" : "en"}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint={s.pending ? "next" : "done"}
            className={`answer-input w-full border-b-2 bg-transparent pb-3 text-2xl outline-none transition-colors sm:text-3xl ${
              s.pending
                ? s.pending.status === "correct"
                  ? "border-correct text-correct"
                  : "border-clay text-ink"
                : "border-rule-strong focus:border-ink"
            }`}
          />

          {needsAccents && !s.pending && (
            <AccentBar onInsert={insert} disabled={!!s.pending} />
          )}

          {s.pending && (
            <Feedback grade={s.pending} given={value} direction={direction} />
          )}

          <div className="mt-8 flex items-center gap-3">
            <button
              type="submit"
              className="h-12 flex-1 rounded-md bg-ink text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:flex-none sm:px-10"
            >
              {s.pending ? "Next" : "Check"}
            </button>

            {!s.pending && (
              <button
                type="button"
                onClick={() => submit("")}
                title="Reveal the answer (Esc)"
                className="inline-flex h-12 shrink-0 items-center rounded-md border border-rule-strong px-5 text-[15px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              >
                Skip
              </button>
            )}
          </div>

          <p className="mt-4 hidden text-[13px] text-ink-faint sm:block">
            {s.pending ? (
              <>
                Press <Key>Enter</Key> to continue
              </>
            ) : (
              <>
                <Key>Enter</Key> to check &middot; <Key>Esc</Key> to skip
                {needsAccents && (
                  <>
                    {" "}
                    &middot; type <Key>e&apos;</Key> for é, <Key>c,</Key> for ç
                  </>
                )}
              </>
            )}
          </p>
        </form>
      </main>
    </div>
  );
}

function DirectionToggle({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (d: Direction) => void;
}) {
  const options: { id: Direction; label: string; hint: string }[] = [
    { id: "en-fr", label: "EN → FR", hint: "Read English, write French" },
    { id: "fr-en", label: "FR → EN", hint: "Read French, write English" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Practice direction"
      className="inline-flex rounded-md border border-rule p-0.5"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.id)}
            className={`h-9 rounded px-3 text-[13px] font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-rule-strong bg-paper-raised px-1.5 py-0.5 font-sans text-[12px] text-ink-soft">
      {children}
    </kbd>
  );
}

function Feedback({
  grade,
  given,
  direction,
}: {
  grade: NonNullable<ReturnType<typeof useSession>["pending"]>;
  given: string;
  direction: Direction;
}) {
  if (grade.status === "correct") {
    return (
      <p className="mt-4 text-[15px] font-medium text-correct">Correct.</p>
    );
  }

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
      <p
        lang={direction === "en-fr" ? "fr" : "en"}
        className={`mt-1.5 break-words text-xl text-ink ${
          direction === "en-fr" ? "answer-input" : ""
        }`}
      >
        {grade.expected}
      </p>
    </div>
  );
}

function Header({
  title,
  index,
  total,
  streak,
}: {
  title: string;
  index: number;
  total: number;
  streak: number;
}) {
  return (
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
        <span>
          {Math.min(index + 1, total)} / {total}
        </span>
      </div>
    </header>
  );
}

function Results({
  session: s,
  title,
  direction,
}: {
  session: ReturnType<typeof useSession>;
  title: string;
  direction: Direction;
}) {
  const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 sm:px-8 sm:py-20">
      <p className="text-[13px] uppercase tracking-[0.14em] text-ink-faint">
        {title}
      </p>
      <h2 className="mt-3 font-serif text-4xl tracking-[-0.015em]">
        {s.correct} of {s.total}
      </h2>
      <p className="mt-2 text-[17px] text-ink-soft">
        {pct}% correct
        {s.bestStreak >= 3 && ` · best run of ${s.bestStreak}`}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        {s.missed.length > 0 && (
          <button
            onClick={() => s.restart(s.missed)}
            className="h-11 rounded-md bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          >
            Redo the {s.missed.length} you missed
          </button>
        )}
        <button
          onClick={() => s.restart()}
          className="h-11 rounded-md border border-rule-strong px-5 text-[15px] font-medium text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
        >
          Start over
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-md px-3 text-[15px] text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
        >
          All modules
        </Link>
      </div>

      {s.missed.length > 0 && (
        <section className="mt-12">
          <h3 className="border-b border-rule pb-3 text-[13px] uppercase tracking-[0.14em] text-ink-faint">
            To review
          </h3>
          <ul>
            {s.answered
              .filter((a) => a.result.status !== "correct")
              .map((a, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-1 border-b border-rule py-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="flex-1 text-[15px] text-ink-soft">
                    {promptOf(a.word, direction)}
                  </span>
                  <span
                    lang={direction === "en-fr" ? "fr" : "en"}
                    className={`break-words text-[17px] text-ink ${
                      direction === "en-fr" ? "answer-input" : ""
                    }`}
                  >
                    {answerOf(a.word, direction)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
