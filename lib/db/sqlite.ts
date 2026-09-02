import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  MASTERY_RULE,
  type Dashboard, type DayActivity, type ErrorBreakdown,
  type NewAttempt, type NewSession, type ScopeStat, type Status,
  type Store, type Totals, type WordStat,
} from "./types";

const USER = "local"; // single-user locally; Supabase uses auth.uid()

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(file = process.env.DATABASE_FILE ?? "db/practice.db") {
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate() {
    const sql = readFileSync(
      join(process.cwd(), "db/migrations/001_init.sql"),
      "utf8"
    );
    this.db.exec(sql);
  }

  async startSession(s: NewSession): Promise<string> {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, kind, scope, direction, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, USER, s.kind, s.scope, s.direction, new Date().toISOString());
    return id;
  }

  async endSession(id: string): Promise<void> {
    this.db
      .prepare(`UPDATE sessions SET ended_at = ? WHERE id = ? AND user_id = ?`)
      .run(new Date().toISOString(), id, USER);
  }

  async recordAttempt(a: NewAttempt): Promise<void> {
    return this.recordAttempts([a]);
  }

  async recordAttempts(list: NewAttempt[]): Promise<void> {
    if (!list.length) return;
    const stmt = this.db.prepare(
      `INSERT INTO attempts
         (id, session_id, user_id, asked_at, kind, scope, word_key, direction,
          prompt, expected, given, status, error_kind, ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const now = new Date().toISOString();
    const insertAll = this.db.transaction((rows: NewAttempt[]) => {
      for (const a of rows) {
        stmt.run(
          randomUUID(), a.sessionId, USER, now, a.kind, a.scope, a.wordKey,
          a.direction, a.prompt, a.expected, a.given, a.status,
          a.errorKind, a.ms
        );
      }
    });
    insertAll(list);
  }

  async dashboard(opts: { days?: number } = {}): Promise<Dashboard> {
    const days = opts.days ?? 30;

    const totals = this.totals();
    return {
      totals,
      byScope: this.byScope(),
      weakestWords: this.weakestWords(),
      errors: this.errors(),
      activity: this.activity(days),
      currentStreakDays: this.streak(),
    };
  }

  // ------------------------------------------------------------------ parts

  private totals(): Totals {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS attempts,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) AS correct,
                COUNT(DISTINCT word_key) AS words_seen
         FROM attempts WHERE user_id = ?`
      )
      .get(USER) as { attempts: number; correct: number | null; words_seen: number };

    const sessions = this.db
      .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?`)
      .get(USER) as { n: number };

    const correct = row.correct ?? 0;
    return {
      attempts: row.attempts,
      correct,
      accuracy: row.attempts ? correct / row.attempts : 0,
      wordsSeen: row.words_seen,
      wordsMastered: this.masteredCount(),
      sessions: sessions.n,
    };
  }

  /**
   * Mastered = at least `minCorrect` correct answers, and the most recent
   * `lastNMustBeCorrect` attempts were all correct.
   */
  private masteredCount(): number {
    const rows = this.db
      .prepare(
        `SELECT word_key, status, asked_at, rowid
         FROM attempts WHERE user_id = ? AND kind = 'vocab'
         ORDER BY word_key, asked_at, rowid`
      )
      .all(USER) as { word_key: string; status: Status }[];

    const byWord = new Map<string, Status[]>();
    for (const r of rows) {
      if (!byWord.has(r.word_key)) byWord.set(r.word_key, []);
      byWord.get(r.word_key)!.push(r.status);
    }

    let mastered = 0;
    for (const statuses of byWord.values()) {
      if (isMastered(statuses)) mastered++;
    }
    return mastered;
  }

  private byScope(): ScopeStat[] {
    const rows = this.db
      .prepare(
        `SELECT scope,
                COUNT(*) AS attempts,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) AS correct,
                COUNT(DISTINCT word_key) AS words_seen
         FROM attempts
         WHERE user_id = ? AND kind = 'vocab'
         GROUP BY scope
         ORDER BY scope`
      )
      .all(USER) as {
        scope: string; attempts: number; correct: number; words_seen: number;
      }[];

    const mastered = this.masteredByScope();

    return rows.map((r) => ({
      scope: r.scope,
      attempts: r.attempts,
      correct: r.correct,
      accuracy: r.attempts ? r.correct / r.attempts : 0,
      wordsSeen: r.words_seen,
      wordsMastered: mastered.get(r.scope) ?? 0,
    }));
  }

  private masteredByScope(): Map<string, number> {
    const rows = this.db
      .prepare(
        `SELECT scope, word_key, status
         FROM attempts WHERE user_id = ? AND kind = 'vocab'
         ORDER BY word_key, asked_at, rowid`
      )
      .all(USER) as { scope: string; word_key: string; status: Status }[];

    const byWord = new Map<string, { scope: string; statuses: Status[] }>();
    for (const r of rows) {
      if (!byWord.has(r.word_key))
        byWord.set(r.word_key, { scope: r.scope, statuses: [] });
      byWord.get(r.word_key)!.statuses.push(r.status);
    }

    const out = new Map<string, number>();
    for (const { scope, statuses } of byWord.values()) {
      if (isMastered(statuses)) out.set(scope, (out.get(scope) ?? 0) + 1);
    }
    return out;
  }

  private weakestWords(limit = 20): WordStat[] {
    const rows = this.db
      .prepare(
        `SELECT word_key,
                COUNT(*) AS attempts,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) AS correct,
                MAX(asked_at) AS last_seen
         FROM attempts
         WHERE user_id = ? AND kind = 'vocab'
         GROUP BY word_key
         HAVING attempts >= 2 AND correct < attempts
         ORDER BY (CAST(correct AS REAL) / attempts) ASC, attempts DESC
         LIMIT ?`
      )
      .all(USER, limit) as {
        word_key: string; attempts: number; correct: number; last_seen: string;
      }[];

    // The prompt and expected text come from the most recent attempt, so a
    // regenerated vocabulary file doesn't leave stale wording behind.
    const latest = this.db.prepare(
      `SELECT prompt, expected, status FROM attempts
       WHERE user_id = ? AND word_key = ?
       ORDER BY asked_at DESC, rowid DESC LIMIT 1`
    );

    return rows.map((r) => {
      const last = latest.get(USER, r.word_key) as {
        prompt: string; expected: string; status: Status;
      };
      return {
        wordKey: r.word_key,
        prompt: last?.prompt ?? r.word_key,
        expected: last?.expected ?? "",
        attempts: r.attempts,
        correct: r.correct,
        accuracy: r.attempts ? r.correct / r.attempts : 0,
        lastStatus: last?.status ?? "wrong",
        lastSeen: r.last_seen,
      };
    });
  }

  private errors(): ErrorBreakdown {
    const rows = this.db
      .prepare(
        `SELECT error_kind, COUNT(*) AS n
         FROM attempts
         WHERE user_id = ? AND status != 'correct'
         GROUP BY error_kind`
      )
      .all(USER) as { error_kind: string | null; n: number }[];

    const out: ErrorBreakdown = { accent: 0, article: 0, unknown: 0, skipped: 0 };
    for (const r of rows) {
      const k = (r.error_kind ?? "unknown") as keyof ErrorBreakdown;
      if (k in out) out[k] += r.n;
      else out.unknown += r.n;
    }
    return out;
  }

  private activity(days: number): DayActivity[] {
    const rows = this.db
      .prepare(
        `SELECT substr(asked_at, 1, 10) AS day,
                COUNT(*) AS attempts,
                SUM(CASE WHEN status = 'correct' THEN 1 ELSE 0 END) AS correct
         FROM attempts
         WHERE user_id = ?
         GROUP BY day
         ORDER BY day DESC
         LIMIT ?`
      )
      .all(USER, days) as DayActivity[];
    return rows.reverse();
  }

  /** Consecutive days ending today (or yesterday) with at least one attempt. */
  private streak(): number {
    const days = this.db
      .prepare(
        `SELECT DISTINCT substr(asked_at, 1, 10) AS day
         FROM attempts WHERE user_id = ?
         ORDER BY day DESC`
      )
      .all(USER) as { day: string }[];
    if (!days.length) return 0;

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    // A streak is still alive if the last practice was today or yesterday.
    if (days[0].day !== iso(today) && days[0].day !== iso(yesterday)) return 0;

    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1].day);
      prev.setDate(prev.getDate() - 1);
      if (iso(prev) === days[i].day) streak++;
      else break;
    }
    return streak;
  }

  async reset(): Promise<void> {
    this.db.exec("DELETE FROM attempts; DELETE FROM sessions;");
  }

  close() {
    this.db.close();
  }
}

/** Shared by the total and per-scope mastery counts. */
export function isMastered(statuses: Status[]): boolean {
  const correct = statuses.filter((s) => s === "correct").length;
  if (correct < MASTERY_RULE.minCorrect) return false;
  const tail = statuses.slice(-MASTERY_RULE.lastNMustBeCorrect);
  return (
    tail.length === MASTERY_RULE.lastNMustBeCorrect &&
    tail.every((s) => s === "correct")
  );
}
