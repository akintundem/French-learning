import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The two stores must stay interchangeable. These check the contract at the
 * seams that a type-check alone would not catch.
 */
describe("store parity", () => {
  const sqlite = readFileSync("lib/db/sqlite.ts", "utf8");
  const supabase = readFileSync("lib/db/supabase.ts", "utf8");
  const sqliteSchema = readFileSync("db/migrations/001_init.sql", "utf8");
  const pgSchema = readFileSync("db/postgres.sql", "utf8");

  it("both implement every method on Store", () => {
    const methods = [
      "startSession", "endSession", "recordAttempt", "recordAttempts",
      "dashboard", "reset",
    ];
    for (const m of methods) {
      expect(sqlite).toContain(`async ${m}(`);
      expect(supabase).toContain(`async ${m}(`);
    }
  });

  it("both schemas declare the same columns", () => {
    const columns = [
      "session_id", "user_id", "asked_at", "word_key", "direction",
      "prompt", "expected", "given", "status", "error_kind", "ms",
    ];
    for (const c of columns) {
      expect(sqliteSchema).toContain(c);
      expect(pgSchema).toContain(c);
    }
  });

  it("the Postgres schema enables row level security", () => {
    // Without this, the anon key reads every user's history.
    expect(pgSchema).toMatch(/alter table sessions enable row level security/i);
    expect(pgSchema).toMatch(/alter table attempts enable row level security/i);
    expect(pgSchema).toMatch(/create policy/i);
  });

  it("the mastery rule is stated identically in both", () => {
    // 3+ correct, last two correct. Drifting apart would silently change
    // what "70% mastered" means between local and production.
    const types = readFileSync("lib/db/types.ts", "utf8");
    expect(types).toContain("minCorrect: 3");
    expect(types).toContain("lastNMustBeCorrect: 2");
    const fns = readFileSync("db/functions.sql", "utf8");
    expect(fns).toContain("n_correct >= 3");
    expect(fns).toContain("array_length(last_two, 1) = 2");
  });

  it("only lib/db touches the database", () => {
    // The seam that makes swapping backends safe.
    const appFiles = [
      "app/dashboard/page.tsx",
      "app/api/attempts/route.ts",
      "app/api/sessions/route.ts",
      "app/api/dashboard/route.ts",
      "lib/tracker.ts",
    ];
    for (const f of appFiles) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/better-sqlite3|createClient|SELECT |INSERT /i);
    }
  });
});
