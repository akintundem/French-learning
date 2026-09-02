import { describe, expect, it, vi, beforeEach } from "vitest";

// A minimal fake of the supabase-js surface this store actually uses.
type Row = Record<string, unknown>;
const state = {
  inserted: [] as { table: string; rows: Row[] }[],
  updated: [] as { table: string; patch: Row; id: string }[],
  deleted: [] as string[],
  rpcCalls: [] as { fn: string; args: unknown }[],
  rpcData: {} as Record<string, unknown>,
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      return {
        insert(rows: Row | Row[]) {
          const list = Array.isArray(rows) ? rows : [rows];
          state.inserted.push({ table, rows: list });
          return {
            select: () => ({
              single: async () => ({ data: { id: "new-session-id" }, error: null }),
            }),
            then: (r: (v: { error: null }) => void) => r({ error: null }),
          };
        },
        update(patch: Row) {
          return {
            eq: async (_c: string, id: string) => {
              state.updated.push({ table, patch, id });
              return { error: null };
            },
          };
        },
        delete() {
          return {
            neq: async () => {
              state.deleted.push(table);
              return { error: null };
            },
          };
        },
      };
    },
    async rpc(fn: string, args: unknown) {
      state.rpcCalls.push({ fn, args });
      return { data: state.rpcData[fn] ?? [], error: null };
    },
  }),
}));

const { SupabaseStore, streakFrom } = await import("@/lib/db/supabase");

const store = () => new SupabaseStore("https://x.supabase.co", "anon-key");

beforeEach(() => {
  state.inserted = [];
  state.updated = [];
  state.deleted = [];
  state.rpcCalls = [];
  state.rpcData = {};
});

describe("SupabaseStore writes", () => {
  it("creates a session and returns the new id", async () => {
    const id = await store().startSession({
      kind: "vocab", scope: "A3", direction: "en-fr",
    });
    expect(id).toBe("new-session-id");
    expect(state.inserted[0].table).toBe("sessions");
    expect(state.inserted[0].rows[0]).toMatchObject({
      kind: "vocab", scope: "A3", direction: "en-fr",
    });
  });

  it("maps camelCase fields onto the snake_case columns", async () => {
    await store().recordAttempts([
      {
        sessionId: "s1", kind: "vocab", scope: "A3", wordKey: "A3|le père",
        direction: "en-fr", prompt: "father", expected: "le père",
        given: "la père", status: "wrong", errorKind: "article", ms: 1400,
      },
    ]);

    const row = state.inserted[0].rows[0];
    // A mismatch here is silent data loss, so every column is checked.
    expect(row).toEqual({
      session_id: "s1", kind: "vocab", scope: "A3", word_key: "A3|le père",
      direction: "en-fr", prompt: "father", expected: "le père",
      given: "la père", status: "wrong", error_kind: "article", ms: 1400,
    });
  });

  it("sends one insert for a batch, not one per attempt", async () => {
    const mk = (i: number) => ({
      sessionId: "s1", kind: "vocab" as const, scope: "A3",
      wordKey: `A3|w${i}`, direction: "en-fr", prompt: "p", expected: "e",
      given: "g", status: "correct" as const, errorKind: null, ms: 100,
    });
    await store().recordAttempts([mk(1), mk(2), mk(3)]);

    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].rows).toHaveLength(3);
  });

  it("skips the round trip for an empty batch", async () => {
    await store().recordAttempts([]);
    expect(state.inserted).toHaveLength(0);
  });
});

describe("SupabaseStore dashboard", () => {
  it("aggregates in Postgres, one round trip per section", async () => {
    state.rpcData = {
      dashboard_totals: [{ attempts: 100, correct: 80, words_seen: 50, words_mastered: 12, sessions: 9 }],
      dashboard_by_scope: [{ scope: "A3", attempts: 40, correct: 30, words_seen: 20, words_mastered: 5 }],
      dashboard_weakest_words: [{
        word_key: "B3|échouer", prompt: "to fail", expected: "échouer",
        attempts: 4, correct: 1, last_status: "wrong", last_seen: "2026-09-01T10:00:00Z",
      }],
      dashboard_errors: [{ error_kind: "accent", n: 7 }, { error_kind: "article", n: 3 }],
      dashboard_activity: [{ day: "2026-09-01", attempts: 20, correct: 16 }],
    };

    const d = await store().dashboard({ days: 30 });

    // Five aggregate queries total — never one per row.
    expect(state.rpcCalls.map((c) => c.fn).sort()).toEqual([
      "dashboard_activity", "dashboard_by_scope", "dashboard_errors",
      "dashboard_totals", "dashboard_weakest_words",
    ]);

    expect(d.totals).toEqual({
      attempts: 100, correct: 80, accuracy: 0.8,
      wordsSeen: 50, wordsMastered: 12, sessions: 9,
    });
    expect(d.byScope[0]).toMatchObject({ scope: "A3", accuracy: 0.75, wordsMastered: 5 });
    expect(d.weakestWords[0]).toMatchObject({ wordKey: "B3|échouer", accuracy: 0.25 });
    expect(d.errors).toEqual({ accent: 7, article: 3, unknown: 0, skipped: 0 });
    expect(d.activity).toEqual([{ day: "2026-09-01", attempts: 20, correct: 16 }]);
  });

  it("passes the day window through to the query", async () => {
    await store().dashboard({ days: 7 });
    const call = state.rpcCalls.find((c) => c.fn === "dashboard_activity");
    expect(call?.args).toEqual({ days: 7 });
  });

  it("survives an empty database", async () => {
    const d = await store().dashboard();
    expect(d.totals).toEqual({
      attempts: 0, correct: 0, accuracy: 0,
      wordsSeen: 0, wordsMastered: 0, sessions: 0,
    });
    expect(d.errors).toEqual({ accent: 0, article: 0, unknown: 0, skipped: 0 });
    expect(d.currentStreakDays).toBe(0);
  });

  it("folds an unrecognised error kind into unknown", async () => {
    state.rpcData = { dashboard_errors: [{ error_kind: "something-else", n: 4 }] };
    const d = await store().dashboard();
    expect(d.errors.unknown).toBe(4);
  });
});

describe("streak", () => {
  const day = (back: number) => {
    const d = new Date();
    d.setDate(d.getDate() - back);
    return d.toISOString().slice(0, 10);
  };

  it("counts consecutive days ending today", () => {
    expect(streakFrom([
      { day: day(2), attempts: 5, correct: 4 },
      { day: day(1), attempts: 5, correct: 4 },
      { day: day(0), attempts: 5, correct: 4 },
    ])).toBe(3);
  });

  it("stays alive if the last practice was yesterday", () => {
    expect(streakFrom([{ day: day(1), attempts: 5, correct: 4 }])).toBe(1);
  });

  it("is broken by a gap", () => {
    expect(streakFrom([
      { day: day(5), attempts: 5, correct: 4 },
      { day: day(0), attempts: 5, correct: 4 },
    ])).toBe(1);
  });

  it("is zero when practice stopped days ago", () => {
    expect(streakFrom([{ day: day(4), attempts: 5, correct: 4 }])).toBe(0);
  });
});
