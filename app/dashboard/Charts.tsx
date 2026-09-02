"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dashboard } from "@/lib/db/types";
import type { Projection } from "@/lib/db/goal";

// Categorical slots, validated for both themes with the dataviz palette
// checker (lightness band, chroma floor, CVD separation, contrast).
const SERIES = {
  accent:  "var(--s-accent)",
  article: "var(--s-article)",
  unknown: "var(--s-unknown)",
  skipped: "var(--s-skipped)",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function Charts({
  data,
  goal,
  totalWords,
  moduleTitles,
}: {
  data: Dashboard;
  goal: Projection;
  totalWords: number;
  moduleTitles: Record<string, string>;
}) {
  if (!data.totals.attempts) return <EmptyState />;

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 sm:px-8">
      <Goal goal={goal} totalWords={totalWords} />
      <Headlines data={data} />
      <Activity data={data} />
      <Errors data={data} />
      <Modules data={data} titles={moduleTitles} />
      <WeakWords data={data} />
      <Danger />
    </main>
  );
}

function EmptyState() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <p className="text-[15px] text-ink-soft">
        Answer some questions and this page will show what is sticking, what
        isn&apos;t, and whether you are on pace for 70%.
      </p>
      <Link
        href="/practice/all"
        className="mt-6 inline-flex h-11 items-center rounded-md bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
      >
        Start practising
      </Link>

      {/* This page looks identical whether you have not practised yet or the
          database is silently rejecting every write, so point at the check
          that tells the two apart. */}
      <p className="mt-10 border-t border-rule pt-6 text-[14px] text-ink-faint">
        Already answered questions and still seeing this? Storage is not saving
        them.{" "}
        <a
          href="/api/health"
          className="text-clay underline underline-offset-4 hover:text-ink"
        >
          Run the storage check
        </a>{" "}
        — it writes a row, reads it back, and names whatever fails.
      </p>
    </main>
  );
}

/** The headline: a meter against the 70% target, not a chart. */
function Goal({ goal, totalWords }: { goal: Projection; totalWords: number }) {
  const share = goal.fraction;
  const targetShare = goal.target / totalWords;

  return (
    <section className="pt-10">
      <h2 className="text-[13px] uppercase tracking-[0.14em] text-ink-faint">
        Toward 70%
      </h2>

      <p className="mt-3 font-serif text-5xl tabular-nums tracking-[-0.02em]">
        {goal.mastered.toLocaleString()}
        <span className="text-ink-faint"> / {goal.target.toLocaleString()}</span>
      </p>
      <p className="mt-1 text-[15px] text-ink-soft">
        words mastered — {pct(share)} of all {totalWords.toLocaleString()}
      </p>

      <div className="relative mt-5 h-3 w-full overflow-hidden rounded-full bg-rule">
        <div
          className="h-full rounded-full bg-clay transition-[width] duration-500"
          style={{ width: `${Math.min(share * 100, 100)}%` }}
        />
        {/* The 70% line, so the bar is read against the goal not the full width. */}
        <div
          className="absolute inset-y-0 w-px bg-ink"
          style={{ left: `${targetShare * 100}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-[13px] text-ink-faint">
        Mastered = answered correctly 3+ times, right the last two in a row.
      </p>

      <p className="mt-4 text-[15px] text-ink-soft">
        {!goal.projectedDate ? (
          "Not enough history yet to project a finish date — practise on three separate days."
        ) : (
          <>
            At {goal.perDay.toFixed(1)} words a day, you reach 70% around{" "}
            <span className="text-ink">{formatDate(goal.projectedDate)}</span> —{" "}
            {goal.daysRemaining} days of practice away.
          </>
        )}
      </p>
    </section>
  );
}

function Headlines({ data }: { data: Dashboard }) {
  const tiles = [
    { label: "Accuracy", value: pct(data.totals.accuracy), sub: `${data.totals.correct} of ${data.totals.attempts}` },
    { label: "Words seen", value: data.totals.wordsSeen.toLocaleString(), sub: "distinct" },
    { label: "Day streak", value: String(data.currentStreakDays), sub: data.currentStreakDays === 1 ? "day" : "days" },
    { label: "Sessions", value: String(data.totals.sessions), sub: "all time" },
  ];

  return (
    <section className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-rule sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-paper-raised px-4 py-4">
          <p className="text-[12px] uppercase tracking-[0.12em] text-ink-faint">
            {t.label}
          </p>
          <p className="mt-1.5 font-serif text-2xl tabular-nums">{t.value}</p>
          <p className="text-[13px] text-ink-faint">{t.sub}</p>
        </div>
      ))}
    </section>
  );
}

/** Attempts per day. A column chart: magnitude over time. */
function Activity({ data }: { data: Dashboard }) {
  const days = data.activity;
  if (!days.length) return null;

  const max = Math.max(...days.map((d) => d.attempts), 1);

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h2 className="font-serif text-xl tracking-[-0.01em]">Activity</h2>
        <span className="text-sm text-ink-faint">Answers per day</span>
      </div>

      <div className="mt-5 flex h-32 items-end gap-1 overflow-x-auto">
        {days.map((d) => {
          const accuracy = d.attempts ? d.correct / d.attempts : 0;
          return (
            <div
              key={d.day}
              className="group relative flex min-w-2 flex-1 flex-col justify-end"
              title={`${formatDate(d.day)} · ${d.attempts} answers, ${pct(accuracy)} correct`}
            >
              <div
                className="rounded-t-[3px] bg-clay transition-opacity group-hover:opacity-70"
                style={{ height: `${Math.max((d.attempts / max) * 100, 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-ink-faint">
        <span>{formatDate(days[0].day)}</span>
        <span>{formatDate(days[days.length - 1].day)}</span>
      </div>
    </section>
  );
}

/** Why answers were wrong. A stacked bar: parts of one whole. */
function Errors({ data }: { data: Dashboard }) {
  const e = data.errors;
  const total = e.accent + e.article + e.unknown + e.skipped;
  if (!total) return null;

  const parts = [
    { key: "accent", label: "Accent only", n: e.accent, color: SERIES.accent,
      note: "You know the word — the accent slipped." },
    { key: "article", label: "Wrong article", n: e.article, color: SERIES.article,
      note: "You know the word but not its gender." },
    { key: "unknown", label: "Not known", n: e.unknown, color: SERIES.unknown,
      note: "Genuinely new or forgotten." },
    { key: "skipped", label: "Skipped", n: e.skipped, color: SERIES.skipped,
      note: "Revealed without answering." },
  ].filter((p) => p.n > 0);

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h2 className="font-serif text-xl tracking-[-0.01em]">Why answers miss</h2>
        <span className="text-sm text-ink-faint">{total} wrong</span>
      </div>

      <div className="mt-5 flex h-8 gap-0.5 overflow-hidden rounded-md">
        {parts.map((p) => (
          <div
            key={p.key}
            style={{ width: `${(p.n / total) * 100}%`, background: p.color }}
            title={`${p.label}: ${p.n}`}
          />
        ))}
      </div>

      {/* Legend doubles as the explanation — colour alone never carries meaning. */}
      <ul className="mt-4 space-y-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-baseline gap-3 text-[15px]">
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: p.color }}
              aria-hidden
            />
            <span className="w-32 shrink-0 text-ink">{p.label}</span>
            <span className="w-16 shrink-0 tabular-nums text-ink-soft">
              {p.n} · {pct(p.n / total)}
            </span>
            <span className="text-ink-faint">{p.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Per-module accuracy, worst first. */
function Modules({
  data,
  titles,
}: {
  data: Dashboard;
  titles: Record<string, string>;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = [...data.byScope]
    .filter((r) => r.attempts >= 3)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (!rows.length) return null;
  const shown = showAll ? rows : rows.slice(0, 8);

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h2 className="font-serif text-xl tracking-[-0.01em]">By module</h2>
        <span className="text-sm text-ink-faint">Weakest first</span>
      </div>

      <ul>
        {shown.map((r) => (
          <li
            key={r.scope}
            className="flex items-center gap-3 border-b border-rule py-3"
          >
            <Link
              href={`/practice/${r.scope}`}
              className="w-10 shrink-0 font-mono text-[13px] text-ink-faint hover:text-clay"
            >
              {r.scope}
            </Link>
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
              {titles[r.scope] ?? r.scope}
            </span>
            <div className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-rule sm:block">
              <div
                className="h-full rounded-full bg-clay"
                style={{ width: `${r.accuracy * 100}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-[14px] tabular-nums text-ink-soft">
              {pct(r.accuracy)}
            </span>
          </li>
        ))}
      </ul>

      {rows.length > 8 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 h-9 rounded-md px-2 text-[14px] text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}

/** The specific words being missed — a table, because the words are the point. */
function WeakWords({ data }: { data: Dashboard }) {
  if (!data.weakestWords.length) return null;

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h2 className="font-serif text-xl tracking-[-0.01em]">Words to fix</h2>
        <span className="text-sm text-ink-faint">Most missed</span>
      </div>

      <ul>
        {data.weakestWords.map((w) => (
          <li
            key={w.wordKey}
            className="flex flex-col gap-1 border-b border-rule py-3 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <span className="flex-1 text-[15px] text-ink-soft">{w.prompt}</span>
            <span lang="fr" className="answer-input flex-1 text-[17px] text-ink">
              {w.expected}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-ink-faint">
              {w.correct} of {w.attempts}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Danger() {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="mt-16 border-t border-rule pt-6">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[15px] text-ink">
            Delete all recorded progress? This cannot be undone.
          </span>
          <button
            onClick={async () => {
              await fetch("/api/dashboard", { method: "DELETE" });
              location.reload();
            }}
            className="h-9 rounded-md bg-clay px-4 text-[14px] font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Yes, delete
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="h-9 rounded-md px-3 text-[14px] text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="h-9 rounded-md px-2 text-[14px] text-ink-faint transition-colors hover:text-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
        >
          Reset all progress
        </button>
      )}
    </section>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
