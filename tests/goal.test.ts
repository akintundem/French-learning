import { describe, expect, it } from "vitest";
import { project } from "@/lib/db/goal";
import type { Dashboard } from "@/lib/db/types";

const base = (over: Partial<Dashboard> = {}): Dashboard => ({
  totals: {
    attempts: 100, correct: 80, accuracy: 0.8,
    wordsSeen: 50, wordsMastered: 30, sessions: 10,
  },
  byScope: [],
  weakestWords: [],
  errors: { accent: 0, article: 0, unknown: 0, skipped: 0 },
  activity: Array.from({ length: 10 }, (_, i) => ({
    day: `2026-01-${String(i + 1).padStart(2, "0")}`,
    attempts: 10,
    correct: 8,
  })),
  currentStreakDays: 10,
  ...over,
});

describe("goal projection", () => {
  it("targets 70% of the corpus", () => {
    const p = project(base(), 1000);
    expect(p.target).toBe(700);
    expect(p.mastered).toBe(30);
    expect(p.fraction).toBeCloseTo(0.03);
  });

  it("rates against days practised, not calendar days", () => {
    // 30 mastered over 10 active days = 3/day, so 670 more takes 224 days.
    const p = project(base(), 1000);
    expect(p.perDay).toBeCloseTo(3);
    expect(p.daysRemaining).toBe(224);
    expect(p.projectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("says nothing until there is enough history", () => {
    const thin = base({
      activity: [{ day: "2026-01-01", attempts: 5, correct: 4 }],
    });
    const p = project(thin, 1000);
    expect(p.verdict).toBe("unknown");
    expect(p.projectedDate).toBeNull();
    expect(p.daysRemaining).toBeNull();
  });

  it("reports the goal already met", () => {
    const done = base({
      totals: { ...base().totals, wordsMastered: 800 },
    });
    const p = project(done, 1000);
    expect(p.verdict).toBe("ahead");
    expect(p.daysRemaining).toBe(0);
  });

  it("judges against a deadline when given one", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 400);
    expect(project(base(), 1000, soon).verdict).toBe("ahead");

    const tight = new Date();
    tight.setDate(tight.getDate() + 30);
    expect(project(base(), 1000, tight).verdict).toBe("behind");
  });

  it("handles an empty history without dividing by zero", () => {
    const empty = base({
      totals: { attempts: 0, correct: 0, accuracy: 0, wordsSeen: 0, wordsMastered: 0, sessions: 0 },
      activity: [],
    });
    const p = project(empty, 1000);
    expect(p.perDay).toBe(0);
    expect(p.fraction).toBe(0);
    expect(p.verdict).toBe("unknown");
  });
});
