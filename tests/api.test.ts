import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "@/lib/db/sqlite";

let dir: string;
let store: SqliteStore;

// The routes resolve their store through lib/db, so point that at a temp file.
vi.mock("@/lib/db", () => ({ getStore: () => store }));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fr-api-"));
  store = new SqliteStore(join(dir, "api.db"));
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/sessions", () => {
  it("creates a session and returns its id", async () => {
    const { POST } = await import("@/app/api/sessions/route");
    const res = await POST(
      post("http://t/api/sessions", { kind: "vocab", scope: "A3", direction: "en-fr" })
    );
    const { id } = await res.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("POST /api/attempts", () => {
  it("records a batch", async () => {
    const id = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    const { POST } = await import("@/app/api/attempts/route");

    const res = await POST(
      post("http://t/api/attempts", {
        attempts: [
          { sessionId: id, kind: "vocab", scope: "A3", wordKey: "A3|le père",
            direction: "en-fr", prompt: "father", expected: "le père",
            given: "le père", status: "correct", errorKind: null, ms: 900 },
        ],
      })
    );

    expect(await res.json()).toEqual({ recorded: 1 });
    expect((await store.dashboard()).totals.attempts).toBe(1);
  });

  it("drops rows with an invalid status rather than storing junk", async () => {
    const id = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    const { POST } = await import("@/app/api/attempts/route");

    const res = await POST(
      post("http://t/api/attempts", {
        attempts: [
          { sessionId: id, status: "banana", wordKey: "x" },
          { sessionId: id, status: "correct", wordKey: "A3|le père",
            kind: "vocab", scope: "A3", direction: "en-fr",
            prompt: "father", expected: "le père", given: "le père" },
        ],
      })
    );

    expect(await res.json()).toEqual({ recorded: 1 });
  });

  it("ignores an empty batch", async () => {
    const { POST } = await import("@/app/api/attempts/route");
    const res = await POST(post("http://t/api/attempts", { attempts: [] }));
    expect(await res.json()).toEqual({ recorded: 0 });
  });
});

describe("GET /api/dashboard", () => {
  it("returns the full shape", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET(new Request("http://t/api/dashboard?days=30"));
    const d = await res.json();

    expect(d).toHaveProperty("totals");
    expect(d).toHaveProperty("byScope");
    expect(d).toHaveProperty("weakestWords");
    expect(d).toHaveProperty("errors");
    expect(d).toHaveProperty("activity");
    expect(d).toHaveProperty("currentStreakDays");
  });

  it("DELETE clears the history", async () => {
    const id = await store.startSession({ kind: "vocab", scope: "A3", direction: "en-fr" });
    await store.recordAttempt({
      sessionId: id, kind: "vocab", scope: "A3", wordKey: "A3|le père",
      direction: "en-fr", prompt: "father", expected: "le père",
      given: "le père", status: "correct", errorKind: null, ms: 100,
    });

    const { DELETE } = await import("@/app/api/dashboard/route");
    await DELETE();
    expect((await store.dashboard()).totals.attempts).toBe(0);
  });
});
