import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type {
  Dashboard, DayActivity, ErrorBreakdown, NewAttempt, NewSession,
  ScopeStat, Status, Store, Totals, WordStat,
} from "./types";

/**
 * Supabase (Postgres) implementation of Store.
 *
 * The dashboard aggregations live in Postgres as RPC functions — see
 * db/functions.sql — rather than being computed here. Pulling every attempt
 * into the app to count them would get slower every week you practise.
 *
 * There is no service-role key. The public key is granted writes but NOT
 * select, so raw rows cannot be read with it at all — every figure comes back
 * through the aggregate functions. That means inserts cannot read themselves
 * back, so ids are generated here rather than by the database.
 */
export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, key: string) {
    this.db = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  async startSession(s: NewSession): Promise<string> {
    // Generated here, not returned by the database: reading the row back
    // would need a select permission the public key deliberately lacks.
    const id = randomUUID();
    const { error } = await this.db
      .from("sessions")
      .insert({ id, kind: s.kind, scope: s.scope, direction: s.direction });
    if (error) throw new Error(`startSession: ${error.message}`);
    return id;
  }

  async endSession(id: string): Promise<void> {
    const { error } = await this.db
      .from("sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`endSession: ${error.message}`);
  }

  async recordAttempt(a: NewAttempt): Promise<void> {
    return this.recordAttempts([a]);
  }

  async recordAttempts(list: NewAttempt[]): Promise<void> {
    if (!list.length) return;
    const { error } = await this.db.from("attempts").insert(
      list.map((a) => ({
        id: randomUUID(),
        session_id: a.sessionId,
        kind: a.kind,
        scope: a.scope,
        word_key: a.wordKey,
        direction: a.direction,
        prompt: a.prompt,
        expected: a.expected,
        given: a.given,
        status: a.status,
        error_kind: a.errorKind,
        ms: a.ms,
      }))
    );

    // Postgres reports an RLS refusal on INSERT as an error (42501), unlike a
    // filtered SELECT which just returns nothing — so this catches it.
    if (error) {
      const hint = /policy|permission|denied|42501/i.test(error.message)
        ? " The database refused the write: re-run db/postgres.sql, which " +
          "grants the public key insert access."
        : "";
      throw new Error(`recordAttempts: ${error.message}.${hint}`);
    }
  }

  async dashboard(opts: { days?: number } = {}): Promise<Dashboard> {
    const days = opts.days ?? 30;

    // One round trip each, in parallel — not one per row.
    const [totals, byScope, weakest, errors, activity] = await Promise.all([
      this.rpc<TotalsRow[]>("dashboard_totals"),
      this.rpc<ScopeRow[]>("dashboard_by_scope"),
      this.rpc<WordRow[]>("dashboard_weakest_words", { lim: 20 }),
      this.rpc<ErrorRow[]>("dashboard_errors"),
      this.rpc<ActivityRow[]>("dashboard_activity", { days }),
    ]);

    const t = totals[0] ?? {
      attempts: 0, correct: 0, words_seen: 0, words_mastered: 0, sessions: 0,
    };

    const totalsOut: Totals = {
      attempts: Number(t.attempts),
      correct: Number(t.correct),
      accuracy: Number(t.attempts) ? Number(t.correct) / Number(t.attempts) : 0,
      wordsSeen: Number(t.words_seen),
      wordsMastered: Number(t.words_mastered),
      sessions: Number(t.sessions),
    };

    const errorsOut: ErrorBreakdown = {
      accent: 0, article: 0, unknown: 0, skipped: 0,
    };
    for (const row of errors) {
      const k = row.error_kind as keyof ErrorBreakdown;
      if (k in errorsOut) errorsOut[k] += Number(row.n);
      else errorsOut.unknown += Number(row.n);
    }

    const activityOut: DayActivity[] = activity
      .map((r) => ({
        day: r.day,
        attempts: Number(r.attempts),
        correct: Number(r.correct),
      }))
      .reverse();

    return {
      totals: totalsOut,
      byScope: byScope.map(
        (r): ScopeStat => ({
          scope: r.scope,
          attempts: Number(r.attempts),
          correct: Number(r.correct),
          accuracy: Number(r.attempts) ? Number(r.correct) / Number(r.attempts) : 0,
          wordsSeen: Number(r.words_seen),
          wordsMastered: Number(r.words_mastered),
        })
      ),
      weakestWords: weakest.map(
        (r): WordStat => ({
          wordKey: r.word_key,
          prompt: r.prompt,
          expected: r.expected,
          attempts: Number(r.attempts),
          correct: Number(r.correct),
          accuracy: Number(r.attempts) ? Number(r.correct) / Number(r.attempts) : 0,
          lastStatus: r.last_status as Status,
          lastSeen: r.last_seen,
        })
      ),
      errors: errorsOut,
      activity: activityOut,
      currentStreakDays: streakFrom(activityOut),
    };
  }

  async reset(): Promise<void> {
    // Attempts cascade from sessions, but both are cleared explicitly so a
    // stray attempt without a session cannot survive.
    const all = "00000000-0000-0000-0000-000000000000";
    await this.db.from("attempts").delete().neq("id", all);
    await this.db.from("sessions").delete().neq("id", all);
  }

  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args ?? {});
    if (error) throw new Error(`${fn}: ${error.message}`);
    return (data ?? []) as T;
  }
}

type TotalsRow = {
  attempts: number; correct: number; words_seen: number;
  words_mastered: number; sessions: number;
};
type ScopeRow = {
  scope: string; attempts: number; correct: number;
  words_seen: number; words_mastered: number;
};
type WordRow = {
  word_key: string; prompt: string; expected: string;
  attempts: number; correct: number; last_status: string; last_seen: string;
};
type ErrorRow = { error_kind: string; n: number };
type ActivityRow = { day: string; attempts: number; correct: number };

/**
 * Consecutive days ending today or yesterday. Shared shape with the SQLite
 * store, but computed from the activity list rather than a second query.
 */
export function streakFrom(activity: DayActivity[]): number {
  const days = activity
    .filter((a) => a.attempts > 0)
    .map((a) => a.day)
    .sort()
    .reverse();
  if (!days.length) return 0;

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (days[0] !== iso(today) && days[0] !== iso(yesterday)) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    prev.setDate(prev.getDate() - 1);
    if (iso(prev) === days[i]) streak++;
    else break;
  }
  return streak;
}
