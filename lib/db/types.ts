// The storage contract. Every query the app makes goes through this
// interface, so swapping SQLite for Supabase means writing one new
// implementation and changing nothing else.

export type Status = "correct" | "accent" | "wrong";
export type ErrorKind = "accent" | "article" | "unknown" | "skipped";

/** Scope used by /api/health; excluded from every statistic. */
export const HEALTHCHECK_SCOPE = "__healthcheck";

export type NewSession = {
  kind: "vocab" | "numbers";
  scope: string;
  direction: string;
};

export type NewAttempt = {
  sessionId: string;
  kind: "vocab" | "numbers";
  scope: string;
  wordKey: string;
  direction: string;
  prompt: string;
  expected: string;
  given: string;
  status: Status;
  errorKind: ErrorKind | null;
  ms: number | null;
};

export type Totals = {
  attempts: number;
  correct: number;
  accuracy: number;      // 0–1
  wordsSeen: number;
  wordsMastered: number; // see MASTERY_RULE
  sessions: number;
};

export type ScopeStat = {
  scope: string;
  attempts: number;
  correct: number;
  accuracy: number;
  wordsSeen: number;
  wordsMastered: number;
};

export type WordStat = {
  wordKey: string;
  prompt: string;
  expected: string;
  attempts: number;
  correct: number;
  accuracy: number;
  lastStatus: Status;
  lastSeen: string;
};

export type ErrorBreakdown = {
  accent: number;
  article: number;
  unknown: number;
  skipped: number;
};

export type DayActivity = {
  day: string;       // YYYY-MM-DD
  attempts: number;
  correct: number;
};

export type Dashboard = {
  totals: Totals;
  byScope: ScopeStat[];
  weakestWords: WordStat[];
  errors: ErrorBreakdown;
  activity: DayActivity[];
  currentStreakDays: number;
};

export interface Store {
  startSession(s: NewSession): Promise<string>;
  endSession(id: string): Promise<void>;
  recordAttempt(a: NewAttempt): Promise<void>;
  /** Attempts are batched from the client, so this is the hot path. */
  recordAttempts(as: NewAttempt[]): Promise<void>;
  dashboard(opts?: { days?: number }): Promise<Dashboard>;
  reset(): Promise<void>;
  /** Removes a single session and its attempts — used by the health check. */
  deleteSession(id: string): Promise<void>;
}

/**
 * A word counts as mastered once it has been answered correctly at least
 * three times and was right the last two times in a row. Deliberately
 * conservative: one lucky answer should not count toward the 70% goal.
 */
export const MASTERY_RULE = {
  minCorrect: 3,
  lastNMustBeCorrect: 2,
} as const;
