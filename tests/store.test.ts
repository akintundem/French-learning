import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore, isMastered } from "@/lib/db/sqlite";
import { classifyError } from "@/lib/db/classify";
import type { NewAttempt } from "@/lib/db/types";

let dir: string;
let store: SqliteStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fr-"));
  store = new SqliteStore(join(dir, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const attempt = (over: Partial<NewAttempt> & { sessionId: string }): NewAttempt => ({
  kind: "vocab",
  scope: "A3",
  wordKey: "A3|le père",
  direction: "en-fr",
  prompt: "father",
  expected: "le père",
  given: "le père",
  status: "correct",
  errorKind: null,
  ms: 1200,
  ...over,
});

describe("recording", () => {
  it("stores a session and its attempts", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([
      attempt({ sessionId: s }),
      attempt({ sessionId: s, status: "wrong", given: "la père", errorKind: "article" }),
    ]);

    const d = await store.dashboard();
    expect(d.totals.attempts).toBe(2);
    expect(d.totals.correct).toBe(1);
    expect(d.totals.accuracy).toBe(0.5);
    expect(d.totals.sessions).toBe(1);
  });

  it("counts distinct words, not attempts", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([
      attempt({ sessionId: s }),
      attempt({ sessionId: s }),
      attempt({ sessionId: s, wordKey: "A3|la mère", expected: "la mère" }),
    ]);

    const d = await store.dashboard();
    expect(d.totals.attempts).toBe(3);
    expect(d.totals.wordsSeen).toBe(2);
  });

  it("is empty before anything is recorded", async () => {
    const d = await store.dashboard();
    expect(d.totals).toMatchObject({
      attempts: 0, correct: 0, accuracy: 0, wordsSeen: 0, wordsMastered: 0,
    });
    expect(d.weakestWords).toEqual([]);
    expect(d.currentStreakDays).toBe(0);
  });
});

describe("mastery", () => {
  it("needs three correct answers, the last two in a row", () => {
    expect(isMastered(["correct", "correct"])).toBe(false);          // too few
    expect(isMastered(["correct", "correct", "correct"])).toBe(true);
    expect(isMastered(["correct", "correct", "correct", "wrong"])).toBe(false);
    expect(isMastered(["wrong", "correct", "correct", "correct"])).toBe(true);
    // Three correct but the recent history is shaky.
    expect(isMastered(["correct", "correct", "correct", "wrong", "correct"])).toBe(false);
  });

  it("counts a mastered word toward the totals", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([
      attempt({ sessionId: s }),
      attempt({ sessionId: s }),
      attempt({ sessionId: s }),
    ]);

    const d = await store.dashboard();
    expect(d.totals.wordsMastered).toBe(1);
  });

  it("un-masters a word that is then missed", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([
      attempt({ sessionId: s }), attempt({ sessionId: s }), attempt({ sessionId: s }),
    ]);
    expect((await store.dashboard()).totals.wordsMastered).toBe(1);

    await store.recordAttempts([attempt({ sessionId: s, status: "wrong" })]);
    expect((await store.dashboard()).totals.wordsMastered).toBe(0);
  });

  it("does not count generated number drills toward word mastery", async () => {
    const s = await store.startSession({ kind: "numbers", scope: "cardinals", direction: "n-a" });
    for (let i = 0; i < 5; i++)
      await store.recordAttempt(
        attempt({ sessionId: s, kind: "numbers", scope: "cardinals", wordKey: "cardinals|47" })
      );

    const d = await store.dashboard();
    expect(d.totals.attempts).toBe(5);
    expect(d.totals.wordsMastered).toBe(0); // vocab only
  });
});

describe("weak spots", () => {
  it("ranks the worst words first and ignores perfect ones", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "B3", direction: "en-fr" });

    // échouer: 1 of 4. empêcher: 2 of 4. réussir: perfect.
    const mk = (key: string, ok: boolean) =>
      attempt({
        sessionId: s, scope: "B3", wordKey: key, expected: key.split("|")[1],
        status: ok ? "correct" : "wrong",
        given: ok ? key.split("|")[1] : "xxx",
        errorKind: ok ? null : "unknown",
      });

    await store.recordAttempts([
      mk("B3|échouer", true), mk("B3|échouer", false), mk("B3|échouer", false), mk("B3|échouer", false),
      mk("B3|empêcher", true), mk("B3|empêcher", true), mk("B3|empêcher", false), mk("B3|empêcher", false),
      mk("B3|réussir", true), mk("B3|réussir", true),
    ]);

    const d = await store.dashboard();
    expect(d.weakestWords.map((w) => w.wordKey)).toEqual(["B3|échouer", "B3|empêcher"]);
    expect(d.weakestWords[0].accuracy).toBeCloseTo(0.25);
  });

  it("reports accuracy per module", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([
      attempt({ sessionId: s, scope: "A3" }),
      attempt({ sessionId: s, scope: "A3", status: "wrong", errorKind: "unknown" }),
      attempt({ sessionId: s, scope: "B3", wordKey: "B3|échouer" }),
    ]);

    const d = await store.dashboard();
    const a3 = d.byScope.find((r) => r.scope === "A3")!;
    expect(a3.attempts).toBe(2);
    expect(a3.accuracy).toBe(0.5);
  });
});

describe("error patterns", () => {
  it("separates accents, articles, unknowns and skips", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([
      attempt({ sessionId: s, status: "accent", given: "le pere", errorKind: "accent" }),
      attempt({ sessionId: s, status: "accent", given: "le pere", errorKind: "accent" }),
      attempt({ sessionId: s, status: "wrong", given: "la père", errorKind: "article" }),
      attempt({ sessionId: s, status: "wrong", given: "chien", errorKind: "unknown" }),
      attempt({ sessionId: s, status: "wrong", given: "", errorKind: "skipped" }),
      attempt({ sessionId: s }), // correct, excluded
    ]);

    const d = await store.dashboard();
    expect(d.errors).toEqual({ accent: 2, article: 1, unknown: 1, skipped: 1 });
  });

  it("classifies what the grader saw", () => {
    expect(classifyError("", "le père", "wrong")).toBe("skipped");
    expect(classifyError("le pere", "le père", "accent")).toBe("accent");
    expect(classifyError("la père", "le père", "wrong")).toBe("article");
    expect(classifyError("père", "le père", "wrong")).toBe("article");
    expect(classifyError("chien", "le père", "wrong")).toBe("unknown");
    expect(classifyError("le père", "le père", "correct")).toBeNull();
  });
});

describe("activity", () => {
  it("groups attempts by day", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempts([attempt({ sessionId: s }), attempt({ sessionId: s })]);

    const d = await store.dashboard();
    expect(d.activity).toHaveLength(1);
    expect(d.activity[0].attempts).toBe(2);
    expect(d.activity[0].day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("counts today as a one-day streak", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempt(attempt({ sessionId: s }));
    expect((await store.dashboard()).currentStreakDays).toBe(1);
  });
});

describe("health-check probe rows", () => {
  it("never appear in any statistic", async () => {
    const real = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempt(attempt({ sessionId: real }));

    // A probe, as written by /api/health.
    const probe = await store.startSession({
      kind: "vocab", scope: "__healthcheck", direction: "en-fr",
    });
    await store.recordAttempts([
      attempt({ sessionId: probe, scope: "__healthcheck", wordKey: "__healthcheck" }),
      attempt({
        sessionId: probe, scope: "__healthcheck", wordKey: "__healthcheck",
        status: "wrong", errorKind: "unknown", given: "x",
      }),
    ]);

    const d = await store.dashboard();
    expect(d.totals.attempts).toBe(1);          // not 3
    expect(d.totals.sessions).toBe(1);          // not 2
    expect(d.totals.wordsSeen).toBe(1);
    expect(d.byScope.map((r) => r.scope)).toEqual(["A3"]);
    expect(d.errors).toEqual({ accent: 0, article: 0, unknown: 0, skipped: 0 });
    expect(d.activity[0]?.attempts).toBe(1);
  });

  it("deleteSession removes the probe and its attempts", async () => {
    const id = await store.startSession({
      kind: "vocab", scope: "__healthcheck", direction: "en-fr",
    });
    await store.recordAttempt(attempt({ sessionId: id, scope: "__healthcheck" }));

    await store.deleteSession(id);

    // Attempts cascade with the session.
    const d = await store.dashboard();
    expect(d.totals.attempts).toBe(0);
    expect(d.totals.sessions).toBe(0);
  });
});

describe("reset", () => {
  it("clears everything", async () => {
    const s = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempt(attempt({ sessionId: s }));
    await store.reset();

    const d = await store.dashboard();
    expect(d.totals.attempts).toBe(0);
    expect(d.totals.sessions).toBe(0);
  });
});
