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
    // Without this, the anon key reads the whole history.
    expect(pgSchema).toMatch(/alter table sessions enable row level security/i);
    expect(pgSchema).toMatch(/alter table attempts enable row level security/i);
  });

  it("does not require auth.uid(), which is null without a sign-in", () => {
    // The original schema defaulted user_id to auth.uid() and gated RLS on it.
    // With no login that made every insert fail the not-null constraint and
    // every read return nothing — writes failed silently for days.
    const active = pgSchema
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(active).not.toMatch(/auth\.uid\(\)/);
  });

  it("the Postgres schema is safe to run twice", () => {
    // Re-running is the natural response to a half-finished setup, so every
    // statement has to tolerate it. `create policy` alone does not.
    const active = pgSchema
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    // `create policy` has no IF NOT EXISTS form, so each one must be preceded
    // by a matching `drop policy if exists`.
    const created = [...active.matchAll(/create policy "([^"]+)"/gi)].map((m) => m[1]);
    const dropped = [...active.matchAll(/drop policy if exists "([^"]+)"/gi)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(0);
    for (const name of created) expect(dropped).toContain(name);

    expect(active).toMatch(/create table if not exists/i);
    expect(active).toMatch(/create index if not exists/i);
  });

  it("grants the public key no way to read raw rows", () => {
    // The whole no-service-role design rests on this: writes are permitted,
    // select is not, and every figure comes back through an aggregate.
    const active = pgSchema
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");

    expect(active).toMatch(/for insert with check/i);
    expect(active).not.toMatch(/for select/i);
    expect(active).not.toMatch(/for all/i);
  });

  it("the store never selects raw rows from either table", () => {
    // A .select() after .from() would need a permission the schema withholds,
    // so it would fail in production while passing against a mock.
    // Scanned by index rather than by regex: a lazy [\s\S]{0,200}? between two
    // patterns backtracks catastrophically and hangs the run.
    const src = readFileSync("lib/db/supabase.ts", "utf8");
    const offending: string[] = [];
    for (const table of ["sessions", "attempts"]) {
      let at = src.indexOf(`.from("${table}")`);
      while (at !== -1) {
        const window = src.slice(at, at + 200);
        if (window.includes(".select(")) offending.push(`${table}: ${window.slice(0, 60)}`);
        at = src.indexOf(`.from("${table}")`, at + 1);
      }
    }
    expect(offending).toEqual([]);
  });

  it("the dashboard functions can read past row level security", () => {
    // They return only aggregates, never raw rows.
    const fns = readFileSync("db/functions.sql", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    const definers = fns.match(/security definer/gi) ?? [];
    const functions = fns.match(/create or replace function/gi) ?? [];
    expect(definers.length).toBe(functions.length);
    expect(fns).toMatch(/set search_path = public/i);
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
